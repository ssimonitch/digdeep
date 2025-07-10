import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

/**
 * Test utilities for validating pose detection calculations
 * These utilities help ensure mathematical accuracy in angle and distance calculations
 */

/**
 * Calculate the angle between three landmarks in degrees
 * @param pointA First landmark (e.g., hip)
 * @param pointB Vertex landmark (e.g., knee)
 * @param pointC Third landmark (e.g., ankle)
 * @returns Angle in degrees (0-180)
 */
export function calculateAngleDegrees(
  pointA: NormalizedLandmark,
  pointB: NormalizedLandmark,
  pointC: NormalizedLandmark,
): number {
  // Calculate vectors
  const vectorBA = {
    x: pointA.x - pointB.x,
    y: pointA.y - pointB.y,
  };

  const vectorBC = {
    x: pointC.x - pointB.x,
    y: pointC.y - pointB.y,
  };

  // Calculate dot product
  const dotProduct = vectorBA.x * vectorBC.x + vectorBA.y * vectorBC.y;

  // Calculate magnitudes
  const magnitudeBA = Math.sqrt(vectorBA.x ** 2 + vectorBA.y ** 2);
  const magnitudeBC = Math.sqrt(vectorBC.x ** 2 + vectorBC.y ** 2);

  // Handle zero-length vectors
  if (magnitudeBA === 0 || magnitudeBC === 0) {
    return 0;
  }

  // Calculate angle in radians, then convert to degrees
  const cosAngle = dotProduct / (magnitudeBA * magnitudeBC);

  // Clamp cosAngle to [-1, 1] to handle floating point precision issues
  const clampedCosAngle = Math.max(-1, Math.min(1, cosAngle));

  const angleRadians = Math.acos(clampedCosAngle);
  return (angleRadians * 180) / Math.PI;
}

/**
 * Calculate the Euclidean distance between two landmarks
 * @param pointA First landmark
 * @param pointB Second landmark
 * @returns Distance as a normalized value
 */
export function calculateDistance(pointA: NormalizedLandmark, pointB: NormalizedLandmark): number {
  const deltaX = pointA.x - pointB.x;
  const deltaY = pointA.y - pointB.y;
  const deltaZ = pointA.z - pointB.z;

  return Math.sqrt(deltaX ** 2 + deltaY ** 2 + deltaZ ** 2);
}

/**
 * Calculate the midpoint between two landmarks
 * @param pointA First landmark
 * @param pointB Second landmark
 * @returns Midpoint as a normalized landmark
 */
export function calculateMidpoint(pointA: NormalizedLandmark, pointB: NormalizedLandmark): NormalizedLandmark {
  return {
    x: (pointA.x + pointB.x) / 2,
    y: (pointA.y + pointB.y) / 2,
    z: (pointA.z + pointB.z) / 2,
    visibility: Math.min(pointA.visibility, pointB.visibility),
  };
}

/**
 * Calculate the slope between two landmarks (rise over run)
 * @param pointA First landmark
 * @param pointB Second landmark
 * @returns Slope value (deltaY / deltaX)
 */
export function calculateSlope(pointA: NormalizedLandmark, pointB: NormalizedLandmark): number {
  const deltaX = pointB.x - pointA.x;
  const deltaY = pointB.y - pointA.y;

  if (deltaX === 0) {
    return deltaY > 0 ? Infinity : deltaY < 0 ? -Infinity : 0;
  }

  return deltaY / deltaX;
}

/**
 * Calculate the vertical deviation from a straight line
 * Useful for bar path tracking
 * @param landmarks Array of landmarks representing a path
 * @returns Maximum deviation from the average X position
 */
export function calculateVerticalDeviation(landmarks: NormalizedLandmark[]): number {
  if (landmarks.length === 0) return 0;

  // Calculate average X position
  const avgX = landmarks.reduce((sum, landmark) => sum + landmark.x, 0) / landmarks.length;

  // Find maximum deviation
  return Math.max(...landmarks.map((landmark) => Math.abs(landmark.x - avgX)));
}

/**
 * Validate if a landmark has sufficient confidence for calculations
 * @param landmark The landmark to validate
 * @param minConfidence Minimum visibility threshold (default: 0.5)
 * @returns True if landmark is reliable for calculations
 */
export function isLandmarkReliable(landmark: NormalizedLandmark, minConfidence = 0.5): boolean {
  return landmark.visibility >= minConfidence;
}

/**
 * Validate if all required landmarks have sufficient confidence
 * @param landmarks Array of landmarks to validate
 * @param minConfidence Minimum visibility threshold (default: 0.5)
 * @returns True if all landmarks are reliable
 */
