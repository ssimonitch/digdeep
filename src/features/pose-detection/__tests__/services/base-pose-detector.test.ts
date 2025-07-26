import type { PoseLandmarkerOptions } from '@mediapipe/tasks-vision';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type ErrorContext, errorMonitor } from '@/shared/services/error-monitor.service';
import { performanceMonitor } from '@/shared/services/performance-monitor.service';

import { BasePoseDetector } from '../../services/core/base-pose-detector';
import {
  createLowConfidenceResult,
  createMockVideoElement,
  MockPoseLandmarker,
  type MockVisionModule,
  resetMockMediaPipeConfig,
  setMockMediaPipeConfig,
} from '../mocks/mediapipe-mocks';

// Mock the MediaPipe imports first (before other imports to avoid hoisting issues)
vi.mock('@mediapipe/tasks-vision', async () => {
  const mocks = await import('../mocks/mediapipe-mocks');
  return {
    FilesetResolver: mocks.MockFilesetResolver,
    PoseLandmarker: mocks.MockPoseLandmarker,
  };
});

// Mock the error and performance monitors
vi.mock('@/shared/services/error-monitor.service');
vi.mock('@/shared/services/performance-monitor.service');

// Concrete test implementation of BasePoseDetector for testing
class ConcretePoseDetector extends BasePoseDetector {
  // No need to expose internals - test public interface only
}

