/**
 * Squat-specific configuration types
 *
 * Contains all type definitions specific to squat exercise analysis.
 */

import type { ExerciseConfig } from '../base/types';

/**
 * Squat-specific configuration parameters
 *
 * Contains all the thresholds and parameters specific to squat analysis,
 * extracted from SquatPoseAnalyzer to eliminate magic numbers.
 */
export interface SquatAnalysisConfig {
  /** MediaPipe confidence thresholds */
  mediaPipe: {
    /** Minimum pose detection confidence (0-1) */
    minPoseDetectionConfidence: number;
    /** Minimum pose presence confidence (0-1) */
    minPosePresenceConfidence: number;
    /** Minimum tracking confidence (0-1) */
    minTrackingConfidence: number;
  };

  /** Depth achievement and rep counting thresholds */
  depth: {
    /** Depth achievement threshold (0-1, e.g., 0.9 = 90%) */
    depthThreshold: number;
    /** Start rep when depth exceeds this percentage */
    startRepThreshold: number;
    /** Bottom phase when depth exceeds this percentage */
    bottomPhaseThreshold: number;
    /** Ascending phase when depth drops below this percentage */
    ascendingThreshold: number;
    /** Complete rep when depth drops below this percentage */
    completeRepThreshold: number;
  };

  /** Landmark visibility requirements */
  visibility: {
    /** Minimum visibility for key landmarks (0-1) */
    minLandmarkVisibility: number;
    /** Minimum visibility for valid bar position (shoulders) */
    barPositionVisibility: number;
  };

  /** Balance and lateral shift thresholds */
  balance: {
    /** Maximum lateral deviation as fraction of hip width (e.g., 0.05 = 5%) */
    maxLateralDeviationRatio: number;
    /** Standing position detection ratio (hip/knee < this value) */
    standingPositionRatio: number;
  };

  /** Form validation thresholds for rep quality */
  validation: {
    /** Maximum lateral shift for valid rep (0-1) */
    maxLateralShift: number;
    /** Maximum bar path deviation for valid rep (0-1) */
    maxBarPathDeviation: number;
    /** Maximum knee angle for valid squat position (degrees) */
    maxValidKneeAngle: number;
  };
}

/**
 * Complete squat configuration combining detection and analysis parameters
 */
export interface SquatExerciseConfig extends ExerciseConfig {
  /** Squat-specific analysis configuration */
  analysis: SquatAnalysisConfig;
}
