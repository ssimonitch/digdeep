import type { NormalizedLandmark, PoseLandmarkerResult } from '@mediapipe/tasks-vision';

/**
 * Test fixtures for pose detection testing
 * Based on MediaPipe Pose landmarks:
 * https://developers.google.com/mediapipe/solutions/vision/pose_landmarker
 */

// MediaPipe landmark indices
export const LANDMARK_INDICES = {
  // Face landmarks
  NOSE: 0,
  LEFT_EYE_INNER: 1,
  LEFT_EYE: 2,
  LEFT_EYE_OUTER: 3,
  RIGHT_EYE_INNER: 4,
  RIGHT_EYE: 5,
  RIGHT_EYE_OUTER: 6,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  MOUTH_LEFT: 9,
  MOUTH_RIGHT: 10,

  // Upper body landmarks
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_PINKY: 17,
  RIGHT_PINKY: 18,
  LEFT_INDEX: 19,
  RIGHT_INDEX: 20,
  LEFT_THUMB: 21,
  RIGHT_THUMB: 22,

  // Lower body landmarks
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32,
} as const;

/**
 * Creates a mock landmark with default visibility and presence
 */
export function createMockLandmark(x: number, y: number, z = 0, visibility = 0.9): NormalizedLandmark {
  return { x, y, z, visibility };
}

/**
 * Creates a complete set of 33 landmarks initialized to default positions
 */
export function createDefaultLandmarks(): NormalizedLandmark[] {
  const landmarks: NormalizedLandmark[] = [];

  // Initialize all 33 landmarks with neutral standing position
  for (let i = 0; i < 33; i++) {
    landmarks.push(createMockLandmark(0.5, 0.5, 0, 0.9));
  }

  // Set realistic default positions for key landmarks
  // Head
  landmarks[LANDMARK_INDICES.NOSE] = createMockLandmark(0.5, 0.15, 0, 0.95);

  // Shoulders (slightly wider than center)
  landmarks[LANDMARK_INDICES.LEFT_SHOULDER] = createMockLandmark(0.45, 0.25, 0, 0.95);
  landmarks[LANDMARK_INDICES.RIGHT_SHOULDER] = createMockLandmark(0.55, 0.25, 0, 0.95);

  // Hips (hip width)
  landmarks[LANDMARK_INDICES.LEFT_HIP] = createMockLandmark(0.47, 0.5, 0, 0.9);
  landmarks[LANDMARK_INDICES.RIGHT_HIP] = createMockLandmark(0.53, 0.5, 0, 0.9);

  // Knees (straight down from hips)
  landmarks[LANDMARK_INDICES.LEFT_KNEE] = createMockLandmark(0.47, 0.7, 0, 0.9);
  landmarks[LANDMARK_INDICES.RIGHT_KNEE] = createMockLandmark(0.53, 0.7, 0, 0.9);

  // Ankles (straight down from knees)
  landmarks[LANDMARK_INDICES.LEFT_ANKLE] = createMockLandmark(0.47, 0.9, 0, 0.85);
  landmarks[LANDMARK_INDICES.RIGHT_ANKLE] = createMockLandmark(0.53, 0.9, 0, 0.85);

  return landmarks;
}

/**
 * Creates a PoseLandmarkerResult with the given landmarks
 */
export function createMockPoseResult(landmarks: NormalizedLandmark[]): PoseLandmarkerResult {
  return {
    landmarks: [landmarks],
    worldLandmarks: [landmarks], // Simplified - in reality these would be in world coordinates
    segmentationMasks: undefined,
    close: () => {
      // Do nothing
    },
  };
}

