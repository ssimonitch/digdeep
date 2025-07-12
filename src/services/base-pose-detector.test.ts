import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { errorMonitor } from '@/shared/services/error-monitor.service';
import { performanceMonitor } from '@/shared/services/performance-monitor.service';
import { createDefaultLandmarks, createMockPoseResult } from '@/test/pose-detection/fixtures/landmark-fixtures';
import { createLowConfidenceResult, createMockVideoElement } from '@/test/pose-detection/mocks/mediapipe-mocks';

import { BasePoseDetector, type PoseDetectorConfig } from './base-pose-detector';

// Mock the MediaPipe imports
vi.mock('@mediapipe/tasks-vision', () => ({
  FilesetResolver: {
    forVisionTasks: vi.fn(),
  },
  PoseLandmarker: {
    createFromOptions: vi.fn(),
  },
}));

// Mock the error and performance monitors
vi.mock('@/shared/services/error-monitor.service', () => ({
  errorMonitor: {
    reportError: vi.fn(),
  },
}));

vi.mock('@/shared/services/performance-monitor.service', () => ({
  performanceMonitor: {
    start: vi.fn(),
    recordOperation: vi.fn(),
  },
}));

// Test implementation of BasePoseDetector
class TestPoseDetector extends BasePoseDetector {
  // Expose protected members for testing
  getState() {
    return {
      isInitialized: this.isInitialized,
      isInitializing: this.isInitializing,
      poseLandmarker: this.poseLandmarker,
      config: this.config,
      lastFrameTime: this.lastFrameTime,
      totalFrames: this.totalFrames,
      successfulDetections: this.successfulDetections,
    };
  }
}

