/**
 * Squat exercise detection configuration
 *
 * This module provides the centralized configuration for squat pose detection
 * and validity stabilization.
 *
 * Configuration rationale:
 * - upperThreshold (0.7): Requires 70% confidence to enter valid state
 * - lowerThreshold (0.5): Must drop below 50% confidence to start exiting valid state
 * - enterDebounceTime (0): Immediate positive feedback for better UX
 * - exitDebounceTime (200ms): 200ms stability period prevents flickering
 *
 * These values create hysteresis that prevents rapid state transitions while
 * providing instant positive feedback when pose quality improves.
 */

import type { ExerciseDetectionConfig } from '../base/types';
import type { SquatAnalysisConfig, SquatExerciseConfig } from './types';

/**
 * Core squat detection thresholds and timing configuration
 *
 * These values are extracted from the original PoseValidityStabilizer defaults
 * to ensure consistency across the application.
 */
export const SQUAT_DETECTION_CONFIG: ExerciseDetectionConfig = {
  /** Enter valid state at 70% confidence - immediate transition */
  upperThreshold: 0.7,

  /** Exit valid state below 50% confidence - creates hysteresis gap */
  lowerThreshold: 0.5,

  /** No delay for entering valid state - instant positive feedback */
  enterDebounceTime: 0,

  /** 200ms stability period before marking invalid - prevents flickering */
  exitDebounceTime: 200,
} as const;

/**
 * Comprehensive squat analysis configuration
 *
 * Contains all squat-specific thresholds extracted from SquatPoseAnalyzer
 * to eliminate magic numbers and enable configuration-driven development.
 *
 * Values are based on empirical testing and squat biomechanics research.
 */
export const SQUAT_ANALYSIS_CONFIG: SquatAnalysisConfig = {
  /** MediaPipe confidence thresholds optimized for squat detection */
  mediaPipe: {
    /** Higher confidence for squat analysis accuracy */
    minPoseDetectionConfidence: 0.7,
    minPosePresenceConfidence: 0.7,
    minTrackingConfidence: 0.7,
  },

  /** Depth achievement and rep counting phase transitions */
  depth: {
    /** 90% depth requirement for competition-standard squats */
    depthThreshold: 0.9,
    /** Start rep detection when descending beyond 10% */
    startRepThreshold: 10, // percentage
    /** Bottom phase when depth exceeds 80% */
    bottomPhaseThreshold: 80, // percentage
    /** Ascending phase when returning above 70% */
    ascendingThreshold: 70, // percentage
    /** Complete rep when returning to <20% depth */
    completeRepThreshold: 20, // percentage
  },

  /** Landmark visibility requirements for accurate analysis */
  visibility: {
    /** 70% minimum visibility for key landmarks (hips, knees, ankles) */
    minLandmarkVisibility: 0.7,
    /** 70% minimum shoulder visibility for valid bar position tracking */
    barPositionVisibility: 0.7,
  },

  /** Balance and lateral shift detection parameters */
  balance: {
    /** Max lateral deviation = 5% of hip width for balance detection */
    maxLateralDeviationRatio: 0.05,
    /** Hip/knee ratio < 0.8 indicates standing position for calibration */
    standingPositionRatio: 0.8,
  },

  /** Form validation thresholds for rep quality assessment */
  validation: {
    /** Maximum 15% lateral shift for valid rep */
    maxLateralShift: 0.15,
    /** Maximum 20% bar path deviation for valid rep */
    maxBarPathDeviation: 0.2,
    /** Knee angle < 140° indicates squat position (vs. standing) */
    maxValidKneeAngle: 140, // degrees
  },
} as const;

/**
 * Full squat exercise configuration with metadata
 *
 * Extends the detection config with exercise-specific metadata for
 * future multi-exercise support and configuration management.
 */
export const SQUAT_EXERCISE_CONFIG: SquatExerciseConfig = {
  ...SQUAT_DETECTION_CONFIG,
  exerciseType: 'squat',
  displayName: 'Squat',
  version: '1.0.0',
  description: 'Standard squat pose detection with hysteresis for UI stability',
  analysis: SQUAT_ANALYSIS_CONFIG,
} as const;

/**
 * Test-specific configuration constants
 *
 * These derived values are commonly used in test utilities and can be
 * imported directly to avoid magic numbers in test code.
 */
export const SQUAT_TEST_CONSTANTS = {
  /** Detection threshold values for boundary testing */
  DETECTION: {
    /** Upper threshold value for boundary testing */
    UPPER_THRESHOLD: SQUAT_DETECTION_CONFIG.upperThreshold,
    /** Lower threshold value for boundary testing */
    LOWER_THRESHOLD: SQUAT_DETECTION_CONFIG.lowerThreshold,
    /** Exit debounce time for timing-based tests */
    EXIT_DEBOUNCE_MS: SQUAT_DETECTION_CONFIG.exitDebounceTime,
    /** Enter debounce time for timing-based tests */
    ENTER_DEBOUNCE_MS: SQUAT_DETECTION_CONFIG.enterDebounceTime,
  },

  /** Analysis threshold values for testing squat-specific logic */
  ANALYSIS: {
    /** MediaPipe confidence thresholds */
    MEDIAPIPE_CONFIDENCE: SQUAT_ANALYSIS_CONFIG.mediaPipe.minPoseDetectionConfidence,
    /** Minimum landmark visibility */
    MIN_VISIBILITY: SQUAT_ANALYSIS_CONFIG.visibility.minLandmarkVisibility,
    /** Depth achievement threshold */
    DEPTH_THRESHOLD: SQUAT_ANALYSIS_CONFIG.depth.depthThreshold,
    /** Maximum valid knee angle */
    MAX_KNEE_ANGLE: SQUAT_ANALYSIS_CONFIG.validation.maxValidKneeAngle,
    /** Rep counting phase thresholds */
    REP_PHASES: {
      START: SQUAT_ANALYSIS_CONFIG.depth.startRepThreshold,
      BOTTOM: SQUAT_ANALYSIS_CONFIG.depth.bottomPhaseThreshold,
      ASCENDING: SQUAT_ANALYSIS_CONFIG.depth.ascendingThreshold,
      COMPLETE: SQUAT_ANALYSIS_CONFIG.depth.completeRepThreshold,
    },
  },

  /**
   * Critical boundary values for threshold testing
   * These values are strategically chosen to test edge cases around
   * the configured thresholds.
   */
  BOUNDARY_VALUES: {
    /** Values around the lower threshold (0.5) */
    LOWER_BOUNDARY: [0.48, 0.49, 0.5, 0.51, 0.52] as const,

    /** Values around the upper threshold (0.7) */
    UPPER_BOUNDARY: [0.68, 0.69, 0.7, 0.71, 0.72] as const,

    /** Combined boundary sequence for comprehensive testing */
    FULL_SEQUENCE: [
      0.48,
      0.49,
      0.5,
      0.51,
      0.52, // Lower threshold region
      0.49,
      0.5,
      0.51,
      0.5,
      0.49, // Lower threshold oscillation
      0.68,
      0.69,
      0.7,
      0.71,
      0.72, // Upper threshold region
      0.69,
      0.7,
      0.71,
      0.7,
      0.69, // Upper threshold oscillation
    ] as const,
  },
} as const;