export function areLandmarksReliable(landmarks: NormalizedLandmark[], minConfidence = 0.5): boolean {
  return landmarks.every((landmark) => isLandmarkReliable(landmark, minConfidence));
}

/**
 * Test utility to create precise landmarks for angle testing
 * @param centerX X coordinate of the vertex
 * @param centerY Y coordinate of the vertex
 * @param angleDegrees Desired angle in degrees
 * @param armLength Length of the arms from vertex
 * @returns Object with three landmarks forming the specified angle
 */
export function createAngleTestLandmarks(
  centerX: number,
  centerY: number,
  angleDegrees: number,
  armLength = 0.1,
): {
  pointA: NormalizedLandmark;
  vertex: NormalizedLandmark;
  pointC: NormalizedLandmark;
} {
  // Create vertex at center
  const vertex: NormalizedLandmark = {
    x: centerX,
    y: centerY,
    z: 0,
    visibility: 1.0,
  };

  // Point A - horizontal to the left (reference arm)
  const pointA: NormalizedLandmark = {
    x: centerX - armLength,
    y: centerY,
    z: 0,
    visibility: 1.0,
  };

  // Point C - positioned to create the specified angle with point A
  // For angle measurement, we need to consider the angle between vectors BA and BC
  // If we want angle ABC = angleDegrees, then:
  // - Vector BA points from B to A (right to left, angle = 180°)
  // - Vector BC should be at (180° - angleDegrees) from the positive X axis
  const vectorBCAngle = Math.PI - (angleDegrees * Math.PI) / 180;

  const pointC: NormalizedLandmark = {
    x: centerX + armLength * Math.cos(vectorBCAngle),
    y: centerY + armLength * Math.sin(vectorBCAngle),
    z: 0,
    visibility: 1.0,
  };

  return { pointA, vertex, pointC };
}

/**
 * Test utility to create landmarks at specific distances
 * @param startX Starting X coordinate
 * @param startY Starting Y coordinate
 * @param distance Desired distance between points
 * @param direction Direction in degrees (0 = right, 90 = down)
 * @returns Object with two landmarks at the specified distance
 */
export function createDistanceTestLandmarks(
  startX: number,
  startY: number,
  distance: number,
  direction = 0,
): {
  pointA: NormalizedLandmark;
  pointB: NormalizedLandmark;
} {
  const directionRadians = (direction * Math.PI) / 180;

  const pointA: NormalizedLandmark = {
    x: startX,
    y: startY,
    z: 0,
    visibility: 1.0,
  };

  const pointB: NormalizedLandmark = {
    x: startX + distance * Math.cos(directionRadians),
    y: startY + distance * Math.sin(directionRadians),
    z: 0,
    visibility: 1.0,
  };

  return { pointA, pointB };
}

/**
 * Test utility for floating point comparisons with tolerance
 * @param actual Actual value
 * @param expected Expected value
 * @param tolerance Acceptable difference (default: 0.001)
 * @returns True if values are within tolerance
 */
export function approximatelyEqual(actual: number, expected: number, tolerance = 0.001): boolean {
  return Math.abs(actual - expected) <= tolerance;
}

/**
 * Test utility to generate landmarks along a straight line
 * Useful for testing bar path tracking
 * @param start Starting landmark
 * @param end Ending landmark
 * @param numPoints Number of intermediate points to generate
 * @returns Array of landmarks forming a straight line
 */
export function generateStraightLineLandmarks(
  start: NormalizedLandmark,
  end: NormalizedLandmark,
  numPoints: number,
): NormalizedLandmark[] {
  const landmarks: NormalizedLandmark[] = [start];

  for (let i = 1; i < numPoints - 1; i++) {
    const ratio = i / (numPoints - 1);
    landmarks.push({
      x: start.x + (end.x - start.x) * ratio,
      y: start.y + (end.y - start.y) * ratio,
      z: start.z + (end.z - start.z) * ratio,
      visibility: Math.min(start.visibility, end.visibility),
    });
  }

  landmarks.push(end);
  return landmarks;
}

/**
 * Test utility to add random noise to landmarks
 * Useful for testing robustness of calculations
 * @param landmarks Original landmarks
 * @param noiseLevel Maximum noise to add (default: 0.01)
 * @returns Landmarks with added noise
 */
export function addNoiseLandmarks(landmarks: NormalizedLandmark[], noiseLevel = 0.01): NormalizedLandmark[] {
  return landmarks.map((landmark) => ({
    ...landmark,
    x: landmark.x + (Math.random() - 0.5) * 2 * noiseLevel,
    y: landmark.y + (Math.random() - 0.5) * 2 * noiseLevel,
    z: landmark.z + (Math.random() - 0.5) * 2 * noiseLevel,
  }));
}
