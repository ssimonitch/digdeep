import { describe, expect, it } from 'vitest';

import {
  addNoiseLandmarks,
  approximatelyEqual,
  areLandmarksReliable,
  calculateAngleDegrees,
  calculateDistance,
  calculateMidpoint,
  calculateSlope,
  calculateVerticalDeviation,
  createAngleTestLandmarks,
  createDistanceTestLandmarks,
  generateStraightLineLandmarks,
  isLandmarkReliable,
} from './test-utilities';

describe('Test Utilities - Mathematical Calculations', () => {
  describe('calculateAngleDegrees', () => {
    it('should calculate right angle correctly', () => {
      const { pointA, vertex, pointC } = createAngleTestLandmarks(0.5, 0.5, 90);
      const angle = calculateAngleDegrees(pointA, vertex, pointC);
      expect(approximatelyEqual(angle, 90, 0.1)).toBe(true);
    });

    it('should calculate straight line (180 degrees)', () => {
      const { pointA, vertex, pointC } = createAngleTestLandmarks(0.5, 0.5, 180);
      const angle = calculateAngleDegrees(pointA, vertex, pointC);
      expect(approximatelyEqual(angle, 180, 0.1)).toBe(true);
    });

    it('should calculate acute angle correctly', () => {
      const { pointA, vertex, pointC } = createAngleTestLandmarks(0.5, 0.5, 45);
      const angle = calculateAngleDegrees(pointA, vertex, pointC);
      expect(approximatelyEqual(angle, 45, 0.1)).toBe(true);
    });

    it('should calculate obtuse angle correctly', () => {
      const { pointA, vertex, pointC } = createAngleTestLandmarks(0.5, 0.5, 135);
      const angle = calculateAngleDegrees(pointA, vertex, pointC);
      expect(approximatelyEqual(angle, 135, 0.1)).toBe(true);
    });

    it('should handle zero-length vectors', () => {
      const point = { x: 0.5, y: 0.5, z: 0, visibility: 1.0 };
      const angle = calculateAngleDegrees(point, point, point);
      expect(angle).toBe(0);
    });
  });

  describe('calculateDistance', () => {
    it('should calculate distance between identical points as zero', () => {
      const point = { x: 0.5, y: 0.5, z: 0, visibility: 1.0 };
      const distance = calculateDistance(point, point);
      expect(distance).toBe(0);
    });

    it('should calculate horizontal distance correctly', () => {
      const { pointA, pointB } = createDistanceTestLandmarks(0, 0, 0.1, 0);
      const distance = calculateDistance(pointA, pointB);
      expect(approximatelyEqual(distance, 0.1)).toBe(true);
    });

    it('should calculate vertical distance correctly', () => {
      const { pointA, pointB } = createDistanceTestLandmarks(0, 0, 0.1, 90);
      const distance = calculateDistance(pointA, pointB);
      expect(approximatelyEqual(distance, 0.1)).toBe(true);
    });

    it('should calculate diagonal distance correctly', () => {
      const { pointA, pointB } = createDistanceTestLandmarks(0, 0, 0.1, 45);
      const distance = calculateDistance(pointA, pointB);
      expect(approximatelyEqual(distance, 0.1)).toBe(true);
    });

    it('should handle 3D distance with Z component', () => {
      const pointA = { x: 0, y: 0, z: 0, visibility: 1.0 };
      const pointB = { x: 0, y: 0, z: 0.1, visibility: 1.0 };
      const distance = calculateDistance(pointA, pointB);
      expect(approximatelyEqual(distance, 0.1)).toBe(true);
    });
  });

  describe('calculateMidpoint', () => {
    it('should calculate midpoint correctly', () => {
      const pointA = { x: 0, y: 0, z: 0, visibility: 1.0 };
      const pointB = { x: 1, y: 1, z: 1, visibility: 0.8 };
      const midpoint = calculateMidpoint(pointA, pointB);

      expect(midpoint.x).toBe(0.5);
      expect(midpoint.y).toBe(0.5);
      expect(midpoint.z).toBe(0.5);
      expect(midpoint.visibility).toBe(0.8); // Should use minimum visibility
    });

    it('should handle identical points', () => {
      const point = { x: 0.3, y: 0.7, z: 0.1, visibility: 0.9 };
      const midpoint = calculateMidpoint(point, point);

      expect(midpoint.x).toBe(0.3);
      expect(midpoint.y).toBe(0.7);
      expect(midpoint.z).toBe(0.1);
      expect(midpoint.visibility).toBe(0.9);
    });
  });

  describe('calculateSlope', () => {
    it('should calculate positive slope correctly', () => {
      const pointA = { x: 0, y: 0, z: 0, visibility: 1.0 };
      const pointB = { x: 1, y: 1, z: 0, visibility: 1.0 };
      const slope = calculateSlope(pointA, pointB);
      expect(slope).toBe(1);
    });

    it('should calculate negative slope correctly', () => {
      const pointA = { x: 0, y: 1, z: 0, visibility: 1.0 };
      const pointB = { x: 1, y: 0, z: 0, visibility: 1.0 };
      const slope = calculateSlope(pointA, pointB);
      expect(slope).toBe(-1);
    });

    it('should handle vertical line (infinite slope)', () => {
      const pointA = { x: 0.5, y: 0, z: 0, visibility: 1.0 };
      const pointB = { x: 0.5, y: 1, z: 0, visibility: 1.0 };
      const slope = calculateSlope(pointA, pointB);
      expect(slope).toBe(Infinity);
    });

    it('should handle horizontal line (zero slope)', () => {
      const pointA = { x: 0, y: 0.5, z: 0, visibility: 1.0 };
      const pointB = { x: 1, y: 0.5, z: 0, visibility: 1.0 };
      const slope = calculateSlope(pointA, pointB);
      expect(slope).toBe(0);
    });
  });

  describe('calculateVerticalDeviation', () => {
    it('should return zero for perfectly vertical line', () => {
      const landmarks = generateStraightLineLandmarks(
        { x: 0.5, y: 0, z: 0, visibility: 1.0 },
        { x: 0.5, y: 1, z: 0, visibility: 1.0 },
        5,
      );
      const deviation = calculateVerticalDeviation(landmarks);
      expect(approximatelyEqual(deviation, 0, 0.001)).toBe(true);
    });

    it('should calculate deviation for non-vertical path', () => {
      const landmarks = [
        { x: 0.5, y: 0, z: 0, visibility: 1.0 },
        { x: 0.6, y: 0.5, z: 0, visibility: 1.0 }, // Deviation of 0.05 from average
        { x: 0.5, y: 1, z: 0, visibility: 1.0 },
      ];
      const deviation = calculateVerticalDeviation(landmarks);
      expect(approximatelyEqual(deviation, 0.067, 0.01)).toBe(true); // Max deviation from average X
    });

    it('should handle empty array', () => {
      const deviation = calculateVerticalDeviation([]);
      expect(deviation).toBe(0);
    });

    it('should handle single landmark', () => {
      const landmark = { x: 0.5, y: 0.5, z: 0, visibility: 1.0 };
      const deviation = calculateVerticalDeviation([landmark]);
      expect(deviation).toBe(0);
    });
  });

  describe('Landmark Reliability', () => {
    describe('isLandmarkReliable', () => {
      it('should identify reliable landmark with high confidence', () => {
        const landmark = { x: 0.5, y: 0.5, z: 0, visibility: 0.9 };
        expect(isLandmarkReliable(landmark)).toBe(true);
      });

      it('should identify unreliable landmark with low confidence', () => {
        const landmark = { x: 0.5, y: 0.5, z: 0, visibility: 0.3 };
        expect(isLandmarkReliable(landmark)).toBe(false);
      });

      it('should respect custom confidence threshold', () => {
        const landmark = { x: 0.5, y: 0.5, z: 0, visibility: 0.6 };
        expect(isLandmarkReliable(landmark, 0.7)).toBe(false);
        expect(isLandmarkReliable(landmark, 0.5)).toBe(true);
      });
    });

    describe('areLandmarksReliable', () => {
      it('should validate all reliable landmarks', () => {
        const landmarks = [
          { x: 0.5, y: 0.5, z: 0, visibility: 0.9 },
          { x: 0.6, y: 0.6, z: 0, visibility: 0.8 },
          { x: 0.7, y: 0.7, z: 0, visibility: 0.7 },
        ];
        expect(areLandmarksReliable(landmarks)).toBe(true);
      });

      it('should reject if any landmark is unreliable', () => {
        const landmarks = [
          { x: 0.5, y: 0.5, z: 0, visibility: 0.9 },
          { x: 0.6, y: 0.6, z: 0, visibility: 0.3 }, // Low confidence
          { x: 0.7, y: 0.7, z: 0, visibility: 0.8 },
        ];
        expect(areLandmarksReliable(landmarks)).toBe(false);
      });

      it('should handle empty array', () => {
        expect(areLandmarksReliable([])).toBe(true);
      });
    });
  });

  describe('Test Helper Functions', () => {
    describe('createAngleTestLandmarks', () => {
      it('should create landmarks with correct spatial relationship', () => {
        const { pointA, vertex, pointC } = createAngleTestLandmarks(0.5, 0.5, 90, 0.1);

        // Verify vertex is at center
        expect(vertex.x).toBe(0.5);
        expect(vertex.y).toBe(0.5);

        // Verify point A is horizontal left
        expect(pointA.x).toBe(0.4);
        expect(pointA.y).toBe(0.5);

        // Verify point C forms 90-degree angle
        expect(approximatelyEqual(pointC.x, 0.5, 0.001)).toBe(true);
        expect(approximatelyEqual(pointC.y, 0.6, 0.001)).toBe(true);
      });
    });

    describe('createDistanceTestLandmarks', () => {
      it('should create landmarks at specified distance', () => {
        const { pointA, pointB } = createDistanceTestLandmarks(0.5, 0.5, 0.1, 0);
        const actualDistance = calculateDistance(pointA, pointB);
        expect(approximatelyEqual(actualDistance, 0.1)).toBe(true);
      });
    });

    describe('generateStraightLineLandmarks', () => {
      it('should generate correct number of landmarks', () => {
        const start = { x: 0, y: 0, z: 0, visibility: 1.0 };
        const end = { x: 1, y: 1, z: 0, visibility: 1.0 };
        const landmarks = generateStraightLineLandmarks(start, end, 5);

        expect(landmarks).toHaveLength(5);
        expect(landmarks[0]).toEqual(start);
        expect(landmarks[4]).toEqual(end);
      });

      it('should maintain straight line relationship', () => {
        const start = { x: 0, y: 0, z: 0, visibility: 1.0 };
        const end = { x: 1, y: 1, z: 0, visibility: 1.0 };
        const landmarks = generateStraightLineLandmarks(start, end, 5);

        // All points should have equal X and Y coordinates (diagonal line)
        landmarks.forEach((landmark) => {
          expect(approximatelyEqual(landmark.x, landmark.y)).toBe(true);
        });
      });
    });

    describe('addNoiseLandmarks', () => {
      it('should add noise to landmarks', () => {
        const originalLandmarks = [
          { x: 0.5, y: 0.5, z: 0, visibility: 1.0 },
          { x: 0.6, y: 0.6, z: 0, visibility: 1.0 },
        ];

        const noisyLandmarks = addNoiseLandmarks(originalLandmarks, 0.01);

        expect(noisyLandmarks).toHaveLength(2);

        // Landmarks should be different but within noise range
        noisyLandmarks.forEach((noisy, index) => {
          const original = originalLandmarks[index];
          expect(Math.abs(noisy.x - original.x)).toBeLessThanOrEqual(0.01);
          expect(Math.abs(noisy.y - original.y)).toBeLessThanOrEqual(0.01);
          expect(Math.abs(noisy.z - original.z)).toBeLessThanOrEqual(0.01);
          expect(noisy.visibility).toBe(original.visibility);
        });
      });
    });

    describe('approximatelyEqual', () => {
      it('should identify equal values', () => {
        expect(approximatelyEqual(1.0, 1.0)).toBe(true);
        expect(approximatelyEqual(0.5, 0.5)).toBe(true);
      });

      it('should handle values within tolerance', () => {
        expect(approximatelyEqual(1.0, 1.0005, 0.001)).toBe(true);
        expect(approximatelyEqual(1.0, 1.002, 0.001)).toBe(false);
      });

      it('should respect custom tolerance', () => {
        expect(approximatelyEqual(1.0, 1.05, 0.1)).toBe(true);
        expect(approximatelyEqual(1.0, 1.15, 0.1)).toBe(false);
      });
    });
  });
});
