/**
 * Base exercise configuration module
 *
 * Exports generic types and utilities that are shared across all exercises.
 */

// Types
export type { ConfigValidationResult, ExerciseConfig, ExerciseDetectionConfig } from './types';

// Validation utilities
export { isExerciseDetectionConfig, validateExerciseDetectionConfig } from './validation';
