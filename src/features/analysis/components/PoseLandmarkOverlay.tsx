import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { memo, useMemo } from 'react';

export interface PoseLandmarkOverlayProps {
  /** MediaPipe pose landmarks to visualize */
  landmarks?: NormalizedLandmark[];
  /** Width of the video/canvas for coordinate conversion */
  width: number;
  /** Height of the video/canvas for coordinate conversion */
  height: number;
  /** Whether pose is currently valid/detected */
  isValidPose: boolean;
  /** Confidence level of pose detection */
  confidence: number;
}

/**
 * Essential squat analysis landmark indices
 * Based on MediaPipe Pose landmark model
 */
const SQUAT_LANDMARKS = {
  // Shoulders (bar position tracking)
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,

  // Hips (depth reference points)
  LEFT_HIP: 23,
  RIGHT_HIP: 24,

  // Knees (depth calculation)
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,

  // Ankles (stability base)
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
} as const;

/**
 * Pose connections for squat analysis visualization
 * Only showing the most relevant connections for squats
 */
const SQUAT_CONNECTIONS = [
  // Torso
  [SQUAT_LANDMARKS.LEFT_SHOULDER, SQUAT_LANDMARKS.RIGHT_SHOULDER],
  [SQUAT_LANDMARKS.LEFT_SHOULDER, SQUAT_LANDMARKS.LEFT_HIP],
  [SQUAT_LANDMARKS.RIGHT_SHOULDER, SQUAT_LANDMARKS.RIGHT_HIP],
  [SQUAT_LANDMARKS.LEFT_HIP, SQUAT_LANDMARKS.RIGHT_HIP],

  // Left leg
  [SQUAT_LANDMARKS.LEFT_HIP, SQUAT_LANDMARKS.LEFT_KNEE],
  [SQUAT_LANDMARKS.LEFT_KNEE, SQUAT_LANDMARKS.LEFT_ANKLE],

  // Right leg
  [SQUAT_LANDMARKS.RIGHT_HIP, SQUAT_LANDMARKS.RIGHT_KNEE],
  [SQUAT_LANDMARKS.RIGHT_KNEE, SQUAT_LANDMARKS.RIGHT_ANKLE],
] as const;

/**
 * Convert normalized landmark coordinates to pixel coordinates
 */
const landmarkToPixel = (landmark: NormalizedLandmark, width: number, height: number) => ({
  x: landmark.x * width,
  y: landmark.y * height,
  z: landmark.z,
});

/**
 * Component for rendering pose landmarks and connections over camera feed
 *
 * Shows key body points and connections relevant for squat analysis:
 * - Shoulders (bar position)
 * - Hips and knees (depth tracking)
 * - Ankles (stability)
 *
 * Uses color coding to indicate pose quality and confidence.
 *
 * Performance optimizations:
 * - Memoized with custom comparison to prevent unnecessary re-renders
 * - Color calculations are memoized based on confidence
 * - Landmark transformations are memoized
 */
