import type { FC } from 'react';
import { memo } from 'react';

import type { VisibilityFlags } from '@/features/pose-detection/adapters/squat/squat-analyzer-adapter';
import type { DetectionState } from '@/features/pose-detection/services';

/**
 * Props for the PoseGuidanceOverlay component
 */
interface PoseGuidanceOverlayProps {
  /**
   * Current detection state from the pose validity stabilizer
   * - 'invalid': Pose not detected or confidence below threshold
   * - 'detecting': Transitioning between states (debouncing)
   * - 'valid': Pose detected with confidence above threshold
   */
  detectionState: DetectionState;

  /**
   * Confidence score from pose detection (0-1)
   * Used to display percentage and progress bar
   */
  confidence: number;

  /**
   * Boolean visibility flags for key body landmarks
   * Used to provide specific guidance about which body parts need adjustment
   */
  visibilityFlags: VisibilityFlags;
}

/**
 * Custom comparison function for React.memo optimization
 * Only re-render if:
 * - detectionState changes (always re-render)
 * - confidence changes significantly (more than 5%)
 * - visibility flags change
 */
const arePropsEqual = (prevProps: PoseGuidanceOverlayProps, nextProps: PoseGuidanceOverlayProps): boolean => {
  // Always re-render if detection state changes
  if (prevProps.detectionState !== nextProps.detectionState) {
    return false;
  }

  // Only re-render if confidence changes significantly (5% threshold)
  const confidenceThreshold = 0.05;
  if (Math.abs(prevProps.confidence - nextProps.confidence) > confidenceThreshold) {
    return false;
  }

  // Compare visibility flags
  if (
    prevProps.visibilityFlags.shoulders !== nextProps.visibilityFlags.shoulders ||
    prevProps.visibilityFlags.hips !== nextProps.visibilityFlags.hips ||
    prevProps.visibilityFlags.knees !== nextProps.visibilityFlags.knees ||
    prevProps.visibilityFlags.ankles !== nextProps.visibilityFlags.ankles
  ) {
    return false;
  }

  return true; // Props are considered equal, skip re-render
};

/**
 * PoseGuidanceOverlay - Enhanced feedback component for pose detection
 *
 * Provides real-time guidance to help users position themselves correctly for pose analysis.
 * Features include:
 * - Three-state detection feedback (invalid, detecting, valid)
 * - Confidence percentage with visual progress bar
 * - Smart guidance messages prioritizing most critical missing body parts
 * - Smooth transitions between states with color-coded feedback
 * - Optimized with React.memo to prevent unnecessary re-renders
 *
 * @example
 * ```tsx
 * <PoseGuidanceOverlay
 *   detectionState={isValidPose ? 'valid' : confidence > 0.5 ? 'detecting' : 'invalid'}
 *   confidence={0.85}
 *   visibilityFlags={{
 *     shoulders: true,
 *     hips: true,
 *     knees: true,
 *     ankles: true
 *   }}
 * />
 * ```
 */
const PoseGuidanceOverlayComponent: FC<PoseGuidanceOverlayProps> = ({
  detectionState,
  confidence,
  visibilityFlags,
}) => {
  // Determine background color based on detection state
  const getBackgroundClass = () => {
    switch (detectionState) {
      case 'valid':
        return 'bg-green-900/90';
      case 'detecting':
        return 'bg-yellow-900/90';
      case 'invalid':
      default:
        return 'bg-red-900/90';
    }
  };

  // Get the main heading text based on detection state
  const getHeadingText = () => {
    switch (detectionState) {
      case 'valid':
        return 'Pose Detected';
      case 'detecting':
        return 'Detecting pose...';
      case 'invalid':
      default:
        return 'Position yourself in frame';
    }
  };

  // Get subtitle text based on detection state
  const getSubtitleText = () => {
    switch (detectionState) {
      case 'valid':
        return 'Ready to analyze';
      case 'detecting':
        return 'Hold your position';
      case 'invalid':
      default:
        return getInvalidStateGuidance();
    }
  };

  // Get specific guidance for invalid state based on landmark visibility
  const getInvalidStateGuidance = () => {
    const { shoulders, hips, knees, ankles } = visibilityFlags;

    // Check if all landmarks are not visible
    const allNotVisible = !shoulders && !hips && !knees && !ankles;

    if (allNotVisible) {
      return 'Step back and ensure full body is visible';
    }

    // Priority order: hips > knees > ankles > shoulders
    if (!hips) {
      return 'Hips not visible - step back from camera';
    }
    if (!knees) {
      return 'Knees not visible - ensure full body is in frame';
    }
    if (!ankles) {
      return 'Ankles not visible - step back from camera';
    }
    if (!shoulders) {
      return 'Shoulders not visible - adjust your position';
    }

    return 'Make sure your full body is visible';
  };

  // Format confidence as percentage
  const confidencePercentage = Math.round(confidence * 100);

  return (
    <div
      className={`absolute top-4 left-1/2 z-10 -translate-x-1/2 rounded-lg p-4 shadow-lg transition-all duration-300 ${getBackgroundClass()}`}
      data-testid="pose-guidance-overlay"
      data-detection-state={detectionState}
      data-confidence={confidencePercentage}
      role="status"
      aria-label={`Pose detection: ${getHeadingText()}`}
    >
      {/* Main heading */}
      <h3
        className="mb-2 text-lg font-bold text-white"
        data-testid="pose-guidance-heading"
        role="heading"
        aria-level={2}
      >
        {getHeadingText()}
      </h3>

      {/* Subtitle/guidance */}
      <p className="mb-3 text-sm text-gray-200" data-testid="pose-guidance-subtitle">
        {getSubtitleText()}
      </p>

      {/* Confidence display */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-200">Confidence:</span>
          <span className="font-semibold text-white" data-testid="pose-confidence-percentage">
            {confidencePercentage}%
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-2 w-48 overflow-hidden rounded-full bg-black/30">
          <div
            role="progressbar"
            aria-valuenow={confidencePercentage}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Pose detection confidence: ${confidencePercentage}%`}
            data-testid="pose-confidence-progressbar"
            className="h-full bg-white/70 transition-all duration-300"
            style={{ width: `${confidencePercentage}%` }}
          />
        </div>
      </div>
    </div>
  );
};

// Export the memoized component
export const PoseGuidanceOverlay = memo(PoseGuidanceOverlayComponent, arePropsEqual);
