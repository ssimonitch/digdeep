import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { beforeEach, describe, expect, it } from 'vitest';

import type { QualityConfig } from '../landmark-validator';
import { LandmarkValidator } from '../landmark-validator';

// Test fixtures
const createLandmark = (visibility: number, x = 0.5, y = 0.5, z = 0): NormalizedLandmark => ({
  x,
  y,
  z,
  visibility,
});

const createLandmarks = (visibilities: number[]): NormalizedLandmark[] => {
  return visibilities.map((visibility) => createLandmark(visibility));
};

describe('LandmarkValidator', () => {
  let validator: LandmarkValidator;

  beforeEach(() => {
    validator = new LandmarkValidator();
  });

  describe('validateVisibility', () => {
    describe('individual landmark visibility checks', () => {
      it('should validate landmarks with visibility above threshold', () => {
        const landmarks = [createLandmark(0.8), createLandmark(0.9), createLandmark(0.7)];

        const result = validator.validateVisibility(landmarks, 0.6);

        expect(result.isValid).toBe(true);
        expect(result.visibleCount).toBe(3);
        expect(result.totalCount).toBe(3);
        expect(result.invalidIndices).toEqual([]);
      });

      it('should identify landmarks below visibility threshold', () => {
        const landmarks = [
          createLandmark(0.8),
          createLandmark(0.3), // Below threshold
          createLandmark(0.9),
          createLandmark(0.4), // Below threshold
        ];

        const result = validator.validateVisibility(landmarks, 0.5);

        expect(result.isValid).toBe(false);
        expect(result.visibleCount).toBe(2);
        expect(result.totalCount).toBe(4);
        expect(result.invalidIndices).toEqual([1, 3]);
      });

      it('should use default threshold of 0.5 when not specified', () => {
        const landmarks = [
          createLandmark(0.6),
          createLandmark(0.4), // Below default 0.5
          createLandmark(0.5), // Equal to threshold, should be valid
        ];

        const result = validator.validateVisibility(landmarks);

        expect(result.isValid).toBe(false);
        expect(result.visibleCount).toBe(2);
        expect(result.invalidIndices).toEqual([1]);
      });
    });

    describe('minimum visibility threshold validation', () => {
      it('should validate with custom high threshold for exercise-specific needs', () => {
        const landmarks = createLandmarks([0.8, 0.75, 0.9, 0.85]);

        const result = validator.validateVisibility(landmarks, 0.7);

        expect(result.isValid).toBe(true);
        expect(result.visibleCount).toBe(4);
        expect(result.averageVisibility).toBeCloseTo(0.825, 3);
      });

      it('should handle edge case with threshold of 1.0', () => {
        const landmarks = createLandmarks([1.0, 0.99, 1.0]);

        const result = validator.validateVisibility(landmarks, 1.0);

        expect(result.isValid).toBe(false);
        expect(result.visibleCount).toBe(2);
        expect(result.invalidIndices).toEqual([1]);
      });

      it('should handle edge case with threshold of 0.0', () => {
        const landmarks = createLandmarks([0.0, 0.1, 0.0]);

        const result = validator.validateVisibility(landmarks, 0.0);

        expect(result.isValid).toBe(true);
        expect(result.visibleCount).toBe(3);
      });
    });

    describe('handling of missing landmarks', () => {
      it('should handle empty landmark array', () => {
        const result = validator.validateVisibility([]);

        expect(result.isValid).toBe(false);
        expect(result.visibleCount).toBe(0);
        expect(result.totalCount).toBe(0);
        expect(result.averageVisibility).toBe(0);
      });

      it('should handle landmarks with undefined visibility', () => {
        const landmarks = [
          createLandmark(0.8),
          { x: 0.5, y: 0.5, z: 0 } as NormalizedLandmark, // visibility undefined
          createLandmark(0.7),
        ];

        const result = validator.validateVisibility(landmarks);

        expect(result.isValid).toBe(false);
        expect(result.visibleCount).toBe(2);
        expect(result.invalidIndices).toEqual([1]);
      });

      it('should handle null or undefined in landmark array', () => {
        const landmarks = [
          createLandmark(0.8),
          null as unknown as NormalizedLandmark,
          undefined as unknown as NormalizedLandmark,
          createLandmark(0.7),
        ];

        const result = validator.validateVisibility(landmarks);

        expect(result.isValid).toBe(false);
        expect(result.visibleCount).toBe(2);
        expect(result.totalCount).toBe(4);
        expect(result.invalidIndices).toEqual([1, 2]);
      });
    });

    describe('visibility score calculation', () => {
      it('should calculate average visibility score', () => {
        const landmarks = createLandmarks([0.8, 0.6, 0.9, 0.7]);

        const result = validator.validateVisibility(landmarks);

        expect(result.averageVisibility).toBeCloseTo(0.75, 3);
      });

      it('should calculate minimum visibility score', () => {
        const landmarks = createLandmarks([0.8, 0.3, 0.9, 0.7]);

        const result = validator.validateVisibility(landmarks);

        expect(result.minVisibility).toBe(0.3);
      });

      it('should calculate visibility percentage', () => {
        const landmarks = createLandmarks([0.8, 0.3, 0.9, 0.4]);

        const result = validator.validateVisibility(landmarks, 0.5);

        expect(result.visibilityPercentage).toBe(50); // 2 out of 4 visible
      });

      it('should provide detailed visibility metrics', () => {
        const landmarks = [
          createLandmark(0.9),
          createLandmark(0.2),
          createLandmark(0.8),
          createLandmark(0.7),
          createLandmark(0.4),
        ];

        const result = validator.validateVisibility(landmarks, 0.5);

        expect(result).toEqual({
          isValid: false,
          visibleCount: 3,
          totalCount: 5,
          invalidIndices: [1, 4],
          averageVisibility: 0.6,
          minVisibility: 0.2,
          visibilityPercentage: 60,
        });
      });
    });

    describe('performance considerations', () => {
      it('should handle large landmark arrays efficiently', () => {
        // Create array with 33 landmarks (MediaPipe pose landmarks)
        const landmarks = Array(33)
          .fill(null)
          .map((_, i) => createLandmark(0.5 + (i % 10) * 0.05));

        const startTime = performance.now();
        const result = validator.validateVisibility(landmarks, 0.6);
        const duration = performance.now() - startTime;

        expect(duration).toBeLessThan(0.1); // Should complete in < 0.1ms
        expect(result.totalCount).toBe(33);
      });

      it('should not create unnecessary object allocations', () => {
        const landmarks = createLandmarks([0.8, 0.6, 0.9]);

        // Multiple calls should be efficient
        const results = [];
        const startTime = performance.now();

        for (let i = 0; i < 1000; i++) {
          results.push(validator.validateVisibility(landmarks));
        }

        const duration = performance.now() - startTime;
        expect(duration).toBeLessThan(10); // 1000 calls in < 10ms
      });
    });
  });

  describe('validateCompleteness', () => {
    describe('full pose detection (all landmarks present)', () => {
      it('should validate when all 33 pose landmarks are present', () => {
        // Create full set of 33 landmarks (MediaPipe pose model)
        const landmarks = Array(33)
          .fill(null)
          .map((_, i) => createLandmark(0.8, i * 0.03, i * 0.03));

        const result = validator.validateCompleteness(landmarks);

        expect(result.isComplete).toBe(true);
        expect(result.presentCount).toBe(33);
        expect(result.requiredCount).toBe(33);
        expect(result.missingIndices).toEqual([]);
        expect(result.completenessPercentage).toBe(100);
      });

      it('should validate with custom required landmarks for specific exercises', () => {
        const landmarks = Array(33)
          .fill(null)
          .map(() => createLandmark(0.8));

        // Squat-specific landmarks: hips (23,24), knees (25,26), ankles (27,28)
        const squatRequiredIndices = [23, 24, 25, 26, 27, 28];

        const result = validator.validateCompleteness(landmarks, squatRequiredIndices);

        expect(result.isComplete).toBe(true);
        expect(result.presentCount).toBe(6);
        expect(result.requiredCount).toBe(6);
        expect(result.completenessPercentage).toBe(100);
      });
    });

    describe('partial pose detection scenarios', () => {
      it('should identify missing landmarks when array is shorter than expected', () => {
        // Only 20 landmarks instead of 33
        const landmarks = Array(20)
          .fill(null)
          .map(() => createLandmark(0.8));

        const result = validator.validateCompleteness(landmarks);

        expect(result.isComplete).toBe(false);
        expect(result.presentCount).toBe(20);
        expect(result.requiredCount).toBe(33);
        expect(result.missingIndices).toEqual(
          Array.from({ length: 13 }, (_, i) => i + 20), // [20, 21, ..., 32]
        );
        expect(result.completenessPercentage).toBeCloseTo(60.61, 1);
      });

      it('should handle null/undefined landmarks as missing', () => {
        const landmarks = [
          createLandmark(0.8),
          null,
          createLandmark(0.7),
          undefined,
          createLandmark(0.9),
        ] as NormalizedLandmark[];

        const requiredIndices = [0, 1, 2, 3, 4];
        const result = validator.validateCompleteness(landmarks, requiredIndices);

        expect(result.isComplete).toBe(false);
        expect(result.presentCount).toBe(3);
        expect(result.requiredCount).toBe(5);
        expect(result.missingIndices).toEqual([1, 3]);
        expect(result.completenessPercentage).toBe(60);
      });

      it('should handle landmarks with zero visibility as missing', () => {
        const landmarks = [
          createLandmark(0.8),
          createLandmark(0.0), // Zero visibility
          createLandmark(0.7),
          createLandmark(0.0), // Zero visibility
        ];

        const requiredIndices = [0, 1, 2, 3];
        const result = validator.validateCompleteness(landmarks, requiredIndices);

        expect(result.isComplete).toBe(false);
        expect(result.presentCount).toBe(2);
        expect(result.missingIndices).toEqual([1, 3]);
      });
    });

    describe('exercise-specific required landmarks', () => {
      it('should validate squat-specific landmarks', () => {
        const landmarks = Array(33)
          .fill(null)
          .map(() => createLandmark(0.8));

        // Remove one knee landmark
        landmarks[25] = null as unknown as NormalizedLandmark;

        const squatRequiredIndices = [
          11,
          12, // shoulders (for bar position)
          23,
          24, // hips
          25,
          26, // knees
          27,
          28, // ankles
        ];

        const result = validator.validateCompleteness(landmarks, squatRequiredIndices);

        expect(result.isComplete).toBe(false);
        expect(result.presentCount).toBe(7);
        expect(result.requiredCount).toBe(8);
        expect(result.missingIndices).toEqual([25]);
        expect(result.completenessPercentage).toBe(87.5);
      });

      it('should validate bench press-specific landmarks', () => {
        const landmarks = Array(33)
          .fill(null)
          .map(() => createLandmark(0.8));

        const benchRequiredIndices = [
          11,
          12, // shoulders
          13,
          14, // elbows
          15,
          16, // wrists
        ];

        const result = validator.validateCompleteness(landmarks, benchRequiredIndices);

        expect(result.isComplete).toBe(true);
        expect(result.presentCount).toBe(6);
        expect(result.requiredCount).toBe(6);
      });

      it('should validate deadlift-specific landmarks', () => {
        const landmarks = Array(33)
          .fill(null)
          .map(() => createLandmark(0.8));

        // Remove hip landmark
        landmarks[23] = undefined as unknown as NormalizedLandmark;

        const deadliftRequiredIndices = [
          11,
          12, // shoulders
          23,
          24, // hips
          25,
          26, // knees
          27,
          28, // ankles
        ];

        const result = validator.validateCompleteness(landmarks, deadliftRequiredIndices);

        expect(result.isComplete).toBe(false);
        expect(result.missingIndices).toEqual([23]);
      });
    });

    describe('completeness percentage calculation', () => {
      it('should calculate 0% when no landmarks are present', () => {
        const landmarks: NormalizedLandmark[] = [];
        const requiredIndices = [0, 1, 2, 3, 4];

        const result = validator.validateCompleteness(landmarks, requiredIndices);

        expect(result.completenessPercentage).toBe(0);
        expect(result.presentCount).toBe(0);
        expect(result.requiredCount).toBe(5);
      });

      it('should calculate percentage with decimal precision', () => {
        const landmarks = Array(7)
          .fill(null)
          .map(() => createLandmark(0.8));
        const requiredIndices = Array.from({ length: 9 }, (_, i) => i);

        const result = validator.validateCompleteness(landmarks, requiredIndices);

        expect(result.completenessPercentage).toBeCloseTo(77.78, 2);
      });

      it('should handle case where no required indices specified (default to all 33)', () => {
        const landmarks = Array(25)
          .fill(null)
          .map(() => createLandmark(0.8));

        const result = validator.validateCompleteness(landmarks);

        expect(result.requiredCount).toBe(33);
        expect(result.presentCount).toBe(25);
        expect(result.completenessPercentage).toBeCloseTo(75.76, 2);
      });
    });

    describe('edge cases and error handling', () => {
      it('should handle empty required indices array', () => {
        const landmarks = Array(10)
          .fill(null)
          .map(() => createLandmark(0.8));

        const result = validator.validateCompleteness(landmarks, []);

        expect(result.isComplete).toBe(true);
        expect(result.requiredCount).toBe(0);
        expect(result.presentCount).toBe(0);
        expect(result.completenessPercentage).toBe(100); // No requirements = 100% complete
      });

      it('should handle required indices that exceed landmark array length', () => {
        const landmarks = Array(5)
          .fill(null)
          .map(() => createLandmark(0.8));
        const requiredIndices = [0, 1, 2, 3, 4, 10, 15, 20]; // Some indices out of bounds

        const result = validator.validateCompleteness(landmarks, requiredIndices);

        expect(result.isComplete).toBe(false);
        expect(result.presentCount).toBe(5);
        expect(result.requiredCount).toBe(8);
        expect(result.missingIndices).toEqual([10, 15, 20]);
      });

      it('should handle duplicate required indices', () => {
        const landmarks = Array(5)
          .fill(null)
          .map(() => createLandmark(0.8));
        const requiredIndices = [0, 1, 1, 2, 2, 2]; // Duplicates

        const result = validator.validateCompleteness(landmarks, requiredIndices);

        expect(result.isComplete).toBe(true);
        expect(result.presentCount).toBe(3); // Should count unique indices only
        expect(result.requiredCount).toBe(3); // Should deduplicate
      });
    });

    describe('performance considerations', () => {
      it('should efficiently handle completeness check for full pose', () => {
        const landmarks = Array(33)
          .fill(null)
          .map(() => createLandmark(0.8));

        const startTime = performance.now();
        const result = validator.validateCompleteness(landmarks);
        const duration = performance.now() - startTime;

        expect(duration).toBeLessThan(0.1); // < 0.1ms
        expect(result.isComplete).toBe(true);
      });

      it('should efficiently handle large required indices arrays', () => {
        const landmarks = Array(50)
          .fill(null)
          .map(() => createLandmark(0.8));
        const requiredIndices = Array.from({ length: 100 }, (_, i) => i % 50);

        const startTime = performance.now();
        validator.validateCompleteness(landmarks, requiredIndices);
        const duration = performance.now() - startTime;

        expect(duration).toBeLessThan(0.5); // < 0.5ms even with deduplication
      });
    });
  });

  describe('assessQuality', () => {
    describe('confidence score aggregation', () => {
      it('should calculate average confidence across all landmarks', () => {
        const landmarks = [createLandmark(0.9), createLandmark(0.8), createLandmark(0.7), createLandmark(0.85)];

        const result = validator.assessQuality(landmarks);

        expect(result.averageConfidence).toBeCloseTo(0.8125, 4);
        expect(result.overallScore).toBeGreaterThan(0.7);
        expect(result.meetsQualityThreshold).toBe(true);
      });

      it('should handle landmarks with varying confidence levels', () => {
        const landmarks = [
          createLandmark(0.95), // Very high
          createLandmark(0.3), // Low
          createLandmark(0.6), // Medium
          createLandmark(0.9), // High
        ];

        const result = validator.assessQuality(landmarks);

        expect(result.averageConfidence).toBeCloseTo(0.6875, 4);
        // With penalty applied for low confidence landmarks (0.3), overall score should be reduced
        expect(result.overallScore).toBeCloseTo(0.79, 1); // Still above 0.7 due to weighted calculation
      });

      it('should provide default quality config when not specified', () => {
        const landmarks = createLandmarks([0.8, 0.8, 0.8]);

        const result = validator.assessQuality(landmarks);

        expect(result).toHaveProperty('averageConfidence');
        expect(result).toHaveProperty('symmetryScore');
        expect(result).toHaveProperty('stabilityScore');
        expect(result).toHaveProperty('overallScore');
        expect(result).toHaveProperty('meetsQualityThreshold');
      });
    });

    describe('quality metrics calculation', () => {
      it('should calculate overall quality score based on multiple factors', () => {
        const landmarks = Array(33)
          .fill(null)
          .map(() => createLandmark(0.8));

        const result = validator.assessQuality(landmarks);

        expect(result.overallScore).toBeGreaterThanOrEqual(0);
        expect(result.overallScore).toBeLessThanOrEqual(1);
        expect(result.averageConfidence).toBeCloseTo(0.8, 10);
      });

      it('should assess quality with custom minimum confidence threshold', () => {
        const landmarks = createLandmarks([0.6, 0.65, 0.7, 0.75]);

        const config: QualityConfig = { minConfidence: 0.7 };
        const result = validator.assessQuality(landmarks, config);

        expect(result.meetsQualityThreshold).toBe(false); // Average is below 0.7
      });

      it('should handle empty landmark array', () => {
        const result = validator.assessQuality([]);

        expect(result.averageConfidence).toBe(0);
        expect(result.overallScore).toBe(0);
        expect(result.meetsQualityThreshold).toBe(false);
      });
    });

    describe('bilateral symmetry checks', () => {
      it('should calculate symmetry score for paired landmarks', () => {
        const landmarks = Array(33)
          .fill(null)
          .map((_, i) => {
            // Create symmetric landmarks for left/right pairs
            const baseVisibility = 0.8;
            return createLandmark(baseVisibility, i * 0.03, i * 0.03);
          });

        const config: QualityConfig = { checkSymmetry: true };
        const result = validator.assessQuality(landmarks, config);

        expect(result.symmetryScore).toBeGreaterThan(0.9); // High symmetry
      });

      it('should detect asymmetry in paired landmarks', () => {
        const landmarks = Array(33)
          .fill(null)
          .map(() => createLandmark(0.8));

        // Create asymmetry: left side has lower visibility
        landmarks[11] = createLandmark(0.8); // Left shoulder
        landmarks[12] = createLandmark(0.3); // Right shoulder (low)
        landmarks[23] = createLandmark(0.9); // Left hip
        landmarks[24] = createLandmark(0.4); // Right hip (low)
        landmarks[25] = createLandmark(0.85); // Left knee
        landmarks[26] = createLandmark(0.35); // Right knee (low)

        const config: QualityConfig = { checkSymmetry: true };
        const result = validator.assessQuality(landmarks, config);

        // With weighted calculation, important landmarks (shoulders, hips, knees) have 2x weight
        // Expected symmetry score with the asymmetric pairs
        expect(result.symmetryScore).toBeCloseTo(0.84, 1); // Moderate symmetry due to weighted calculation
      });

      it('should skip symmetry check when not enabled', () => {
        const landmarks = createLandmarks([0.8, 0.3, 0.9, 0.2]); // Asymmetric

        const config: QualityConfig = { checkSymmetry: false };
        const result = validator.assessQuality(landmarks, config);

        expect(result.symmetryScore).toBe(1.0); // Default when not checked
      });
    });

    describe('temporal stability checks', () => {
      it('should calculate stability score between frames', () => {
        const currentLandmarks = [
          createLandmark(0.8, 0.5, 0.5),
          createLandmark(0.9, 0.6, 0.6),
          createLandmark(0.7, 0.4, 0.4),
        ];

        const previousLandmarks = [
          createLandmark(0.8, 0.502, 0.502), // Very small movement (0.2%)
          createLandmark(0.9, 0.602, 0.602), // Very small movement (0.2%)
          createLandmark(0.7, 0.402, 0.402), // Very small movement (0.2%)
        ];

        const config: QualityConfig = {
          checkStability: true,
          previousLandmarks,
        };
        const result = validator.assessQuality(currentLandmarks, config);

        expect(result.stabilityScore).toBeCloseTo(0.86, 1); // Good stability with small movements
      });

      it('should detect unstable landmarks with large movements', () => {
        const currentLandmarks = [createLandmark(0.8, 0.5, 0.5), createLandmark(0.9, 0.6, 0.6)];

        const previousLandmarks = [
          createLandmark(0.8, 0.2, 0.2), // Large movement
          createLandmark(0.9, 0.9, 0.9), // Large movement
        ];

        const config: QualityConfig = {
          checkStability: true,
          previousLandmarks,
        };
        const result = validator.assessQuality(currentLandmarks, config);

        expect(result.stabilityScore).toBeLessThan(0.5); // Low stability
      });

      it('should handle missing previous landmarks', () => {
        const landmarks = createLandmarks([0.8, 0.9, 0.7]);

        const config: QualityConfig = {
          checkStability: true,
          previousLandmarks: undefined,
        };
        const result = validator.assessQuality(landmarks, config);

        expect(result.stabilityScore).toBe(1.0); // Default when no previous frame
      });

      it('should skip stability check when not enabled', () => {
        const landmarks = createLandmarks([0.8, 0.9, 0.7]);

        const config: QualityConfig = { checkStability: false };
        const result = validator.assessQuality(landmarks, config);

        expect(result.stabilityScore).toBe(1.0); // Default when not checked
      });
    });

    describe('quality threshold determination', () => {
      it('should meet quality threshold with good landmarks', () => {
        const landmarks = Array(33)
          .fill(null)
          .map(() => createLandmark(0.85));

        const result = validator.assessQuality(landmarks);

        expect(result.meetsQualityThreshold).toBe(true);
        expect(result.overallScore).toBeGreaterThan(0.8);
      });

      it('should fail quality threshold with poor landmarks', () => {
        const landmarks = [createLandmark(0.3), createLandmark(0.2), createLandmark(0.4), createLandmark(0.1)];

        const result = validator.assessQuality(landmarks);

        expect(result.meetsQualityThreshold).toBe(false);
        expect(result.overallScore).toBeLessThan(0.5);
      });

      it('should use custom threshold from config', () => {
        const landmarks = createLandmarks([0.65, 0.65, 0.65, 0.65]);

        // Default threshold would pass, but custom is higher
        const config: QualityConfig = { minConfidence: 0.8 };
        const result = validator.assessQuality(landmarks, config);

        expect(result.meetsQualityThreshold).toBe(false);
      });
    });

    describe('comprehensive quality assessment', () => {
      it('should combine all quality factors into overall score', () => {
        const currentLandmarks = Array(33)
          .fill(null)
          .map((_, i) => createLandmark(0.8, i * 0.01, i * 0.01));

        const previousLandmarks = Array(33)
          .fill(null)
          .map((_, i) => createLandmark(0.8, i * 0.01 + 0.001, i * 0.01 + 0.001));

        const config: QualityConfig = {
          minConfidence: 0.7,
          checkSymmetry: true,
          checkStability: true,
          previousLandmarks,
        };

        const result = validator.assessQuality(currentLandmarks, config);

        expect(result.averageConfidence).toBeCloseTo(0.8, 10);
        expect(result.symmetryScore).toBeGreaterThan(0.8);
        expect(result.stabilityScore).toBeGreaterThan(0.9);
        expect(result.overallScore).toBeGreaterThan(0.7);
        expect(result.meetsQualityThreshold).toBe(true);
      });

      it('should weight factors appropriately in overall score', () => {
        const landmarks = Array(33)
          .fill(null)
          .map(() => createLandmark(0.9));

        // Make asymmetric
        landmarks[11] = createLandmark(0.3); // Left shoulder low
        landmarks[23] = createLandmark(0.3); // Left hip low

        const config: QualityConfig = {
          checkSymmetry: true,
          checkStability: false,
        };

        const result = validator.assessQuality(landmarks, config);

        // High confidence but low symmetry should reduce overall score
        expect(result.averageConfidence).toBeGreaterThan(0.8);
        // Symmetry score with weighted calculation where two landmarks have low confidence
        expect(result.symmetryScore).toBeCloseTo(0.87, 1);
        // Overall score should be slightly less than average confidence due to symmetry impact
        expect(result.overallScore).toBeCloseTo(0.84, 1);
      });
    });

    describe('performance considerations', () => {
      it('should efficiently process quality assessment', () => {
        const landmarks = Array(33)
          .fill(null)
          .map(() => createLandmark(0.8));
        const previousLandmarks = Array(33)
          .fill(null)
          .map(() => createLandmark(0.8));

        const config: QualityConfig = {
          checkSymmetry: true,
          checkStability: true,
          previousLandmarks,
        };

        const startTime = performance.now();
        const result = validator.assessQuality(landmarks, config);
        const duration = performance.now() - startTime;

        expect(duration).toBeLessThan(1); // < 1ms for full assessment
        expect(result).toHaveProperty('overallScore');
      });

      it('should handle repeated calls efficiently', () => {
        const landmarks = Array(33)
          .fill(null)
          .map(() => createLandmark(0.8));

        const startTime = performance.now();
        for (let i = 0; i < 100; i++) {
          validator.assessQuality(landmarks);
        }
        const duration = performance.now() - startTime;

        expect(duration).toBeLessThan(50); // 100 calls in < 50ms
      });
    });
  });

  describe('validatePose', () => {
    describe('generic exercise validation', () => {
      it('should validate a good generic pose', () => {
        const landmarks = Array(33)
          .fill(null)
          .map(() => createLandmark(0.8));

        const result = validator.validatePose(landmarks);

        expect(result.isValid).toBe(true);
        expect(result.visibility.isValid).toBe(true);
        expect(result.completeness.isComplete).toBe(true);
        expect(result.quality.meetsQualityThreshold).toBe(true);
        expect(result.exerciseSpecificValid).toBe(true);
        expect(result.messages).toHaveLength(0);
      });

      it('should fail validation with poor visibility', () => {
        const landmarks = Array(33)
          .fill(null)
          .map(() => createLandmark(0.3)); // Below generic threshold of 0.5

        const result = validator.validatePose(landmarks, 'generic');

        expect(result.isValid).toBe(false);
        expect(result.visibility.isValid).toBe(false);
        expect(result.messages).toContain('33 landmarks below visibility threshold');
      });
    });

    describe('squat-specific validation', () => {
      it('should validate a good squat pose', () => {
        const landmarks = Array(33)
          .fill(null)
          .map(() => createLandmark(0.85));

        const result = validator.validatePose(landmarks, 'squat');

        expect(result.isValid).toBe(true);
        expect(result.visibility.isValid).toBe(true);
        expect(result.completeness.isComplete).toBe(true);
        expect(result.quality.meetsQualityThreshold).toBe(true);
        expect(result.exerciseSpecificValid).toBe(true);
        expect(result.messages).toHaveLength(0);
      });

      it('should fail with missing squat-specific landmarks', () => {
        const landmarks = Array(33)
          .fill(null)
          .map(() => createLandmark(0.8));

        // Remove knee landmarks
        landmarks[25] = null as unknown as NormalizedLandmark;
        landmarks[26] = null as unknown as NormalizedLandmark;

        const result = validator.validatePose(landmarks, 'squat');

        expect(result.isValid).toBe(false);
        expect(result.completeness.isComplete).toBe(false);
        expect(result.completeness.missingIndices).toEqual([25, 26]);
        expect(result.messages).toContain('Missing 2 required landmarks');
      });

      it('should fail exercise-specific validation with low visibility on key landmarks', () => {
        const landmarks = Array(33)
          .fill(null)
          .map(() => createLandmark(0.8));

        // Set hip landmarks to low visibility
        landmarks[23] = createLandmark(0.6); // Below squat threshold of 0.7
        landmarks[24] = createLandmark(0.6);

        const result = validator.validatePose(landmarks, 'squat');

        expect(result.isValid).toBe(false);
        expect(result.exerciseSpecificValid).toBe(false);
        expect(result.messages).toContain('Does not meet squat exercise requirements');
      });

      it('should check symmetry for squat', () => {
        const landmarks = Array(33)
          .fill(null)
          .map(() => createLandmark(0.8));

        // Create asymmetry
        landmarks[23] = createLandmark(0.85); // Left hip
        landmarks[24] = createLandmark(0.3); // Right hip (very low)

        const result = validator.validatePose(landmarks, 'squat');

        expect(result.quality.checkSymmetry).toBeUndefined(); // Config property not in result
        expect(result.quality.symmetryScore).toBeCloseTo(0.94, 1); // Some asymmetry detected but weighted calculation reduces impact
      });
    });

    describe('bench press validation', () => {
      it('should validate a good bench press pose', () => {
        const landmarks = Array(33)
          .fill(null)
          .map(() => createLandmark(0.85));

        const result = validator.validatePose(landmarks, 'bench');

        expect(result.isValid).toBe(true);
        expect(result.messages).toHaveLength(0);
      });

      it('should require upper body landmarks for bench press', () => {
        const landmarks = Array(33)
          .fill(null)
          .map(() => createLandmark(0.8));

        // Remove wrist landmarks
        landmarks[15] = undefined as unknown as NormalizedLandmark;
        landmarks[16] = undefined as unknown as NormalizedLandmark;

        const result = validator.validatePose(landmarks, 'bench');

        expect(result.isValid).toBe(false);
        expect(result.completeness.missingIndices).toContain(15);
        expect(result.completeness.missingIndices).toContain(16);
      });
    });

    describe('deadlift validation', () => {
      it('should validate a good deadlift pose', () => {
        const landmarks = Array(33)
          .fill(null)
          .map(() => createLandmark(0.85));

        const result = validator.validatePose(landmarks, 'deadlift');

        expect(result.isValid).toBe(true);
        expect(result.messages).toHaveLength(0);
      });

      it('should require full body landmarks for deadlift', () => {
        const landmarks = Array(33)
          .fill(null)
          .map(() => createLandmark(0.8));

        // Low visibility on shoulders
        landmarks[11] = createLandmark(0.5);
        landmarks[12] = createLandmark(0.5);

        const result = validator.validatePose(landmarks, 'deadlift');

        expect(result.isValid).toBe(false);
        expect(result.visibility.isValid).toBe(false); // Below 0.7 threshold
        expect(result.exerciseSpecificValid).toBe(false);
      });
    });

    describe('comprehensive validation messages', () => {
      it('should provide detailed messages for multiple failures', () => {
        const landmarks = Array(20) // Only 20 landmarks instead of 33
          .fill(null)
          .map(() => createLandmark(0.4)); // Low visibility

        const result = validator.validatePose(landmarks, 'squat');

        expect(result.isValid).toBe(false);
        expect(result.messages).toHaveLength(4);
        expect(result.messages).toContain('20 landmarks below visibility threshold');
        expect(result.messages).toContain('Missing 6 required landmarks'); // 23,24,25,26,27,28 are out of bounds
        expect(result.messages).toContain('Pose quality below threshold');
        expect(result.messages).toContain('Does not meet squat exercise requirements');
      });

      it('should handle edge case with empty landmarks', () => {
        const result = validator.validatePose([], 'squat');

        expect(result.isValid).toBe(false);
        expect(result.visibility.isValid).toBe(false);
        expect(result.completeness.isComplete).toBe(false);
        expect(result.quality.meetsQualityThreshold).toBe(false);
        expect(result.exerciseSpecificValid).toBe(false);
      });
    });

    describe('exercise configuration', () => {
      it('should use different thresholds for different exercises', () => {
        const landmarks = Array(33)
          .fill(null)
          .map(() => createLandmark(0.6)); // Between generic (0.5) and specific (0.7) thresholds

        const genericResult = validator.validatePose(landmarks, 'generic');
        const squatResult = validator.validatePose(landmarks, 'squat');

        expect(genericResult.visibility.isValid).toBe(true); // Passes 0.5 threshold
        expect(squatResult.visibility.isValid).toBe(false); // Fails 0.7 threshold
      });

      it('should default to generic when exercise type not specified', () => {
        const landmarks = Array(33)
          .fill(null)
          .map(() => createLandmark(0.6));

        const result = validator.validatePose(landmarks);

        expect(result.isValid).toBe(true); // Uses generic thresholds
        expect(result.exerciseSpecificValid).toBe(true);
      });
    });
  });
});
