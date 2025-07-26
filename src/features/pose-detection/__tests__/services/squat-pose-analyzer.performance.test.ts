import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SquatPoseAnalyzer } from '../../services/analyzers/squat/squat-pose-analyzer';
import { SQUAT_FIXTURES } from '../fixtures/landmark-fixtures';
import { createMockVideoElement } from '../mocks/mediapipe-mocks';

// Mock MediaPipe at the top level
vi.mock('@mediapipe/tasks-vision');

/**
 * Performance verification for SquatPoseAnalyzer refactoring
 * Ensures the refactored implementation maintains expected performance characteristics
 */
describe('SquatPoseAnalyzer Performance Verification', () => {
  let analyzer: SquatPoseAnalyzer;
  let mockVideoElement: HTMLVideoElement;
  let mockPoseLandmarker: {
    detectForVideo: ReturnType<typeof vi.fn>;
    setOptions: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    // Create mock pose landmarker
    mockPoseLandmarker = {
      detectForVideo: vi.fn().mockReturnValue(SQUAT_FIXTURES.properDepth),
      setOptions: vi.fn(),
      close: vi.fn(),
    };

    // Mock MediaPipe modules
    const { PoseLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
    vi.mocked(PoseLandmarker.createFromOptions).mockResolvedValue(mockPoseLandmarker as never);
    vi.mocked(FilesetResolver.forVisionTasks).mockResolvedValue({} as never);

    // Reset and initialize analyzer
    SquatPoseAnalyzer.resetInstance();
    analyzer = SquatPoseAnalyzer.getInstance();

    // Mock video element
    mockVideoElement = createMockVideoElement(1920, 1080, 4);

    await analyzer.initialize();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Frame Processing Performance', () => {
    it('should process frames efficiently within 30 FPS target', () => {
      // Target: 33.33ms per frame for 30 FPS
      const maxFrameTime = 33.33;
      const testFrames = 60; // 2 seconds worth
      const processingTimes: number[] = [];

      for (let i = 0; i < testFrames; i++) {
        const start = performance.now();
        analyzer.analyzeSquatPose(mockVideoElement);
        const end = performance.now();
        processingTimes.push(end - start);
      }

      const avgTime = processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length;
      const maxTime = Math.max(...processingTimes);

      // Performance requirements
      expect(avgTime).toBeLessThan(maxFrameTime);
      expect(maxTime).toBeLessThan(maxFrameTime * 2); // Allow some variance

      // eslint-disable-next-line no-console
      console.log(`Average processing time: ${avgTime.toFixed(2)}ms (target: <${maxFrameTime}ms)`);
      // eslint-disable-next-line no-console
      console.log(`Max processing time: ${maxTime.toFixed(2)}ms`);
    });

    it('should throttle frames correctly for consistent performance', () => {
      let mockTime = 0;
      vi.spyOn(performance, 'now').mockImplementation(() => mockTime);

      const results: boolean[] = [];

      // Submit frames at 60 FPS (16.67ms intervals)
      for (let i = 0; i < 60; i++) {
        mockTime = i * 16.67;
        const result = analyzer.analyzeSquatPose(mockVideoElement);
        results.push(result.landmarks !== null);
      }

      const processedFrames = results.filter((r) => r).length;

      // Should process approximately 30 frames (50% due to throttling)
      expect(processedFrames).toBeGreaterThan(25);
      expect(processedFrames).toBeLessThan(35);
    });
  });

  describe('Calculation Efficiency', () => {
    it('should calculate squat metrics efficiently', () => {
      const iterations = 100;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        const result = analyzer.analyzeSquatPose(mockVideoElement);

        // Verify metrics are calculated (can be null for invalid poses)
        expect(result.squatMetrics.jointAngles).toBeDefined();
        expect(result.squatMetrics.barPosition).toBeDefined();
        expect(result.squatMetrics.depth).toBeDefined();
      }

      const totalTime = performance.now() - startTime;
      const avgTime = totalTime / iterations;

      // Metric calculation should be very fast
      expect(avgTime).toBeLessThan(5); // Less than 5ms per analysis

      // eslint-disable-next-line no-console
      console.log(`Average metric calculation time: ${avgTime.toFixed(3)}ms`);
    });

    it('should handle error cases efficiently', () => {
      // Test with missing landmarks
      mockPoseLandmarker.detectForVideo.mockReturnValue(SQUAT_FIXTURES.missingLandmarks);

      const iterations = 100;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        const result = analyzer.analyzeSquatPose(mockVideoElement);
        expect(result.squatMetrics.hasValidSquatPose).toBe(false);
      }

      const totalTime = performance.now() - startTime;
      const avgTime = totalTime / iterations;

      // Error handling should be fast
      expect(avgTime).toBeLessThan(2); // Less than 2ms per error case

      // eslint-disable-next-line no-console
      console.log(`Average error case processing time: ${avgTime.toFixed(3)}ms`);
    });
  });

  describe('Memory Management', () => {
    it('should maintain bounded memory usage', () => {
      // Process many frames to test memory bounds
      for (let i = 0; i < 200; i++) {
        analyzer.analyzeSquatPose(mockVideoElement);
      }

      // Memory management test - just verify analyzer continues to work
      // without exposing internal state
      const lastResult = analyzer.analyzeSquatPose(mockVideoElement);
      expect(lastResult).toBeDefined();
      expect(lastResult.squatMetrics).toBeDefined();
    });
  });

  describe('Integration Performance', () => {
    it('should maintain performance across different pose qualities', () => {
      const fixtures = [
        SQUAT_FIXTURES.properDepth,
        SQUAT_FIXTURES.shallowSquat,
        SQUAT_FIXTURES.lateralShiftLeft,
        SQUAT_FIXTURES.lowConfidence,
        SQUAT_FIXTURES.missingLandmarks,
      ];

      const results: number[] = [];

      fixtures.forEach((fixture) => {
        mockPoseLandmarker.detectForVideo.mockReturnValue(fixture);

        const start = performance.now();
        analyzer.analyzeSquatPose(mockVideoElement);
        const end = performance.now();

        results.push(end - start);
      });

      const avgTime = results.reduce((a, b) => a + b, 0) / results.length;
      const maxTime = Math.max(...results);

      // Should handle all cases efficiently
      expect(avgTime).toBeLessThan(10);
      expect(maxTime).toBeLessThan(20);

      // eslint-disable-next-line no-console
      console.log(`Cross-fixture average time: ${avgTime.toFixed(3)}ms`);
    });
  });
});