describe('BasePoseDetector', () => {
  let detector: ConcretePoseDetector;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Reset mock configuration to defaults
    resetMockMediaPipeConfig();

    // Create detector instance
    detector = new ConcretePoseDetector();
  });

  afterEach(() => {
    vi.useRealTimers();
    detector?.cleanup();
  });

  describe('Configuration', () => {
    it('should start performance monitor during initialization', () => {
      // Performance monitor should be started when detector is created
      expect(performanceMonitor.start).toHaveBeenCalled();
    });

    it('should be ready after successful initialization', async () => {
      await detector.initialize();
      expect(detector.isReady()).toBe(true);
    });

    describe('Configuration Validation', () => {
      it('should throw error for invalid delegate', () => {
        expect(() => {
          new ConcretePoseDetector({ delegate: 'INVALID' as 'GPU' });
        }).toThrow("Invalid delegate: INVALID. Must be 'GPU' or 'CPU'");
      });

      it('should throw error for invalid runningMode', () => {
        expect(() => {
          new ConcretePoseDetector({ runningMode: 'STREAM' as 'VIDEO' });
        }).toThrow("Invalid runningMode: STREAM. Must be 'VIDEO' or 'IMAGE'");
      });

      it('should throw error for invalid numPoses', () => {
        expect(() => {
          new ConcretePoseDetector({ numPoses: 0 });
        }).toThrow('Invalid numPoses: 0. Must be a positive integer');

        expect(() => {
          new ConcretePoseDetector({ numPoses: -1 });
        }).toThrow('Invalid numPoses: -1. Must be a positive integer');

        expect(() => {
          new ConcretePoseDetector({ numPoses: 1.5 });
        }).toThrow('Invalid numPoses: 1.5. Must be a positive integer');
      });

      it('should throw error for invalid confidence values', () => {
        expect(() => {
          new ConcretePoseDetector({ minPoseDetectionConfidence: -0.1 });
        }).toThrow('Invalid minPoseDetectionConfidence: -0.1. Must be a number between 0 and 1');

        expect(() => {
          new ConcretePoseDetector({ minPosePresenceConfidence: 1.5 });
        }).toThrow('Invalid minPosePresenceConfidence: 1.5. Must be a number between 0 and 1');

        expect(() => {
          new ConcretePoseDetector({ minTrackingConfidence: 2 });
        }).toThrow('Invalid minTrackingConfidence: 2. Must be a number between 0 and 1');
      });

      it('should accept valid edge case confidence values', () => {
        expect(() => {
          new ConcretePoseDetector({
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
      await detector.initialize();

      // Check that detector is ready after initialization
      expect(detector.isReady()).toBe(true);

      // Verify error monitoring was called for initialization
      expect(errorMonitor.reportError).toHaveBeenCalledWith(
        expect.stringContaining('initialized successfully'),
        'custom',
        'low',
        expect.any(Object),
      );
    });

    it('should handle already initialized state', async () => {
      await detector.initialize();
      expect(detector.isReady()).toBe(true);

      // Second initialization should return early and not change ready state
      await detector.initialize();
      expect(detector.isReady()).toBe(true);
    });

    it('should prevent concurrent initialization', async () => {
      // Start two initializations concurrently
      const init1 = detector.initialize();
      const init2 = detector.initialize();

      await Promise.all([init1, init2]);

      // Should still be ready after concurrent initialization
      expect(detector.isReady()).toBe(true);
    });

    it('should report initialization timing', async () => {
      await detector.initialize();

      // Verify initialization start was reported
      expect(errorMonitor.reportError).toHaveBeenCalledWith(
        'Starting MediaPipe pose detection initialization',
        'custom',
        'low',
        expect.any(Object),
      );

      // Verify successful initialization was reported
      expect(errorMonitor.reportError).toHaveBeenCalledWith(
        expect.stringMatching(/MediaPipe pose detection initialized successfully in \d+\.\d+ms/),
        'custom',
        'low',
        expect.any(Object),
      );
    });
  });

  describe('Frame Processing', () => {
    beforeEach(async () => {
      await detector.initialize();
      // Advance time to ensure first frame isn't throttled
      vi.advanceTimersByTime(40);
    });

    it('should process video frames successfully', () => {
      const mockVideo = createMockVideoElement();
      // Use default mock configuration (creates valid landmarks)

      const result = detector.detectPose(mockVideo);

      expect(result).toBeDefined();
      expect(result.landmarks).toBeDefined();
      expect(result.timestamp).toBeGreaterThan(0);
      expect(result.processingTime).toBeGreaterThanOrEqual(0);

      // Check that confidence is calculated correctly
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.isValid).toBe(true);

      // Verify performance monitoring was called
      expect(performanceMonitor.recordOperation).toHaveBeenCalledWith({
        name: 'poseDetection',
        processingTime: expect.any(Number) as number,
        timestamp: expect.any(Number) as number,
        success: true,
      });
    });

    it('should calculate confidence based on landmark visibility', () => {
      const mockVideo = createMockVideoElement();

      // Test high confidence with default landmarks
      const highConfResult = detector.detectPose(mockVideo);
      expect(highConfResult.confidence).toBeGreaterThan(0.5);
      expect(highConfResult.isValid).toBe(true);

      // Test low confidence with low visibility result
      setMockMediaPipeConfig({ customResult: createLowConfidenceResult() });
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
      const uninitializedDetector = new ConcretePoseDetector();
      const mockVideo = createMockVideoElement();

      expect(() => uninitializedDetector.detectPose(mockVideo)).toThrow('Pose detector not initialized');
    });

    it('should handle detection errors gracefully', () => {
      const mockVideo = createMockVideoElement();
      // Configure mock to fail detection
      setMockMediaPipeConfig({ shouldFail: true, failureMessage: 'Detection failed' });

      const result = detector.detectPose(mockVideo);

      expect(result.landmarks).toBeNull();
      expect(result.confidence).toBe(0);
      expect(result.isValid).toBe(false);
      expect(result.processingTime).toBeGreaterThanOrEqual(0);

      // Verify error was reported
      expect(errorMonitor.reportError).toHaveBeenCalledWith(
        'Pose detection failed',
        'custom',
        'high',
        expect.objectContaining({
          error: 'Detection failed',
          videoElementReady: true,
        }),
      );

      // Verify failed operation was recorded
      expect(performanceMonitor.recordOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'poseDetection',
          success: false,
        }),
      );
    });
  });

  describe('GPU/CPU Fallback', () => {
    it('should attempt GPU initialization by default', async () => {
      detector = new ConcretePoseDetector();
      await detector.initialize();

      // Check that detector is ready after successful initialization
      expect(detector.isReady()).toBe(true);

      // Verify initialization was reported (default GPU attempt)
      expect(errorMonitor.reportError).toHaveBeenCalledWith(
        expect.stringContaining('initialized successfully'),
        'custom',
        'low',
        expect.any(Object),
      );
    });

    it('should fallback to CPU when GPU fails', async () => {
      detector = new ConcretePoseDetector();

      // Override createFromOptions to fail on first call (GPU), succeed on second (CPU)
      let initAttempt = 0;
      const originalCreateFromOptions = MockPoseLandmarker.createFromOptions;
      MockPoseLandmarker.createFromOptions = vi
        .fn()
        .mockImplementation(async (vision: MockVisionModule, options: PoseLandmarkerOptions) => {
          initAttempt++;
          if (initAttempt === 1 && options.baseOptions?.delegate === 'GPU') {
            throw new Error('GPU not supported');
          }
          return originalCreateFromOptions(vision, options);
        });

      await detector.initialize();

      // Should be ready after fallback
      expect(detector.isReady()).toBe(true);

      // Should have attempted initialization twice
      expect(MockPoseLandmarker.createFromOptions).toHaveBeenCalledTimes(2);

      // Verify fallback message was reported
      expect(errorMonitor.reportError).toHaveBeenCalledWith(
        'GPU acceleration failed, attempting CPU fallback',
        'custom',
        'medium',
        expect.any(Object),
      );

      // Restore original method
      MockPoseLandmarker.createFromOptions = originalCreateFromOptions;
    });

    it('should not retry fallback if starting with CPU', async () => {
      detector = new ConcretePoseDetector({ delegate: 'CPU' });

      // Configure mock to fail initialization
      setMockMediaPipeConfig({
        shouldFailInit: true,
        initFailureMessage: 'CPU failed',
      });

      await expect(detector.initialize()).rejects.toThrow('CPU failed');

      // Should not be ready after failed CPU initialization
      expect(detector.isReady()).toBe(false);
    });

    it('should throw if both GPU and CPU fail', async () => {
      detector = new ConcretePoseDetector();

      // Configure mock to fail all initialization attempts
      setMockMediaPipeConfig({
        shouldFailInit: true,
        initFailureMessage: 'Init failed',
      });

      await expect(detector.initialize()).rejects.toThrow('Init failed');

      // Should not be ready after failed initialization
      expect(detector.isReady()).toBe(false);

      // Verify critical failure was reported
      expect(errorMonitor.reportError).toHaveBeenCalledWith(
        'Failed to initialize MediaPipe pose detection',
        'custom',
        'critical',
        expect.any(Object),
      );
    });
  });

  describe('Resource Management & Cleanup', () => {
    it('should cleanup resources properly', async () => {
      detector = new ConcretePoseDetector();
      await detector.initialize();

      // Verify detector is ready before cleanup
      expect(detector.isReady()).toBe(true);

      detector.cleanup();

      // Verify detector is no longer ready after cleanup
      expect(detector.isReady()).toBe(false);
    });

    it('should handle cleanup errors gracefully', async () => {
      detector = new ConcretePoseDetector();
      await detector.initialize();

      // Override close method to throw error
      const mockInstances = MockPoseLandmarker.getInstances();
      if (mockInstances.length > 0) {
        const mockClose = vi.fn().mockImplementation(() => {
          throw new Error('Close failed');
        });
        mockInstances[0].close = mockClose;
      }

      expect(() => detector.cleanup()).not.toThrow();

      // Verify cleanup error was reported
      expect(errorMonitor.reportError).toHaveBeenCalledWith(
        'Error during pose detector cleanup',
        'custom',
        'medium',
        expect.any(Object),
      );
    });

    it('should report final metrics on cleanup', async () => {
      detector = new ConcretePoseDetector();
      await detector.initialize();

      // Process some frames
      const mockVideo = createMockVideoElement();
      detector.detectPose(mockVideo);
      vi.advanceTimersByTime(40);
      detector.detectPose(mockVideo);

      detector.cleanup();

      // Verify cleanup metrics were reported
      expect(errorMonitor.reportError).toHaveBeenCalledWith(
        'BasePoseDetector cleanup completed',
        'custom',
        'low',
        expect.objectContaining<ErrorContext>({
          finalMetrics: expect.objectContaining({
            totalFrames: expect.any(Number) as number,
            successfulDetections: expect.any(Number) as number,
            successRate: expect.any(Number) as number,
          }),
        }),
      );
    });

    it('should allow re-initialization after cleanup', async () => {
      detector = new ConcretePoseDetector();

      await detector.initialize();
      expect(detector.isReady()).toBe(true);

      detector.cleanup();
      expect(detector.isReady()).toBe(false);

      await detector.initialize();
      expect(detector.isReady()).toBe(true);
    });
  });

  describe('isReady', () => {
    it('should return false when not initialized', () => {
      const newDetector = new ConcretePoseDetector();
      expect(newDetector.isReady()).toBe(false);
    });

    it('should return true when initialized', async () => {
      const newDetector = new ConcretePoseDetector();
      await newDetector.initialize();
      expect(newDetector.isReady()).toBe(true);
      newDetector.cleanup();
    });

    it('should return false after cleanup', async () => {
      const newDetector = new ConcretePoseDetector();
      await newDetector.initialize();
      newDetector.cleanup();
      expect(newDetector.isReady()).toBe(false);
    });
  });

  describe('Performance Requirements', () => {
    beforeEach(async () => {
      vi.clearAllMocks();
      detector = new ConcretePoseDetector();
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

      // Verify performance operations were recorded
      expect(performanceMonitor.recordOperation).toHaveBeenCalled();
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

      // Configure mock to fail detection
      setMockMediaPipeConfig({ shouldFail: true, failureMessage: 'Detection failed' });

      const result = detector.detectPose(mockVideo);

      // Even failed detections should have processing time
      expect(result.processingTime).toBeGreaterThanOrEqual(0);
      expect(result.processingTime).toBeLessThan(33); // Should still be fast even when failing

      // Performance should be recorded even for failures
      expect(performanceMonitor.recordOperation).toHaveBeenCalledWith(
        expect.objectContaining<ErrorContext>({
          name: 'poseDetection',
          success: false,
          processingTime: expect.any(Number) as number,
          timestamp: expect.any(Number) as number,
        }),
      );
    });
  });
});
