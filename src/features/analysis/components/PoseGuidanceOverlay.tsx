import type { FC } from 'react';

import type { DetectionState } from '@/features/pose-detection/services/pose-validity-stabilizer';

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
   * Visibility scores for key body landmarks (0-1)
   * Used to provide specific guidance about which body parts need adjustment
   */
  keyLandmarkVisibility?: {
    shoulders: number;
    hips: number;
    knees: number;
    ankles: number;
  };
}

/**
 * PoseGuidanceOverlay - Enhanced feedback component for pose detection
 *
 * Provides real-time guidance to help users position themselves correctly for pose analysis.
 * Features include:
 * - Three-state detection feedback (invalid, detecting, valid)
 * - Confidence percentage with visual progress bar
 * - Smart guidance messages prioritizing most critical missing body parts
 * - Smooth transitions between states with color-coded feedback
 *
 * @example
 * ```tsx
 * <PoseGuidanceOverlay
 *   detectionState={isValidPose ? 'valid' : confidence > 0.5 ? 'detecting' : 'invalid'}
 *   confidence={0.85}
 *   keyLandmarkVisibility={{
 *     shoulders: 0.9,
 *     hips: 0.8,
 *     knees: 0.9,
 *     ankles: 0.85
 *   }}
 * />
 * ```
 */
export const PoseGuidanceOverlay: FC<PoseGuidanceOverlayProps> = ({
  detectionState,
  confidence,
  keyLandmarkVisibility,
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
    if (!keyLandmarkVisibility) {
      return 'Make sure your full body is visible';
    }

    const { shoulders, hips, knees, ankles } = keyLandmarkVisibility;
    const visibilityThreshold = 0.5;

    // Check if all landmarks have low visibility
    if (
      shoulders < visibilityThreshold &&
      hips < visibilityThreshold &&
      knees < visibilityThreshold &&
      ankles < visibilityThreshold
    ) {
      return 'Step back and ensure full body is visible';
    }

    // Priority order: hips > knees > ankles > shoulders
    if (hips < visibilityThreshold) {
      return 'Hips not visible - step back from camera';
    }
    if (knees < visibilityThreshold) {
      return 'Knees not visible - ensure full body is in frame';
    }
    if (ankles < visibilityThreshold) {
      return 'Ankles not visible - step back from camera';
    }
    if (shoulders < visibilityThreshold) {
      return 'Shoulders not visible - adjust your position';
    }

    return 'Make sure your full body is visible';
  };

  // Format confidence as percentage
  const confidencePercentage = Math.round(confidence * 100);

  return (
    <div
      className={`absolute top-4 left-1/2 z-10 -translate-x-1/2 rounded-lg p-4 shadow-lg transition-all duration-300 ${getBackgroundClass()}`}
    >
      {/* Main heading */}
      <h3 className="mb-2 text-lg font-bold text-white">{getHeadingText()}</h3>

      {/* Subtitle/guidance */}
      <p className="mb-3 text-sm text-gray-200">{getSubtitleText()}</p>

      {/* Confidence display */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-200">Confidence:</span>
          <span className="font-semibold text-white">{confidencePercentage}%</span>
        </div>

        {/* Progress bar */}
        <div className="h-2 w-48 overflow-hidden rounded-full bg-black/30">
          <div
            role="progressbar"
            aria-valuenow={confidencePercentage}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-full bg-white/70 transition-all duration-300"
            style={{ width: `${confidencePercentage}%` }}
          />
        </div>
      </div>
    </div>
  );
};
