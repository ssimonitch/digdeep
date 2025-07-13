import { describe, expect, it } from 'vitest';

import { LandmarkCalculator } from '../../utils/landmark-calculator.util';
import { LANDMARK_INDICES, SQUAT_FIXTURES } from '../pose-detection/fixtures/landmark-fixtures';

describe('LandmarkCalculator Performance Benchmarks', () => {
  const landmarks = SQUAT_FIXTURES.properDepth.landmarks[0];
  const iterations = 1000;

  it('should calculate angles within 1ms per calculation', () => {
    const startTime = performance.now();

    for (let i = 0; i < iterations; i++) {
      LandmarkCalculator.calculateKneeAngle(landmarks, LANDMARK_INDICES, 'LEFT');
      LandmarkCalculator.calculateKneeAngle(landmarks, LANDMARK_INDICES, 'RIGHT');
      LandmarkCalculator.calculateHipAngle(landmarks, LANDMARK_INDICES, 'LEFT');
      LandmarkCalculator.calculateHipAngle(landmarks, LANDMARK_INDICES, 'RIGHT');
      LandmarkCalculator.calculateAnkleAngle(landmarks, LANDMARK_INDICES, 'LEFT');
      LandmarkCalculator.calculateAnkleAngle(landmarks, LANDMARK_INDICES, 'RIGHT');
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;
    const totalCalculations = iterations * 6; // 6 calculations per iteration
    const averageTime = totalTime / totalCalculations;

    // Performance: Average time per angle calculation
    expect(averageTime).toBeLessThan(1); // Should be less than 1ms per calculation
  });

  it('should calculate distances within 1ms per calculation', () => {
    const pointA = landmarks[LANDMARK_INDICES.LEFT_HIP];
    const pointB = landmarks[LANDMARK_INDICES.LEFT_KNEE];

    const startTime = performance.now();

    for (let i = 0; i < iterations; i++) {
      LandmarkCalculator.calculateDistance2D(pointA, pointB);
      LandmarkCalculator.calculateDistance3D(pointA, pointB);
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;
    const totalCalculations = iterations * 2;
    const averageTime = totalTime / totalCalculations;

    // Performance: Average time per distance calculation
    expect(averageTime).toBeLessThan(1);
  });

  it('should calculate midpoints within 1ms per calculation', () => {
    const startTime = performance.now();

    for (let i = 0; i < iterations; i++) {
      LandmarkCalculator.calculateShoulderMidpoint(landmarks, LANDMARK_INDICES);
      LandmarkCalculator.calculateHipMidpoint(landmarks, LANDMARK_INDICES);
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;
    const totalCalculations = iterations * 2;
    const averageTime = totalTime / totalCalculations;

    // Performance: Average time per midpoint calculation
    expect(averageTime).toBeLessThan(1);
  });

  it('should handle full frame analysis within 33ms (30 FPS requirement)', () => {
    const startTime = performance.now();

    // Simulate full frame analysis
    for (let i = 0; i < 100; i++) {
      // Angle calculations (6 total)
      LandmarkCalculator.calculateKneeAngle(landmarks, LANDMARK_INDICES, 'LEFT');
      LandmarkCalculator.calculateKneeAngle(landmarks, LANDMARK_INDICES, 'RIGHT');
      LandmarkCalculator.calculateHipAngle(landmarks, LANDMARK_INDICES, 'LEFT');
      LandmarkCalculator.calculateHipAngle(landmarks, LANDMARK_INDICES, 'RIGHT');
      LandmarkCalculator.calculateAnkleAngle(landmarks, LANDMARK_INDICES, 'LEFT');
      LandmarkCalculator.calculateAnkleAngle(landmarks, LANDMARK_INDICES, 'RIGHT');

      // Midpoint calculations (2 total)
      LandmarkCalculator.calculateShoulderMidpoint(landmarks, LANDMARK_INDICES);
      LandmarkCalculator.calculateHipMidpoint(landmarks, LANDMARK_INDICES);

      // Distance calculations for balance analysis (4 total)
      const leftHip = landmarks[LANDMARK_INDICES.LEFT_HIP];
      const rightHip = landmarks[LANDMARK_INDICES.RIGHT_HIP];
      const leftKnee = landmarks[LANDMARK_INDICES.LEFT_KNEE];
      const rightKnee = landmarks[LANDMARK_INDICES.RIGHT_KNEE];

      LandmarkCalculator.calculateDistance2D(leftHip, rightHip);
      LandmarkCalculator.calculateDistance2D(leftKnee, rightKnee);
      LandmarkCalculator.calculateLateralImbalance(leftHip, rightHip);
      LandmarkCalculator.calculateLateralImbalance(leftKnee, rightKnee);
    }

    const endTime = performance.now();
    const averageFrameTime = (endTime - startTime) / 100;

    // Performance: Average time per full frame analysis
    expect(averageFrameTime).toBeLessThan(33); // Must be under 33ms for 30 FPS
  });
});
