/**
 * Base exercise detection configuration types
 *
 * This module provides the core configuration interfaces for exercise detection
 * systems, ensuring consistency across pose detection and UI analysis domains.
 *
 * Following domain-driven design principles, this shared kernel prevents
 * duplication of critical threshold values while maintaining type safety.
 */

/**
 * Configuration for pose validity detection and stabilization
 *
 * Defines the thresholds and timing parameters used for determining
 * when a pose transitions between invalid, detecting, and valid states.
 *
 * @example
 * ```typescript
 * const config: ExerciseDetectionConfig = {
 *   upperThreshold: 0.7,    // Enter valid state at 70% confidence
 *   lowerThreshold: 0.5,    // Exit valid state at 50% confidence
 *   enterDebounceTime: 0,   // Immediate positive feedback
 *   exitDebounceTime: 200   // 200ms stability before marking invalid
 * };
 * ```
 */
export interface ExerciseDetectionConfig {
  /** Upper threshold for entering valid state (0-1) */
  upperThreshold: number;

  /** Lower threshold for exiting valid state (0-1) */
  lowerThreshold: number;

  /** Minimum time in ms before entering valid state (default: 0 for immediate feedback) */
  enterDebounceTime: number;

  /** Minimum time in ms before exiting valid state (default: 200 for stability) */
  exitDebounceTime: number;
}

/**
 * Exercise-specific configuration with metadata
 *
 * Extends the base detection config with exercise-specific information
 * for future multi-exercise support (deadlift, bench press, etc.)
 */
export interface ExerciseConfig extends ExerciseDetectionConfig {
  /** Exercise identifier */
  exerciseType: 'squat' | 'deadlift' | 'bench-press';

  /** Human-readable exercise name */
  displayName: string;

  /** Configuration version for migration compatibility */
  version: string;

  /** Optional description of the configuration's purpose */
  description?: string;
}

/**
 * Validation result for exercise configuration
 */
export interface ConfigValidationResult {
  /** Whether the configuration is valid */
  isValid: boolean;

  /** Array of validation error messages */
  errors: string[];

  /** Array of warning messages (non-blocking) */
  warnings: string[];
}
