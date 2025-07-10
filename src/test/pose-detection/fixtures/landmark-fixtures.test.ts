import { describe, expect, it } from 'vitest';

import {
  BENCH_FIXTURES,
  createDefaultLandmarks,
  DEADLIFT_FIXTURES,
  LANDMARK_INDICES,
  SQUAT_FIXTURES,
} from './landmark-fixtures';

describe('Landmark Fixtures - Anatomical Validity', () => {
  describe('Default Landmarks', () => {
    it('should represent anatomically correct human proportions', () => {
      const landmarks = createDefaultLandmarks();

      // Check nose is at head level
      expect(landmarks[LANDMARK_INDICES.NOSE].y).toBeLessThan(0.2);

      // Check shoulders are wider than hips (typical human anatomy)
      const shoulderWidth = Math.abs(
        landmarks[LANDMARK_INDICES.LEFT_SHOULDER].x - landmarks[LANDMARK_INDICES.RIGHT_SHOULDER].x,
      );
      const hipWidth = Math.abs(landmarks[LANDMARK_INDICES.LEFT_HIP].x - landmarks[LANDMARK_INDICES.RIGHT_HIP].x);
      expect(shoulderWidth).toBeGreaterThan(hipWidth);

      // Check vertical body alignment (top to bottom)
      expect(landmarks[LANDMARK_INDICES.LEFT_KNEE].y).toBeGreaterThan(landmarks[LANDMARK_INDICES.LEFT_HIP].y);
      expect(landmarks[LANDMARK_INDICES.LEFT_ANKLE].y).toBeGreaterThan(landmarks[LANDMARK_INDICES.LEFT_KNEE].y);
    });
  });

  describe('Squat Position Anatomy', () => {
    it('should represent anatomically correct squat depth positions', () => {
      // Proper depth: hips below knees (Y increases downward in normalized coords)
      const properDepthLandmarks = SQUAT_FIXTURES.properDepth.landmarks[0];
      expect(properDepthLandmarks[LANDMARK_INDICES.LEFT_HIP].y).toBeGreaterThan(
        properDepthLandmarks[LANDMARK_INDICES.LEFT_KNEE].y,
      );

      // Shallow squat: hips above knees
      const shallowLandmarks = SQUAT_FIXTURES.shallowSquat.landmarks[0];
      expect(shallowLandmarks[LANDMARK_INDICES.LEFT_HIP].y).toBeLessThan(
        shallowLandmarks[LANDMARK_INDICES.LEFT_KNEE].y,
      );
    });

    it('should represent anatomically correct form deviations', () => {
      // Lateral shift: asymmetric hip positioning
      const lateralLandmarks = SQUAT_FIXTURES.lateralShiftLeft.landmarks[0];
      expect(lateralLandmarks[LANDMARK_INDICES.LEFT_HIP].x).toBeLessThan(0.45);
      expect(lateralLandmarks[LANDMARK_INDICES.RIGHT_HIP].x).toBeLessThan(0.5);

      // Low confidence: poor landmark visibility
      const lowConfLandmarks = SQUAT_FIXTURES.lowConfidence.landmarks[0];
      expect(lowConfLandmarks[LANDMARK_INDICES.LEFT_HIP].visibility).toBeLessThan(0.5);
      expect(lowConfLandmarks[LANDMARK_INDICES.LEFT_KNEE].visibility).toBeLessThan(0.5);
    });
  });

  describe('Bench Press Position Anatomy', () => {
    it('should represent anatomically correct bench press positions', () => {
      // Bottom position: wide elbow flare
      const bottomLandmarks = BENCH_FIXTURES.bottomPosition.landmarks[0];
      const elbowWidth =
        bottomLandmarks[LANDMARK_INDICES.RIGHT_ELBOW].x - bottomLandmarks[LANDMARK_INDICES.LEFT_ELBOW].x;
      expect(elbowWidth).toBeGreaterThan(0.4);

      // Top position: arms extended (wrists above shoulders)
      const topLandmarks = BENCH_FIXTURES.topPosition.landmarks[0];
      expect(topLandmarks[LANDMARK_INDICES.LEFT_WRIST].y).toBeLessThan(topLandmarks[LANDMARK_INDICES.LEFT_SHOULDER].y);
    });
  });

  describe('Deadlift Position Anatomy', () => {
    it('should represent anatomically correct deadlift positions', () => {
      // Start position: hip hinge with shoulders forward
      const startLandmarks = DEADLIFT_FIXTURES.startPosition.landmarks[0];
      expect(startLandmarks[LANDMARK_INDICES.LEFT_HIP].y).toBeLessThan(0.5);
      expect(startLandmarks[LANDMARK_INDICES.LEFT_SHOULDER].y).toBeLessThan(0.45);

      // Lockout position: upright standing alignment
      const lockoutLandmarks = DEADLIFT_FIXTURES.lockoutPosition.landmarks[0];
      const hipY = lockoutLandmarks[LANDMARK_INDICES.LEFT_HIP].y;
      const kneeY = lockoutLandmarks[LANDMARK_INDICES.LEFT_KNEE].y;
      const shoulderY = lockoutLandmarks[LANDMARK_INDICES.LEFT_SHOULDER].y;

      expect(hipY).toBeCloseTo(0.5, 1);
      expect(shoulderY).toBeLessThan(hipY);
      expect(kneeY).toBeGreaterThan(hipY);
    });
  });
});
