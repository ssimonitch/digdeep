import type { PoseLandmarker } from '@mediapipe/tasks-vision';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SQUAT_FIXTURES } from '../fixtures/landmark-fixtures';
import {
  createMockVideoElement,
  MockPoseLandmarker,
  resetMockMediaPipeConfig,
  setMockMediaPipeConfig,
} from './mediapipe-mocks';

/**
 * Example test demonstrating how to use MediaPipe mocks
 * for testing services that depend on MediaPipe
 */

// Example service that uses MediaPipe
class SimplePoseService {
  private landmarker: PoseLandmarker | null = null;

  async initialize(): Promise<void> {
    // In tests, this would use MockPoseLandmarker
    const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision');

    const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm');

    this.landmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: 'pose_landmarker_lite.task',
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numPoses: 1,
    });
  }

  detectPose(video: HTMLVideoElement): { hasValidPose: boolean; confidence: number } {
    if (!this.landmarker) {
      throw new Error('Service not initialized');
    }

    const result = this.landmarker.detectForVideo(video, performance.now());

    if (!result.landmarks || result.landmarks.length === 0) {
      return { hasValidPose: false, confidence: 0 };
    }

    // Simple confidence calculation
    const landmarks = result.landmarks[0];
    const avgVisibility = landmarks.reduce((sum, l) => sum + l.visibility, 0) / landmarks.length;

    return {
      hasValidPose: avgVisibility > 0.5,
      confidence: avgVisibility,
    };
  }

  dispose(): void {
    if (this.landmarker) {
      this.landmarker.close();
      this.landmarker = null;
    }
  }
}

describe('MediaPipe Mock Usage Example', () => {
  let service: SimplePoseService;

  beforeEach(() => {
    resetMockMediaPipeConfig();
    MockPoseLandmarker.closeAll();

    // Mock the MediaPipe module
    vi.doMock('@mediapipe/tasks-vision', () => ({
      FilesetResolver: {
        forVisionTasks: vi.fn().mockResolvedValue({
          wasmLoaderPath: 'mock/path',
          wasmBinaryPath: 'mock/path',
          assetLoaderPath: 'mock/path',
        }),
      },
      PoseLandmarker: MockPoseLandmarker,
    }));

    service = new SimplePoseService();
  });

  afterEach(() => {
    service.dispose();
    vi.clearAllMocks();
  });

  describe('Service Initialization', () => {
    it('should initialize successfully', async () => {
      await expect(service.initialize()).resolves.not.toThrow();
      expect(MockPoseLandmarker.getCreateFromOptionsCallCount()).toBe(1);
    });

    it('should handle initialization failure', async () => {
      setMockMediaPipeConfig({
        shouldFailInit: true,
        initFailureMessage: 'Failed to load model',
      });

      await expect(service.initialize()).rejects.toThrow('Failed to load model');
    });

    it('should simulate slow initialization', async () => {
      setMockMediaPipeConfig({ initializationDelay: 100 });

      const start = performance.now();
      await service.initialize();
      const duration = performance.now() - start;

      expect(duration).toBeGreaterThanOrEqual(90);
    });
  });

  describe('Pose Detection', () => {
    it('should detect valid pose with high confidence', async () => {
      await service.initialize();

      const video = createMockVideoElement();
      const result = service.detectPose(video);

      expect(result.hasValidPose).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(MockPoseLandmarker.getDetectForVideoCallCount()).toBe(1);
    });

    it('should handle detection with custom landmarks', async () => {
      // Configure mock to return specific squat pose
      setMockMediaPipeConfig({
        customResult: SQUAT_FIXTURES.properDepth,
      });

      await service.initialize();

      const video = createMockVideoElement();
      const result = service.detectPose(video);

      expect(result.hasValidPose).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('should handle failed detection', async () => {
      setMockMediaPipeConfig({
        shouldFail: true,
        failureMessage: 'Camera disconnected',
      });

      await service.initialize();

      const video = createMockVideoElement();
      expect(() => service.detectPose(video)).toThrow('Camera disconnected');
    });

    it('should handle low confidence detection', async () => {
      setMockMediaPipeConfig({
        customResult: {
          landmarks: [
            Array(33)
              .fill(null)
              .map(() => ({
                x: Math.random(),
                y: Math.random(),
                z: 0,
                visibility: 0.3, // Low visibility
              })),
          ],
          worldLandmarks: [],
          segmentationMasks: undefined,
          close: () => {
            /* noop */
          },
        },
      });

      await service.initialize();

      const video = createMockVideoElement();
      const result = service.detectPose(video);

      expect(result.hasValidPose).toBe(false);
      expect(result.confidence).toBeLessThan(0.5);
    });

    it('should simulate processing delay', async () => {
      setMockMediaPipeConfig({ processingDelay: 30 });

      await service.initialize();

      const video = createMockVideoElement();
      const start = performance.now();
      service.detectPose(video);
      const duration = performance.now() - start;

      expect(duration).toBeGreaterThanOrEqual(25);
    });
  });

  describe('Performance Testing', () => {
    it('should handle rapid frame processing', async () => {
      await service.initialize();

      const video = createMockVideoElement();
      const results = [];

      // Simulate 30 FPS for 1 second
      for (let i = 0; i < 30; i++) {
        results.push(service.detectPose(video));
      }

      expect(results).toHaveLength(30);
      expect(results.every((r) => r.hasValidPose)).toBe(true);
      expect(MockPoseLandmarker.getDetectForVideoCallCount()).toBe(30);
    });
  });

  describe('Resource Management', () => {
    it('should properly dispose resources', async () => {
      await service.initialize();

      const instancesBefore = MockPoseLandmarker.getInstances().length;
      expect(instancesBefore).toBeGreaterThan(0);

      service.dispose();

      const instancesAfter = MockPoseLandmarker.getInstances().length;
      expect(instancesAfter).toBe(instancesBefore - 1);
    });

    it('should handle multiple service instances', async () => {
      const service2 = new SimplePoseService();

      await service.initialize();
      await service2.initialize();

      expect(MockPoseLandmarker.getInstances()).toHaveLength(2);

      service.dispose();
      expect(MockPoseLandmarker.getInstances()).toHaveLength(1);

      service2.dispose();
      expect(MockPoseLandmarker.getInstances()).toHaveLength(0);
    });
  });
});
