import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { describe, expect, it } from 'vitest';

import { LandmarkValidator } from '../landmark-validator';

// Create realistic landmark data
const createRealisticLandmarks = (): NormalizedLandmark[] => {
  return Array(33)
    .fill(null)
    .map(() => ({
      x: 0.3 + Math.random() * 0.4, // Centered around 0.5
      y: 0.3 + Math.random() * 0.4,
      z: -0.1 + Math.random() * 0.2,
      visibility: 0.5 + Math.random() * 0.5, // 0.5 to 1.0 range
    }));
};

describe('LandmarkValidator Performance Benchmarks', () => {
  describe('Performance Benchmarks', () => {
    it('should process single validation under 1ms', () => {
      const validator = new LandmarkValidator();
      const landmarks = createRealisticLandmarks();

      const runs = 1000;
      const startTime = performance.now();

      for (let i = 0; i < runs; i++) {
        validator.validateVisibility(landmarks, 0.7);
      }

      const totalTime = performance.now() - startTime;
      const avgTime = totalTime / runs;

      expect(avgTime).toBeLessThan(1); // Under 1ms per validation
      expect(totalTime).toBeLessThan(100); // 1000 runs under 100ms total
    });

    it('should process complete pose validation under 5ms', () => {
      const validator = new LandmarkValidator();
      const landmarks = createRealisticLandmarks();

      const runs = 100;
      const startTime = performance.now();

      for (let i = 0; i < runs; i++) {
        validator.validatePose(landmarks, 'squat');
      }

      const totalTime = performance.now() - startTime;
      const avgTime = totalTime / runs;

      expect(avgTime).toBeLessThan(5); // Under 5ms per full validation
    });

    it('should not exceed 33ms for 30 FPS requirement', () => {
      const validator = new LandmarkValidator();
      const landmarks = createRealisticLandmarks();

      // Simulate full frame processing
      const startTime = performance.now();

      // Multiple operations per frame
      validator.validateVisibility(landmarks, 0.7);
      validator.validateCompleteness(landmarks, [11, 12, 23, 24, 25, 26, 27, 28]);
      validator.assessQuality(landmarks, {
        minConfidence: 0.7,
        checkSymmetry: true,
      });
      validator.validatePose(landmarks, 'squat');

      const processingTime = performance.now() - startTime;

      expect(processingTime).toBeLessThan(10); // Should be well under 33ms
    });
  });

  describe('Memory Efficiency', () => {
    it('should not create excessive garbage during repeated validations', () => {
      const validator = new LandmarkValidator();
      const landmarks = createRealisticLandmarks();

      // Warm up
      for (let i = 0; i < 100; i++) {
        validator.validateVisibility(landmarks);
      }

      // Measure allocations indirectly through time
      const startTime = performance.now();
      const iterations = 10000;

      for (let i = 0; i < iterations; i++) {
        validator.validateVisibility(landmarks, 0.7);
      }

      const totalTime = performance.now() - startTime;
      const avgTime = totalTime / iterations;

      // Should maintain consistent performance (no GC pauses)
      expect(avgTime).toBeLessThan(0.1); // Under 0.1ms per call
    });
  });

  describe('Real-world Usage Patterns', () => {
    it('should handle rapid frame processing for real-time analysis', () => {
      const validator = new LandmarkValidator();
      let previousLandmarks: NormalizedLandmark[] | undefined;

      const frameCount = 300; // 10 seconds at 30 FPS
      const frameTimes: number[] = [];

      for (let frame = 0; frame < frameCount; frame++) {
        const frameStart = performance.now();
        const landmarks = createRealisticLandmarks();

        // Full validation pipeline
        const visibility = validator.validateVisibility(landmarks, 0.7);
        const completeness = validator.validateCompleteness(landmarks, [11, 12, 23, 24, 25, 26, 27, 28]);
        validator.assessQuality(landmarks, {
          minConfidence: 0.7,
          checkSymmetry: true,
          checkStability: !!previousLandmarks,
          previousLandmarks,
        });

        // Only validate full pose if basic checks pass
        if (visibility.visibilityPercentage > 70 && completeness.completenessPercentage > 80) {
          validator.validatePose(landmarks, 'squat');
        }

        previousLandmarks = landmarks;
        frameTimes.push(performance.now() - frameStart);
      }

      // Check frame time statistics
      const avgFrameTime = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
      const maxFrameTime = Math.max(...frameTimes);

      expect(avgFrameTime).toBeLessThan(5); // Average under 5ms
      expect(maxFrameTime).toBeLessThan(16); // Max under 16ms (60 FPS capable)
    });
  });
});
