/**
 * Base validation utilities for exercise configuration
 *
 * Provides type guards and validation functions for generic exercise
 * configuration interfaces.
 */

import type { ConfigValidationResult, ExerciseDetectionConfig } from './types';

/**
 * Type guard to check if an object is a valid ExerciseDetectionConfig
 */
export function isExerciseDetectionConfig(obj: unknown): obj is ExerciseDetectionConfig {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const config = obj as Record<string, unknown>;

  return (
    typeof config.upperThreshold === 'number' &&
    typeof config.lowerThreshold === 'number' &&
    typeof config.enterDebounceTime === 'number' &&
    typeof config.exitDebounceTime === 'number'
  );
}

/**
 * Validates an exercise detection configuration
 */
export function validateExerciseDetectionConfig(config: ExerciseDetectionConfig): ConfigValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate threshold ranges
  if (config.upperThreshold < 0 || config.upperThreshold > 1) {
    errors.push('upperThreshold must be between 0 and 1');
  }

  if (config.lowerThreshold < 0 || config.lowerThreshold > 1) {
    errors.push('lowerThreshold must be between 0 and 1');
  }

  // Validate threshold relationship
  if (config.upperThreshold <= config.lowerThreshold) {
    errors.push('upperThreshold must be greater than lowerThreshold');
  }

  // Validate timing parameters
  if (config.enterDebounceTime < 0) {
    errors.push('enterDebounceTime must be non-negative');
  }

  if (config.exitDebounceTime < 0) {
    errors.push('exitDebounceTime must be non-negative');
  }

  // Add warnings for potentially problematic configurations
  if (config.upperThreshold - config.lowerThreshold < 0.1) {
    warnings.push('Small threshold gap may cause rapid state transitions');
  }

  if (config.exitDebounceTime > 1000) {
    warnings.push('Long exit debounce time may feel unresponsive to users');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