// Pre-built fixture sets for common squat positions
export const SQUAT_FIXTURES = {
  /**
   * Standing position - starting position for squat
   */
  standing: createMockPoseResult(createDefaultLandmarks()),

  /**
   * Proper depth squat - hip crease below knee
   */
  properDepth: createMockPoseResult(
    (() => {
      const landmarks = createDefaultLandmarks();

      // Hips drop below knees (y increases downward in normalized coords)
      landmarks[LANDMARK_INDICES.LEFT_HIP] = createMockLandmark(0.47, 0.72, 0, 0.9);
      landmarks[LANDMARK_INDICES.RIGHT_HIP] = createMockLandmark(0.53, 0.72, 0, 0.9);

      // Knees at ~90 degrees
      landmarks[LANDMARK_INDICES.LEFT_KNEE] = createMockLandmark(0.45, 0.7, 0, 0.9);
      landmarks[LANDMARK_INDICES.RIGHT_KNEE] = createMockLandmark(0.55, 0.7, 0, 0.9);

      // Shoulders stay relatively stable
      landmarks[LANDMARK_INDICES.LEFT_SHOULDER] = createMockLandmark(0.45, 0.27, 0, 0.95);
      landmarks[LANDMARK_INDICES.RIGHT_SHOULDER] = createMockLandmark(0.55, 0.27, 0, 0.95);

      return landmarks;
    })(),
  ),

  /**
   * Shallow squat - not hitting proper depth
   */
  shallowSquat: createMockPoseResult(
    (() => {
      const landmarks = createDefaultLandmarks();

      // Hips above knees (insufficient depth)
      landmarks[LANDMARK_INDICES.LEFT_HIP] = createMockLandmark(0.47, 0.65, 0, 0.9);
      landmarks[LANDMARK_INDICES.RIGHT_HIP] = createMockLandmark(0.53, 0.65, 0, 0.9);

      // Knees partially bent
      landmarks[LANDMARK_INDICES.LEFT_KNEE] = createMockLandmark(0.46, 0.7, 0, 0.9);
      landmarks[LANDMARK_INDICES.RIGHT_KNEE] = createMockLandmark(0.54, 0.7, 0, 0.9);

      return landmarks;
    })(),
  ),

  /**
   * Lateral shift - weight shifted to left side
   */
  lateralShiftLeft: createMockPoseResult(
    (() => {
      const landmarks = createDefaultLandmarks();

      // Hips shifted left
      landmarks[LANDMARK_INDICES.LEFT_HIP] = createMockLandmark(0.42, 0.72, 0, 0.9);
      landmarks[LANDMARK_INDICES.RIGHT_HIP] = createMockLandmark(0.48, 0.72, 0, 0.9);

      // Knees follow hip shift
      landmarks[LANDMARK_INDICES.LEFT_KNEE] = createMockLandmark(0.4, 0.7, 0, 0.9);
      landmarks[LANDMARK_INDICES.RIGHT_KNEE] = createMockLandmark(0.5, 0.7, 0, 0.9);

      // Shoulders compensate slightly
      landmarks[LANDMARK_INDICES.LEFT_SHOULDER] = createMockLandmark(0.43, 0.27, 0, 0.95);
      landmarks[LANDMARK_INDICES.RIGHT_SHOULDER] = createMockLandmark(0.53, 0.27, 0, 0.95);

      return landmarks;
    })(),
  ),

  /**
   * Forward lean - excessive forward torso angle
   */
  forwardLean: createMockPoseResult(
    (() => {
      const landmarks = createDefaultLandmarks();

      // Shoulders moved forward
      landmarks[LANDMARK_INDICES.LEFT_SHOULDER] = createMockLandmark(0.43, 0.35, 0, 0.95);
      landmarks[LANDMARK_INDICES.RIGHT_SHOULDER] = createMockLandmark(0.53, 0.35, 0, 0.95);

      // Hips at depth but pushed back
      landmarks[LANDMARK_INDICES.LEFT_HIP] = createMockLandmark(0.49, 0.72, 0, 0.9);
      landmarks[LANDMARK_INDICES.RIGHT_HIP] = createMockLandmark(0.55, 0.72, 0, 0.9);

      // Knees stay relatively vertical
      landmarks[LANDMARK_INDICES.LEFT_KNEE] = createMockLandmark(0.47, 0.7, 0, 0.9);
      landmarks[LANDMARK_INDICES.RIGHT_KNEE] = createMockLandmark(0.53, 0.7, 0, 0.9);

      return landmarks;
    })(),
  ),

  /**
   * Knee cave (valgus) - knees collapsing inward
   */
  kneeCave: createMockPoseResult(
    (() => {
      const landmarks = createDefaultLandmarks();

      // Hips at proper depth
      landmarks[LANDMARK_INDICES.LEFT_HIP] = createMockLandmark(0.47, 0.72, 0, 0.9);
      landmarks[LANDMARK_INDICES.RIGHT_HIP] = createMockLandmark(0.53, 0.72, 0, 0.9);

      // Knees cave inward (x positions closer together than hips)
      landmarks[LANDMARK_INDICES.LEFT_KNEE] = createMockLandmark(0.49, 0.7, 0, 0.9);
      landmarks[LANDMARK_INDICES.RIGHT_KNEE] = createMockLandmark(0.51, 0.7, 0, 0.9);

      // Ankles stay wide
      landmarks[LANDMARK_INDICES.LEFT_ANKLE] = createMockLandmark(0.45, 0.9, 0, 0.85);
      landmarks[LANDMARK_INDICES.RIGHT_ANKLE] = createMockLandmark(0.55, 0.9, 0, 0.85);

      return landmarks;
    })(),
  ),

  /**
   * Low confidence - some landmarks have poor visibility
   */
  lowConfidence: createMockPoseResult(
    (() => {
      const landmarks = createDefaultLandmarks();

      // Set some key landmarks to low visibility
      landmarks[LANDMARK_INDICES.LEFT_HIP] = createMockLandmark(0.47, 0.72, 0, 0.4);
      landmarks[LANDMARK_INDICES.RIGHT_HIP] = createMockLandmark(0.53, 0.72, 0, 0.5);
      landmarks[LANDMARK_INDICES.LEFT_KNEE] = createMockLandmark(0.45, 0.7, 0, 0.3);

      return landmarks;
    })(),
  ),

  /**
   * Missing landmarks - some landmarks not detected
   */
  missingLandmarks: createMockPoseResult(
    (() => {
      const landmarks = createDefaultLandmarks();

      // Set some landmarks to very low visibility (effectively missing)
      landmarks[LANDMARK_INDICES.LEFT_ANKLE] = createMockLandmark(0, 0, 0, 0);
      landmarks[LANDMARK_INDICES.RIGHT_ANKLE] = createMockLandmark(0, 0, 0, 0);
      landmarks[LANDMARK_INDICES.LEFT_HEEL] = createMockLandmark(0, 0, 0, 0);
      landmarks[LANDMARK_INDICES.RIGHT_HEEL] = createMockLandmark(0, 0, 0, 0);

      return landmarks;
    })(),
  ),
};