const PoseLandmarkOverlayComponent = ({
  landmarks,
  width,
  height,
  isValidPose,
  confidence,
}: PoseLandmarkOverlayProps) => {
  // Memoize color scheme based on confidence to avoid recalculation
  const colors = useMemo(() => {
    if (confidence >= 0.8) {
      return {
        landmark: '#22c55e', // green-500
        connection: '#22c55e',
        highlight: '#16a34a', // green-600
      };
    } else if (confidence >= 0.6) {
      return {
        landmark: '#eab308', // yellow-500
        connection: '#eab308',
        highlight: '#ca8a04', // yellow-600
      };
    } else {
      return {
        landmark: '#ef4444', // red-500
        connection: '#ef4444',
        highlight: '#dc2626', // red-600
      };
    }
  }, [confidence]);

  // Memoize the connections rendering to avoid recalculating pixel coordinates
  const connectionsElements = useMemo(() => {
    return SQUAT_CONNECTIONS.map(([startIdx, endIdx]) => {
      const startLandmark = landmarks?.[startIdx];
      const endLandmark = landmarks?.[endIdx];

      if (!startLandmark || !endLandmark) return null;

      const start = landmarkToPixel(startLandmark, width, height);
      const end = landmarkToPixel(endLandmark, width, height);

      return (
        <line
          key={`connection-${startIdx}-${endIdx}`}
          x1={start.x}
          y1={start.y}
          x2={end.x}
          y2={end.y}
          stroke={colors.connection}
          strokeWidth="3"
          opacity="0.7"
        />
      );
    });
  }, [landmarks, width, height, colors.connection]);

  // Memoize the landmarks rendering
  const landmarkElements = useMemo(() => {
    return Object.entries(SQUAT_LANDMARKS).map(([name, landmarkIndex]) => {
      const landmark = landmarks?.[landmarkIndex];
      if (!landmark) return null;

      const pixel = landmarkToPixel(landmark, width, height);

      // Highlight critical points for squat analysis
      const isCritical = name.includes('HIP') || name.includes('KNEE');
      const radius = isCritical ? 8 : 6;
      const strokeWidth = isCritical ? 3 : 2;

      return (
        <g key={`landmark-${name}`}>
          {/* Outer ring for critical points */}
          {isCritical && (
            <circle
              cx={pixel.x}
              cy={pixel.y}
              r={radius + 2}
              fill="none"
              stroke={colors.highlight}
              strokeWidth="2"
              opacity="0.5"
            />
          )}

          {/* Main landmark point */}
          <circle
            cx={pixel.x}
            cy={pixel.y}
            r={radius}
            fill={colors.landmark}
            stroke="white"
            strokeWidth={strokeWidth}
            opacity="0.9"
          />
        </g>
      );
    });
  }, [landmarks, width, height, colors.landmark, colors.highlight]);

  // Early return check after all hooks
  if (!landmarks || landmarks.length === 0 || !isValidPose) {
    return null;
  }

  return (
    <svg
      className="pointer-events-none absolute inset-0"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ transform: 'scaleX(-1)' }} // Mirror to match camera feed
    >
      {/* Render connections first (behind landmarks) */}
      {connectionsElements}

      {/* Render key landmarks */}
      {landmarkElements}

      {/* Confidence indicator */}
      <g transform={`translate(${width - 120}, 20)`}>
        <rect x="0" y="0" width="100" height="20" rx="10" fill="rgba(0, 0, 0, 0.6)" />
        <rect x="2" y="2" width={96 * confidence} height="16" rx="8" fill={colors.landmark} />
        <text x="50" y="14" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">
          {Math.round(confidence * 100)}%
        </text>
      </g>
    </svg>
  );
};

/**
 * Custom comparison function for React.memo
 *
 * Optimizes re-renders by:
 * 1. Skipping if dimensions haven't changed
 * 2. Skipping if pose validity and confidence are the same
 * 3. Deep comparing landmarks only when necessary
 */
const arePropsEqual = (prevProps: PoseLandmarkOverlayProps, nextProps: PoseLandmarkOverlayProps): boolean => {
  // Quick checks first
  if (prevProps.width !== nextProps.width || prevProps.height !== nextProps.height) {
    return false;
  }

  if (prevProps.isValidPose !== nextProps.isValidPose) {
    return false;
  }

  // If not valid pose, no need to check further
  if (!prevProps.isValidPose && !nextProps.isValidPose) {
    return true;
  }

  // Check confidence with tolerance (avoid re-renders for tiny changes)
  if (Math.abs(prevProps.confidence - nextProps.confidence) > 0.05) {
    return false;
  }

  // Check landmarks existence
  if (!prevProps.landmarks && !nextProps.landmarks) {
    return true;
  }

  if (!prevProps.landmarks || !nextProps.landmarks) {
    return false;
  }

  if (prevProps.landmarks.length !== nextProps.landmarks.length) {
    return false;
  }

  // Deep compare only the landmarks we actually use
  const landmarkIndices = Object.values(SQUAT_LANDMARKS);
  for (const index of landmarkIndices) {
    const prevLandmark = prevProps.landmarks[index];
    const nextLandmark = nextProps.landmarks[index];

    if (!prevLandmark && !nextLandmark) continue;
    if (!prevLandmark || !nextLandmark) return false;

    // Check with small tolerance to avoid re-renders for micro-movements
    const tolerance = 0.001;
    if (
      Math.abs(prevLandmark.x - nextLandmark.x) > tolerance ||
      Math.abs(prevLandmark.y - nextLandmark.y) > tolerance ||
      Math.abs(prevLandmark.z - nextLandmark.z) > tolerance
    ) {
      return false;
    }
  }

  return true;
};

/**
 * Memoized PoseLandmarkOverlay component
 *
 * This component is heavily optimized for performance:
 * - Only re-renders when meaningful changes occur
 * - Ignores micro-movements below threshold
 * - Skips deep comparison when pose is invalid
 */
export const PoseLandmarkOverlay = memo(PoseLandmarkOverlayComponent, arePropsEqual);
