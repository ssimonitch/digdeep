import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

/**
 * Utility class for calculating angles, distances, and midpoints from MediaPipe landmarks.
 *
 * Visibility handling:
 * - Calculations return null if any required landmark has visibility < 0.5
 * - Midpoint calculations always succeed but include minimum visibility
 * - No exceptions thrown - graceful degradation with null returns
 */
export class LandmarkCalculator {
  // Minimum visibility threshold for calculations
  private static readonly MIN_VISIBILITY = 0.5;

  /**
   * Calculate angle in degrees between three points (p1 -> vertex -> p3)
   * Uses dot product formula: cos(θ) = (v1 · v2) / (|v1| × |v2|)
   *
   * @returns Angle in degrees [0, 180] or null if visibility too low
   */
  static calculateAngleDegrees(
    pointA: NormalizedLandmark | undefined,
    vertex: NormalizedLandmark | undefined,
    pointC: NormalizedLandmark | undefined,
  ): number | null {
    // Check existence and visibility
    if (!pointA || !vertex || !pointC) return null;
    if (
      (pointA.visibility ?? 0) < this.MIN_VISIBILITY ||
      (vertex.visibility ?? 0) < this.MIN_VISIBILITY ||
      (pointC.visibility ?? 0) < this.MIN_VISIBILITY
    ) {
      return null;
    }

    // Calculate vectors from vertex to points
    const v1 = {
      x: pointA.x - vertex.x,
      y: pointA.y - vertex.y,
      z: (pointA.z ?? 0) - (vertex.z ?? 0),
    };

    const v2 = {
      x: pointC.x - vertex.x,
      y: pointC.y - vertex.y,
      z: (pointC.z ?? 0) - (vertex.z ?? 0),
    };

    // Calculate magnitudes
    const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y + v1.z * v1.z);
    const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y + v2.z * v2.z);

    // Handle zero-length vectors
    if (mag1 === 0 || mag2 === 0) return 0;

    // Calculate dot product
    const dotProduct = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;

    // Calculate angle using inverse cosine
    const cosAngle = dotProduct / (mag1 * mag2);
    // Clamp to [-1, 1] to handle floating point errors
    const clampedCos = Math.max(-1, Math.min(1, cosAngle));
    const angleRadians = Math.acos(clampedCos);

    // Convert to degrees
    return (angleRadians * 180) / Math.PI;
  }

  /**
   * Calculate 2D Euclidean distance between two landmarks (ignoring Z)
   *
   * @returns Distance or null if visibility too low
   */
  static calculateDistance2D(
    point1: NormalizedLandmark | undefined,
    point2: NormalizedLandmark | undefined,
  ): number | null {
    // Check existence and visibility
    if (!point1 || !point2) return null;
    if ((point1.visibility ?? 0) < this.MIN_VISIBILITY || (point2.visibility ?? 0) < this.MIN_VISIBILITY) {
      return null;
    }

    const dx = point1.x - point2.x;
    const dy = point1.y - point2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Calculate 3D Euclidean distance between two landmarks
   *
   * @returns Distance or null if visibility too low
   */
  static calculateDistance3D(
    point1: NormalizedLandmark | undefined,
    point2: NormalizedLandmark | undefined,
  ): number | null {
    // Check existence and visibility
    if (!point1 || !point2) return null;
    if ((point1.visibility ?? 0) < this.MIN_VISIBILITY || (point2.visibility ?? 0) < this.MIN_VISIBILITY) {
      return null;
    }

    const dx = point1.x - point2.x;
    const dy = point1.y - point2.y;
    const dz = (point1.z ?? 0) - (point2.z ?? 0);
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Calculate midpoint between two landmarks
   * Always succeeds but includes minimum visibility of the two points
   *
   * @returns Midpoint with averaged coordinates and minimum visibility
   */
  static calculateMidpoint(
    point1: NormalizedLandmark | undefined,
    point2: NormalizedLandmark | undefined,
  ): NormalizedLandmark | null {
    if (!point1 || !point2) return null;

    return {
      x: (point1.x + point2.x) / 2,
      y: (point1.y + point2.y) / 2,
      z: ((point1.z ?? 0) + (point2.z ?? 0)) / 2,
      visibility: Math.min(point1.visibility ?? 0, point2.visibility ?? 0),
    };
  }

  /**
   * Calculate knee angle (hip -> knee -> ankle)
   *
   * @param landmarks Array of pose landmarks
   * @param landmarkIndices Object mapping body parts to landmark indices
   * @param side 'LEFT' or 'RIGHT'
   * @returns Knee angle in degrees or null
   */
  static calculateKneeAngle(
    landmarks: NormalizedLandmark[],
    landmarkIndices: Record<string, number>,
    side: 'LEFT' | 'RIGHT',
  ): number | null {
    const hip = landmarks[landmarkIndices[`${side}_HIP`]];
    const knee = landmarks[landmarkIndices[`${side}_KNEE`]];
    const ankle = landmarks[landmarkIndices[`${side}_ANKLE`]];

    return this.calculateAngleDegrees(hip, knee, ankle);
  }

  /**
   * Calculate hip angle (shoulder -> hip -> knee)
   *
   * @param landmarks Array of pose landmarks
   * @param landmarkIndices Object mapping body parts to landmark indices
   * @param side 'LEFT' or 'RIGHT'
   * @returns Hip angle in degrees or null
   */
  static calculateHipAngle(
    landmarks: NormalizedLandmark[],
    landmarkIndices: Record<string, number>,
    side: 'LEFT' | 'RIGHT',
  ): number | null {
    const shoulder = landmarks[landmarkIndices[`${side}_SHOULDER`]];
    const hip = landmarks[landmarkIndices[`${side}_HIP`]];
    const knee = landmarks[landmarkIndices[`${side}_KNEE`]];

    return this.calculateAngleDegrees(shoulder, hip, knee);
  }

  /**
   * Calculate ankle angle (knee -> ankle -> foot_index)
   *
   * @param landmarks Array of pose landmarks
   * @param landmarkIndices Object mapping body parts to landmark indices
   * @param side 'LEFT' or 'RIGHT'
   * @returns Ankle angle in degrees or null
   */
  static calculateAnkleAngle(
    landmarks: NormalizedLandmark[],
    landmarkIndices: Record<string, number>,
    side: 'LEFT' | 'RIGHT',
  ): number | null {
    const knee = landmarks[landmarkIndices[`${side}_KNEE`]];
    const ankle = landmarks[landmarkIndices[`${side}_ANKLE`]];
    const footIndex = landmarks[landmarkIndices[`${side}_FOOT_INDEX`]];

    return this.calculateAngleDegrees(knee, ankle, footIndex);
  }

  /**
   * Calculate shoulder midpoint for bar position tracking
   *
   * @param landmarks Array of pose landmarks
   * @param landmarkIndices Object mapping body parts to landmark indices
   * @returns Shoulder midpoint or null
   */
  static calculateShoulderMidpoint(
    landmarks: NormalizedLandmark[],
    landmarkIndices: Record<string, number>,
  ): NormalizedLandmark | null {
    const leftShoulder = landmarks[landmarkIndices.LEFT_SHOULDER];
    const rightShoulder = landmarks[landmarkIndices.RIGHT_SHOULDER];

    return this.calculateMidpoint(leftShoulder, rightShoulder);
  }

  /**
   * Calculate hip midpoint
   *
   * @param landmarks Array of pose landmarks
   * @param landmarkIndices Object mapping body parts to landmark indices
   * @returns Hip midpoint or null
   */
  static calculateHipMidpoint(
    landmarks: NormalizedLandmark[],
    landmarkIndices: Record<string, number>,
  ): NormalizedLandmark | null {
    const leftHip = landmarks[landmarkIndices.LEFT_HIP];
    const rightHip = landmarks[landmarkIndices.RIGHT_HIP];

    return this.calculateMidpoint(leftHip, rightHip);
  }

  /**
   * Calculate horizontal deviation from a vertical line
   * Useful for bar path tracking
   *
   * @param point Current position
   * @param referenceX X-coordinate of the vertical reference line
   * @returns Horizontal deviation (positive = right, negative = left)
   */
  static calculateHorizontalDeviation(point: NormalizedLandmark | undefined, referenceX: number): number | null {
    if (!point || (point.visibility ?? 0) < this.MIN_VISIBILITY) return null;
    return point.x - referenceX;
  }

  /**
   * Calculate lateral imbalance between left and right sides
   *
   * @param leftPoint Left side landmark
   * @param rightPoint Right side landmark
   * @returns Lateral difference (positive = right side lower/further)
   */
  static calculateLateralImbalance(
    leftPoint: NormalizedLandmark | undefined,
    rightPoint: NormalizedLandmark | undefined,
    axis: 'x' | 'y' = 'y',
  ): number | null {
    if (!leftPoint || !rightPoint) return null;
    if ((leftPoint.visibility ?? 0) < this.MIN_VISIBILITY || (rightPoint.visibility ?? 0) < this.MIN_VISIBILITY) {
      return null;
    }

    return rightPoint[axis] - leftPoint[axis];
  }
}