describe('BasePoseDetector', () => {
  let detector: TestPoseDetector;
  let mockForVisionTasks: Mock;
  let mockCreateFromOptions: Mock;
  let mockReportError: Mock;
  let mockRecordOperation: Mock;
  let mockPoseLandmarker: {
    detectForVideo: Mock;
    close: Mock;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Setup mocks
    mockForVisionTasks = FilesetResolver.forVisionTasks as Mock;
    mockCreateFromOptions = PoseLandmarker.createFromOptions as Mock;
    mockReportError = errorMonitor.reportError as Mock;
    mockRecordOperation = performanceMonitor.recordOperation as Mock;

    // Create mock PoseLandmarker
    mockPoseLandmarker = {
      detectForVideo: vi.fn(),
      close: vi.fn(),
    };

    // Setup default successful mocks
    mockForVisionTasks.mockResolvedValue({});
    mockCreateFromOptions.mockResolvedValue(mockPoseLandmarker);
    mockPoseLandmarker.detectForVideo.mockReturnValue(createMockPoseResult(createDefaultLandmarks()));
  });

  afterEach(() => {
    vi.useRealTimers();
    if (detector) {
      detector.cleanup();
    }
  });

  describe('Configuration', () => {
    it('should initialize with default configuration', () => {
      detector = new TestPoseDetector();

      const state = detector.getState();
      expect(state.config).toMatchObject({
        delegate: 'GPU',
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
        outputSegmentationMasks: false,
      });

      // Performance monitor should be started
      expect(performanceMonitor.start).toHaveBeenCalled();
    });

    it('should accept custom configuration', () => {
      const customConfig: PoseDetectorConfig = {
        delegate: 'CPU',
        runningMode: 'IMAGE',
        numPoses: 2,
        minPoseDetectionConfidence: 0.7,
        minPosePresenceConfidence: 0.8,
        minTrackingConfidence: 0.9,
        outputSegmentationMasks: true,
      };

      detector = new TestPoseDetector(customConfig);

      const state = detector.getState();
      expect(state.config).toMatchObject(customConfig);
    });

    describe('Validation', () => {
      it('should throw error for invalid delegate', () => {
        expect(() => {
          new TestPoseDetector({ delegate: 'INVALID' as 'GPU' });
        }).toThrow("Invalid delegate: INVALID. Must be 'GPU' or 'CPU'");
      });

      it('should throw error for invalid runningMode', () => {
        expect(() => {
          new TestPoseDetector({ runningMode: 'STREAM' as 'VIDEO' });
        }).toThrow("Invalid runningMode: STREAM. Must be 'VIDEO' or 'IMAGE'");
      });

      it('should throw error for invalid numPoses', () => {
        expect(() => {
          new TestPoseDetector({ numPoses: 0 });
        }).toThrow('Invalid numPoses: 0. Must be a positive integer');

        expect(() => {
          new TestPoseDetector({ numPoses: -1 });
        }).toThrow('Invalid numPoses: -1. Must be a positive integer');

        expect(() => {
          new TestPoseDetector({ numPoses: 1.5 });
        }).toThrow('Invalid numPoses: 1.5. Must be a positive integer');
      });

      it('should throw error for invalid confidence values', () => {
        expect(() => {
          new TestPoseDetector({ minPoseDetectionConfidence: -0.1 });
        }).toThrow('Invalid minPoseDetectionConfidence: -0.1. Must be a number between 0 and 1');

        expect(() => {
          new TestPoseDetector({ minPosePresenceConfidence: 1.5 });
        }).toThrow('Invalid minPosePresenceConfidence: 1.5. Must be a number between 0 and 1');

        expect(() => {
          new TestPoseDetector({ minTrackingConfidence: 2 });
        }).toThrow('Invalid minTrackingConfidence: 2. Must be a number between 0 and 1');
      });

      it('should accept edge case confidence values', () => {
        expect(() => {
          new TestPoseDetector({
            minPoseDetectionConfidence: 0,
            minPosePresenceConfidence: 1,
            minTrackingConfidence: 0.5,
          });
        }).not.toThrow();
      });
    });
  });

  describe('Initialization', () => {
    it('should initialize MediaPipe successfully', async () => {
      detector = new TestPoseDetector();

      await detector.initialize();

      // Check FilesetResolver was called with correct CDN
      expect(mockForVisionTasks).toHaveBeenCalledWith(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm',
      );

      // Check PoseLandmarker was created with correct options
      expect(mockCreateFromOptions).toHaveBeenCalled();
      const [visionModule, options] = mockCreateFromOptions.mock.calls[0] as [unknown, Record<string, unknown>];
      expect(visionModule).toBeDefined();
      const baseOptions = options.baseOptions as { modelAssetPath: string; delegate: string };
      expect(baseOptions.modelAssetPath).toContain('pose_landmarker_lite.task');
      expect(baseOptions.delegate).toBe('GPU');
      expect(options.runningMode).toBe('VIDEO');
      expect(options.numPoses).toBe(1);

      // Check state after initialization
      const state = detector.getState();
      expect(state.isInitialized).toBe(true);
      expect(state.isInitializing).toBe(false);
      expect(state.poseLandmarker).toBeTruthy();
    });

    it('should handle already initialized state', async () => {
      detector = new TestPoseDetector();

      await detector.initialize();
      const firstCallCount = mockCreateFromOptions.mock.calls.length;

      // Second initialization should return early
      await detector.initialize();

      expect(mockCreateFromOptions).toHaveBeenCalledTimes(firstCallCount);
    });

    it('should prevent concurrent initialization', async () => {
      detector = new TestPoseDetector();

      // Start two initializations concurrently
      const init1 = detector.initialize();
      const init2 = detector.initialize();

      await Promise.all([init1, init2]);

      // PoseLandmarker should only be created once
      expect(mockCreateFromOptions).toHaveBeenCalledTimes(1);
    });

    it('should report initialization timing', async () => {
      detector = new TestPoseDetector();

      await detector.initialize();

      expect(mockReportError).toHaveBeenCalled();
      const initCall = mockReportError.mock.calls.find(
        (call) => call[0] === 'Starting MediaPipe pose detection initialization',
      ) as [string, string, string, unknown];
      expect(initCall).toBeTruthy();
      expect(initCall[1]).toBe('custom');
      expect(initCall[2]).toBe('low');

      const successCall = mockReportError.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('MediaPipe pose detection initialized successfully'),
      ) as [string, string, string, unknown];
      expect(successCall).toBeTruthy();
      expect(successCall[0]).toMatch(/MediaPipe pose detection initialized successfully in \d+\.\d+ms/);
      expect(successCall[1]).toBe('custom');
      expect(successCall[2]).toBe('low');
    });
  });

  describe('Frame Processing', () => {
    beforeEach(async () => {
      detector = new TestPoseDetector();
      await detector.initialize();
      // Advance time to ensure first frame isn't throttled
      vi.advanceTimersByTime(40);
    });

    it('should process video frames successfully', () => {
      const mockVideo = createMockVideoElement();
      const mockResult = createMockPoseResult(createDefaultLandmarks());
      mockPoseLandmarker.detectForVideo.mockReturnValue(mockResult);

      const result = detector.detectPose(mockVideo);

      expect(result).toBeDefined();
      expect(result.landmarks).toBe(mockResult);
      expect(result.timestamp).toBeGreaterThan(0);
      expect(result.processingTime).toBeGreaterThanOrEqual(0);

      // Check that confidence is calculated correctly
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.isValid).toBe(true);

      expect(mockPoseLandmarker.detectForVideo).toHaveBeenCalled();
      const detectCall = mockPoseLandmarker.detectForVideo.mock.calls[0] as [HTMLVideoElement, number];
      expect(detectCall[0]).toBe(mockVideo);
      expect(detectCall[1]).toBeGreaterThan(0);

      expect(mockRecordOperation).toHaveBeenCalled();
      const recordCall = mockRecordOperation.mock.calls[0] as [
        { name: string; processingTime: number; timestamp: number; success: boolean },
      ];
      expect(recordCall[0].name).toBe('poseDetection');
      expect(recordCall[0].processingTime).toBeGreaterThanOrEqual(0);
      expect(recordCall[0].timestamp).toBeGreaterThan(0);
      expect(recordCall[0].success).toBe(true);
    });

    it('should calculate confidence based on landmark visibility', () => {
      const mockVideo = createMockVideoElement();

      // Test high confidence
      const highVisResult = createMockPoseResult(createDefaultLandmarks());
      mockPoseLandmarker.detectForVideo.mockReturnValue(highVisResult);

      const highConfResult = detector.detectPose(mockVideo);
      expect(highConfResult.confidence).toBeGreaterThan(0.8);
      expect(highConfResult.isValid).toBe(true);

      // Test low confidence
      const lowVisResult = createLowConfidenceResult();
      mockPoseLandmarker.detectForVideo.mockReturnValue(lowVisResult);

      const lowConfResult = detector.detectPose(mockVideo);
      expect(lowConfResult.confidence).toBeLessThan(0.5);
      expect(lowConfResult.isValid).toBe(false);
    });

    it('should throttle frames to maintain 30 FPS', () => {
      const mockVideo = createMockVideoElement();

      // First frame should process
      const result1 = detector.detectPose(mockVideo);
      expect(result1.landmarks).toBeTruthy();
      expect(result1.confidence).toBeGreaterThan(0.5);
      expect(result1.isValid).toBe(true);

      // Immediate second frame should be throttled
      const result2 = detector.detectPose(mockVideo);
      expect(result2.isValid).toBe(false);
      expect(result2.processingTime).toBe(0);

      // After 34ms, should process again
      vi.advanceTimersByTime(34);
      const result3 = detector.detectPose(mockVideo);
      expect(result3.landmarks).toBeTruthy();
      expect(result3.confidence).toBeGreaterThan(0.5);
      expect(result3.isValid).toBe(true);
    });

    it('should throw error when not initialized', () => {
      const uninitializedDetector = new TestPoseDetector();
      const mockVideo = createMockVideoElement();

      expect(() => uninitializedDetector.detectPose(mockVideo)).toThrow('Pose detector not initialized');
    });

    it('should handle detection errors gracefully', () => {
      const mockVideo = createMockVideoElement();
      mockPoseLandmarker.detectForVideo.mockImplementation(() => {
        throw new Error('Detection failed');
      });

      const result = detector.detectPose(mockVideo);

      expect(result.landmarks).toBeNull();
      expect(result.confidence).toBe(0);
      expect(result.isValid).toBe(false);
      expect(result.processingTime).toBeGreaterThanOrEqual(0);

      // Check that error was reported
      expect(mockReportError).toHaveBeenCalledWith(
        'Pose detection failed',
        'custom',
        'high',
        expect.objectContaining({
          error: 'Detection failed',
          videoElementReady: true,
        }),
      );

      const failedOperation = mockRecordOperation.mock.calls.find(
        (call) => (call[0] as { success: boolean }).success === false,
      );
      expect(failedOperation).toBeTruthy();
    });
  });

  describe('GPU/CPU Fallback', () => {
    it('should attempt GPU initialization by default', async () => {
      detector = new TestPoseDetector();
      await detector.initialize();

      expect(mockCreateFromOptions).toHaveBeenCalled();
      const [, options] = mockCreateFromOptions.mock.calls[0] as [unknown, { baseOptions: { delegate: string } }];
      expect(options.baseOptions.delegate).toBe('GPU');
    });

    it('should fallback to CPU when GPU fails', async () => {
      detector = new TestPoseDetector();

      // GPU fails, CPU succeeds
      mockCreateFromOptions
        .mockRejectedValueOnce(new Error('GPU not supported'))
        .mockResolvedValueOnce(mockPoseLandmarker);

      await detector.initialize();

      // Should try GPU then CPU
      expect(mockCreateFromOptions).toHaveBeenCalledTimes(2);
      const firstCall = mockCreateFromOptions.mock.calls[0] as [unknown, { baseOptions: { delegate: string } }];
      const secondCall = mockCreateFromOptions.mock.calls[1] as [unknown, { baseOptions: { delegate: string } }];
      expect(firstCall[1].baseOptions.delegate).toBe('GPU');
      expect(secondCall[1].baseOptions.delegate).toBe('CPU');

      const fallbackCall = mockReportError.mock.calls.find(
        (call) => call[0] === 'GPU acceleration failed, attempting CPU fallback',
      ) as [string, string, string, unknown];
      expect(fallbackCall).toBeTruthy();
      expect(fallbackCall[1]).toBe('custom');
      expect(fallbackCall[2]).toBe('medium');

      const state = detector.getState();
      expect(state.config.delegate).toBe('CPU');
      expect(state.isInitialized).toBe(true);
    });

    it('should not retry fallback if starting with CPU', async () => {
      detector = new TestPoseDetector({ delegate: 'CPU' });
      mockCreateFromOptions.mockRejectedValue(new Error('CPU failed'));

      await expect(detector.initialize()).rejects.toThrow('CPU failed');

      // Should only try once
      expect(mockCreateFromOptions).toHaveBeenCalledTimes(1);
    });

    it('should throw if both GPU and CPU fail', async () => {
      detector = new TestPoseDetector();
      mockCreateFromOptions.mockRejectedValue(new Error('Init failed'));

      await expect(detector.initialize()).rejects.toThrow('Init failed');

      expect(mockCreateFromOptions).toHaveBeenCalledTimes(2); // GPU + CPU
      const failCall = mockReportError.mock.calls.find(
        (call) => call[0] === 'Failed to initialize MediaPipe pose detection',
      ) as [string, string, string, unknown];
      expect(failCall).toBeTruthy();
      expect(failCall[1]).toBe('custom');
      expect(failCall[2]).toBe('critical');
    });
  });

  describe('Resource Management & Cleanup', () => {
    it('should cleanup resources properly', async () => {
      detector = new TestPoseDetector();
      await detector.initialize();

      detector.cleanup();

      expect(mockPoseLandmarker.close).toHaveBeenCalled();

      const state = detector.getState();
      expect(state.isInitialized).toBe(false);
      expect(state.isInitializing).toBe(false);
      expect(state.poseLandmarker).toBeNull();
    });

    it('should handle cleanup errors gracefully', async () => {
      detector = new TestPoseDetector();
      await detector.initialize();

      mockPoseLandmarker.close.mockImplementation(() => {
        throw new Error('Close failed');
      });

      expect(() => detector.cleanup()).not.toThrow();

      const cleanupErrorCall = mockReportError.mock.calls.find(
        (call) => call[0] === 'Error during pose detector cleanup',
      ) as [string, string, string, unknown];
      expect(cleanupErrorCall).toBeTruthy();
      expect(cleanupErrorCall[1]).toBe('custom');
      expect(cleanupErrorCall[2]).toBe('medium');
    });

    it('should report final metrics on cleanup', async () => {
      detector = new TestPoseDetector();
      await detector.initialize();

      // Process some frames
      const mockVideo = createMockVideoElement();
      detector.detectPose(mockVideo);
      vi.advanceTimersByTime(40);
      detector.detectPose(mockVideo);

      detector.cleanup();

      // Check that cleanup metrics were reported
      const cleanupCall = mockReportError.mock.calls.find(
        (call) => call[0] === 'OptimizedPoseDetector cleanup completed',
      );
      expect(cleanupCall).toBeTruthy();
      // Check the actual frame count recorded
      const callData = cleanupCall?.[3] as {
        finalMetrics: {
          totalFrames: number;
          successfulDetections: number;
          successRate: number;
        };
      };
      expect(callData.finalMetrics.totalFrames).toBeGreaterThan(0);
      expect(callData.finalMetrics.successfulDetections).toBe(callData.finalMetrics.totalFrames);
      expect(callData.finalMetrics.successRate).toBe(1.0);
    });

    it('should allow re-initialization after cleanup', async () => {
      detector = new TestPoseDetector();

      await detector.initialize();
      detector.cleanup();
      await detector.initialize();

      expect(mockCreateFromOptions).toHaveBeenCalledTimes(2);
      expect(detector.isReady()).toBe(true);
    });
  });

  describe('isReady', () => {
    it('should return false when not initialized', () => {
      detector = new TestPoseDetector();
      expect(detector.isReady()).toBe(false);
    });

    it('should return true when initialized', async () => {
      detector = new TestPoseDetector();
      await detector.initialize();
      expect(detector.isReady()).toBe(true);
    });

    it('should return false after cleanup', async () => {
      detector = new TestPoseDetector();
      await detector.initialize();
      detector.cleanup();
      expect(detector.isReady()).toBe(false);
    });
  });

  describe('Performance Requirements', () => {
    beforeEach(async () => {
      vi.clearAllMocks();
      detector = new TestPoseDetector();
      await detector.initialize();
      vi.clearAllMocks(); // Clear initialization calls to start fresh
    });

    it('should process frames within 33ms target', () => {
      const mockVideo = createMockVideoElement();
      const iterations = 10;
      const processingTimes: number[] = [];

      // Warm up frame
      detector.detectPose(mockVideo);
      vi.advanceTimersByTime(40);

      // Measure processing times
      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        mockPoseLandmarker.detectForVideo.mockReturnValue(createMockPoseResult(createDefaultLandmarks()));
        const result = detector.detectPose(mockVideo);
        const endTime = performance.now();

        // Use actual measured time instead of mocked processingTime
        const actualProcessingTime = endTime - startTime;
        processingTimes.push(actualProcessingTime);

        expect(result.isValid).toBe(true);
        vi.advanceTimersByTime(40);
      }

      const avgProcessingTime = processingTimes.reduce((a, b) => a + b, 0) / iterations;
      const maxProcessingTime = Math.max(...processingTimes);

      // Processing should complete well within 33ms (30 FPS requirement)
      expect(avgProcessingTime).toBeLessThan(33);
      expect(maxProcessingTime).toBeLessThan(33);

      // Verify performance was recorded (warm-up frame may be throttled)
      expect(mockRecordOperation.mock.calls.length).toBeGreaterThanOrEqual(iterations);
    });

    it('should maintain consistent performance across multiple frames', () => {
      const mockVideo = createMockVideoElement();
      const iterations = 50;
      const processingTimes: number[] = [];

      // Process many frames to check for performance degradation
      for (let i = 0; i < iterations; i++) {
        if (i > 0) {
          vi.advanceTimersByTime(40);
        }

        const result = detector.detectPose(mockVideo);
        if (result.isValid) {
          processingTimes.push(result.processingTime);
        }
      }

      // Calculate standard deviation to check consistency
      const avg = processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length;
      const variance = processingTimes.reduce((sum, time) => sum + Math.pow(time - avg, 2), 0) / processingTimes.length;
      const stdDev = Math.sqrt(variance);

      // Standard deviation should be low (consistent performance)
      expect(stdDev).toBeLessThan(5); // Within 5ms variation

      // No significant performance degradation from first to last frames
      const firstHalf = processingTimes.slice(0, Math.floor(processingTimes.length / 2));
      const secondHalf = processingTimes.slice(Math.floor(processingTimes.length / 2));
      const firstHalfAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const secondHalfAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

      // Performance should not degrade significantly over time
      expect(Math.abs(secondHalfAvg - firstHalfAvg)).toBeLessThan(5);
    });

    it('should handle performance monitoring for failed detections', () => {
      const mockVideo = createMockVideoElement();

      // Advance time to ensure frame isn't throttled
      vi.advanceTimersByTime(40);

      // Make detection fail
      mockPoseLandmarker.detectForVideo.mockImplementation(() => {
        throw new Error('Detection failed');
      });

      const result = detector.detectPose(mockVideo);

      // Even failed detections should have processing time
      expect(result.processingTime).toBeGreaterThanOrEqual(0);
      expect(result.processingTime).toBeLessThan(33); // Should still be fast even when failing

      // Performance should be recorded even for failures
      expect(mockRecordOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'poseDetection',
          success: false,
          processingTime: expect.any(Number) as number,
          timestamp: expect.any(Number) as number,
        }),
      );
    });
  });
});