// Pre-built fixtures for bench press positions
export const BENCH_FIXTURES = {
  /**
   * Starting position - bar at chest level
   */
  bottomPosition: createMockPoseResult(
    (() => {
      const landmarks = createDefaultLandmarks();

      // Shoulders on bench
      landmarks[LANDMARK_INDICES.LEFT_SHOULDER] = createMockLandmark(0.35, 0.5, 0, 0.95);
      landmarks[LANDMARK_INDICES.RIGHT_SHOULDER] = createMockLandmark(0.65, 0.5, 0, 0.95);

      // Elbows flared at ~45 degrees
      landmarks[LANDMARK_INDICES.LEFT_ELBOW] = createMockLandmark(0.25, 0.55, 0, 0.9);
      landmarks[LANDMARK_INDICES.RIGHT_ELBOW] = createMockLandmark(0.75, 0.55, 0, 0.9);

      // Wrists above elbows (holding bar)
      landmarks[LANDMARK_INDICES.LEFT_WRIST] = createMockLandmark(0.3, 0.45, 0, 0.9);
      landmarks[LANDMARK_INDICES.RIGHT_WRIST] = createMockLandmark(0.7, 0.45, 0, 0.9);

      return landmarks;
    })(),
  ),

  /**
   * Top position - arms extended
   */
  topPosition: createMockPoseResult(
    (() => {
      const landmarks = createDefaultLandmarks();

      // Shoulders on bench
      landmarks[LANDMARK_INDICES.LEFT_SHOULDER] = createMockLandmark(0.35, 0.5, 0, 0.95);
      landmarks[LANDMARK_INDICES.RIGHT_SHOULDER] = createMockLandmark(0.65, 0.5, 0, 0.95);

      // Elbows nearly straight
      landmarks[LANDMARK_INDICES.LEFT_ELBOW] = createMockLandmark(0.33, 0.35, 0, 0.9);
      landmarks[LANDMARK_INDICES.RIGHT_ELBOW] = createMockLandmark(0.67, 0.35, 0, 0.9);

      // Wrists above shoulders (arms extended)
      landmarks[LANDMARK_INDICES.LEFT_WRIST] = createMockLandmark(0.32, 0.2, 0, 0.9);
      landmarks[LANDMARK_INDICES.RIGHT_WRIST] = createMockLandmark(0.68, 0.2, 0, 0.9);

      return landmarks;
    })(),
  ),
};

