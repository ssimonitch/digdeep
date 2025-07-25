/**
 * Squat-specific validation utilities
 *
 * Provides validation functions for squat exercise configuration.
 */

import type { ConfigValidationResult } from '../base/types';
import type { SquatAnalysisConfig } from './types';

/**
 * Validates a squat analysis configuration
 */
export function validateSquatAnalysisConfig(config: SquatAnalysisConfig): ConfigValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate MediaPipe confidence values (0-1)
  const { mediaPipe } = config;
  if (mediaPipe.minPoseDetectionConfidence < 0 || mediaPipe.minPoseDetectionConfidence > 1) {
    errors.push('mediaPipe.minPoseDetectionConfidence must be between 0 and 1');
  }
  if (mediaPipe.minPosePresenceConfidence < 0 || mediaPipe.minPosePresenceConfidence > 1) {
    errors.push('mediaPipe.minPosePresenceConfidence must be between 0 and 1');
  }
  if (mediaPipe.minTrackingConfidence < 0 || mediaPipe.minTrackingConfidence > 1) {
    errors.push('mediaPipe.minTrackingConfidence must be between 0 and 1');
  }

  // Validate depth thresholds
  const { depth } = config;
  if (depth.depthThreshold < 0 || depth.depthThreshold > 1) {
    errors.push('depth.depthThreshold must be between 0 and 1');
  }
  if (depth.startRepThreshold < 0 || depth.startRepThreshold > 100) {
    errors.push('depth.startRepThreshold must be between 0 and 100 (percentage)');
  }
  if (depth.bottomPhaseThreshold < 0 || depth.bottomPhaseThreshold > 100) {
    errors.push('depth.bottomPhaseThreshold must be between 0 and 100 (percentage)');
  }
  if (depth.ascendingThreshold < 0 || depth.ascendingThreshold > 100) {
    errors.push('depth.ascendingThreshold must be between 0 and 100 (percentage)');
  }
  if (depth.completeRepThreshold < 0 || depth.completeRepThreshold > 100) {
    errors.push('depth.completeRepThreshold must be between 0 and 100 (percentage)');
  }

  // Validate rep phase progression logic
  if (depth.startRepThreshold >= depth.bottomPhaseThreshold) {
    errors.push('depth.startRepThreshold must be less than depth.bottomPhaseThreshold');
  }
  if (depth.ascendingThreshold >= depth.bottomPhaseThreshold) {
    warnings.push('depth.ascendingThreshold should typically be less than depth.bottomPhaseThreshold');
  }
  // Validate hysteresis band for rep counting
  // completeRepThreshold should be greater than startRepThreshold to provide hysteresis
  // This prevents state bouncing when hovering around the threshold
  if (depth.completeRepThreshold <= depth.startRepThreshold) {
    warnings.push(
      'depth.completeRepThreshold should typically be greater than depth.startRepThreshold to provide hysteresis',
    );
  }
  // Warn if hysteresis band is too small
  const hysteresisBand = depth.completeRepThreshold - depth.startRepThreshold;
  if (hysteresisBand > 0 && hysteresisBand < 5) {
    warnings.push(`Hysteresis band of ${hysteresisBand}% between start and complete thresholds may be too small`);
  }

  // Validate visibility thresholds (0-1)
  const { visibility } = config;
  if (visibility.minLandmarkVisibility < 0 || visibility.minLandmarkVisibility > 1) {
    errors.push('visibility.minLandmarkVisibility must be between 0 and 1');
  }
  if (visibility.barPositionVisibility < 0 || visibility.barPositionVisibility > 1) {
    errors.push('visibility.barPositionVisibility must be between 0 and 1');
  }

  // Validate balance thresholds
  const { balance } = config;
  if (balance.maxLateralDeviationRatio < 0 || balance.maxLateralDeviationRatio > 1) {
    errors.push('balance.maxLateralDeviationRatio must be between 0 and 1');
  }
  if (balance.standingPositionRatio < 0 || balance.standingPositionRatio > 2) {
    errors.push('balance.standingPositionRatio must be between 0 and 2 (ratio)');
  }

  // Validate form validation thresholds
  const { validation } = config;
  if (validation.maxLateralShift < 0 || validation.maxLateralShift > 1) {
    errors.push('validation.maxLateralShift must be between 0 and 1');
  }
  if (validation.maxBarPathDeviation < 0 || validation.maxBarPathDeviation > 1) {
    errors.push('validation.maxBarPathDeviation must be between 0 and 1');
  }
  if (validation.maxValidKneeAngle < 0 || validation.maxValidKneeAngle > 180) {
    errors.push('validation.maxValidKneeAngle must be between 0 and 180 degrees');
  }

  // Add warnings for potentially problematic configurations
  if (mediaPipe.minPoseDetectionConfidence < 0.5) {
    warnings.push('Very low MediaPipe confidence may result in poor pose detection quality');
  }
  if (depth.depthThreshold > 0.95) {
    warnings.push('Very high depth threshold may be difficult for users to achieve');
  }
  if (visibility.minLandmarkVisibility < 0.5) {
    warnings.push('Low visibility threshold may result in inaccurate analysis');
  }
  if (validation.maxValidKneeAngle > 160) {
    warnings.push('High knee angle threshold may allow non-squat positions to be considered valid');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
