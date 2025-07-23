/**
 * Shared exercise configuration module
 *
 * This module provides centralized configuration for exercise detection
 * across the DigDeep application. It follows domain-driven design principles
 * by creating a shared kernel for critical exercise parameters.
 *
 * This prevents duplication of threshold values between business logic
 * and test utilities while maintaining type safety and consistency.
 */

/**
 * Default exercise configuration for the application
 *
 * Currently defaults to squat configuration, but can be extended
 * for multi-exercise support in the future.
 */
export { SQUAT_DETECTION_CONFIG as DEFAULT_EXERCISE_CONFIG } from './squat';

// Export the structured modules for explicit imports
export * as base from './base';
export * as squat from './squat';
