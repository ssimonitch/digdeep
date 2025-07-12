import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { describe, expect, it } from 'vitest';

import { LandmarkValidator } from '../landmark-validator';

// Mock MediaPipe PoseLandmarkerResult structure
interface MockPoseLandmarkerResult {
  landmarks: NormalizedLandmark[][];
}

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

// Legacy confidence calculation from existing services
function calculateLegacyConfidence(result: MockPoseLandmarkerResult): number {
  if (!result.landmarks || result.landmarks.length === 0) {
    return 0;
  }

  const landmarks = result.landmarks[0];
  if (!landmarks || landmarks.length === 0) {
    return 0;
  }

  // Calculate average visibility of key landmarks
  const keyLandmarkIndices = [0, 11, 12, 23, 24]; // nose, shoulders, hips
  const keyLandmarks = keyLandmarkIndices.map((index) => landmarks[index]).filter((landmark) => landmark !== undefined);

  if (keyLandmarks.length === 0) {
    return 0;
  }

  const averageVisibility =
    keyLandmarks.reduce((sum, landmark) => {
      return sum + (landmark.visibility || 0);
    }, 0) / keyLandmarks.length;

  return Math.min(1.0, Math.max(0.0, averageVisibility));
}

// New validator-based confidence calculation
function calculateValidatorConfidence(landmarks: NormalizedLandmark[], validator: LandmarkValidator): number {
  const keyLandmarkIndices = [0, 11, 12, 23, 24]; // Same key landmarks
  const keyLandmarks = keyLandmarkIndices.map((index) => landmarks[index]).filter((landmark) => landmark !== undefined);

  const validation = validator.validateVisibility(keyLandmarks, 0.5);
  return validation.averageVisibility;
}

describe('LandmarkValidator Performance & Integration', () => {
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

  describe('Integration with Existing Confidence Calculations', () => {
    it('should provide compatible confidence scores with legacy calculation', () => {
      const validator = new LandmarkValidator();
      const landmarks = createRealisticLandmarks();
      const mockResult: MockPoseLandmarkerResult = { landmarks: [landmarks] };

      // Legacy calculation
      const legacyConfidence = calculateLegacyConfidence(mockResult);

      // New validator calculation
      const validatorConfidence = calculateValidatorConfidence(landmarks, validator);

      // Should be close but not necessarily identical (different approaches)
      expect(Math.abs(legacyConfidence - validatorConfidence)).toBeLessThan(0.1);
    });

    it('should handle edge cases consistently', () => {
      const validator = new LandmarkValidator();

      // Empty landmarks
      const emptyResult: MockPoseLandmarkerResult = { landmarks: [[]] };
      expect(calculateLegacyConfidence(emptyResult)).toBe(0);
      expect(calculateValidatorConfidence([], validator)).toBe(0);

      // Missing key landmarks
      const partialLandmarks = Array(5)
        .fill(null)
        .map(() => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.8 }));
      const partialResult: MockPoseLandmarkerResult = { landmarks: [partialLandmarks] };

      const legacyPartial = calculateLegacyConfidence(partialResult);
      const validatorPartial = calculateValidatorConfidence(partialLandmarks, validator);

      // Both should handle partial data gracefully
      expect(legacyPartial).toBeGreaterThan(0);
      expect(validatorPartial).toBeGreaterThan(0);
    });

    it('should integrate with squat-specific confidence thresholds', () => {
      const validator = new LandmarkValidator();
      const landmarks = createRealisticLandmarks();

      // Squat uses 0.7 threshold
      const squatValidation = validator.validatePose(landmarks, 'squat');

      // Generic uses 0.5 threshold
      const genericValidation = validator.validatePose(landmarks, 'generic');

      // Squat should be more strict
      if (!genericValidation.visibility.isValid) {
        expect(squatValidation.visibility.isValid).toBe(false);
      }
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
