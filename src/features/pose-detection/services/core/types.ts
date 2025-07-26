/**
 * Shared types for pose detection services
 * These types are used by both internal services and external consumers
 */

/**
 * Detection states for pose validity
 *
 * @description Three-state system for smooth pose detection feedback:
 * - 'invalid': Pose not detected or confidence below lower threshold
 * - 'detecting': Transitioning between states (debouncing period)
 * - 'valid': Pose detected with confidence above upper threshold
 */
export type DetectionState = 'invalid' | 'detecting' | 'valid';