// Pre-built fixtures for deadlift positions
export const DEADLIFT_FIXTURES = {
  /**
   * Starting position - bar on floor
   */
  startPosition: createMockPoseResult(
    (() => {
      const landmarks = createDefaultLandmarks();

      // Hips high, hinged position
      landmarks[LANDMARK_INDICES.LEFT_HIP] = createMockLandmark(0.47, 0.45, 0, 0.9);
      landmarks[LANDMARK_INDICES.RIGHT_HIP] = createMockLandmark(0.53, 0.45, 0, 0.9);

      // Knees slightly bent
      landmarks[LANDMARK_INDICES.LEFT_KNEE] = createMockLandmark(0.47, 0.65, 0, 0.9);
      landmarks[LANDMARK_INDICES.RIGHT_KNEE] = createMockLandmark(0.53, 0.65, 0, 0.9);

      // Shoulders over bar
      landmarks[LANDMARK_INDICES.LEFT_SHOULDER] = createMockLandmark(0.45, 0.4, 0, 0.95);
      landmarks[LANDMARK_INDICES.RIGHT_SHOULDER] = createMockLandmark(0.55, 0.4, 0, 0.95);

      // Hands at bar level
      landmarks[LANDMARK_INDICES.LEFT_WRIST] = createMockLandmark(0.43, 0.75, 0, 0.9);
      landmarks[LANDMARK_INDICES.RIGHT_WRIST] = createMockLandmark(0.57, 0.75, 0, 0.9);

      return landmarks;
    })(),
  ),

  /**
   * Lockout position - standing with bar
   */
  lockoutPosition: createMockPoseResult(
    (() => {
      const landmarks = createDefaultLandmarks();

      // Standing tall
      landmarks[LANDMARK_INDICES.LEFT_HIP] = createMockLandmark(0.47, 0.5, 0, 0.9);
      landmarks[LANDMARK_INDICES.RIGHT_HIP] = createMockLandmark(0.53, 0.5, 0, 0.9);

      // Knees straight
      landmarks[LANDMARK_INDICES.LEFT_KNEE] = createMockLandmark(0.47, 0.7, 0, 0.9);
      landmarks[LANDMARK_INDICES.RIGHT_KNEE] = createMockLandmark(0.53, 0.7, 0, 0.9);

      // Shoulders back
      landmarks[LANDMARK_INDICES.LEFT_SHOULDER] = createMockLandmark(0.45, 0.25, 0, 0.95);
      landmarks[LANDMARK_INDICES.RIGHT_SHOULDER] = createMockLandmark(0.55, 0.25, 0, 0.95);

      // Hands at hip level (holding bar)
      landmarks[LANDMARK_INDICES.LEFT_WRIST] = createMockLandmark(0.43, 0.5, 0, 0.9);
      landmarks[LANDMARK_INDICES.RIGHT_WRIST] = createMockLandmark(0.57, 0.5, 0, 0.9);

      return landmarks;
    })(),
  ),
};
