/**
 * Squat exercise configuration module
 *
 * Exports all squat-specific types, configurations, and utilities.
 */

// Types
export type { SquatAnalysisConfig, SquatExerciseConfig } from './types';

// Configuration constants
export { SQUAT_ANALYSIS_CONFIG, SQUAT_DETECTION_CONFIG, SQUAT_EXERCISE_CONFIG, SQUAT_TEST_CONSTANTS } from './config';

// Validation utilities
export { validateSquatAnalysisConfig } from './validation';
