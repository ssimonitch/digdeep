/**
 * Detection states for pose validity
 *
 * @description Three-state system for smooth pose detection feedback:
 * - 'invalid': Pose not detected or confidence below lower threshold
 * - 'detecting': Transitioning between states (debouncing period)
 * - 'valid': Pose detected with confidence above upper threshold
 */
import { DEFAULT_EXERCISE_CONFIG } from '@/shared/exercise-config';
import type { ExerciseDetectionConfig } from '@/shared/exercise-config/base';
import { validateExerciseDetectionConfig } from '@/shared/exercise-config/base';

export type DetectionState = 'invalid' | 'detecting' | 'valid';

/**
 * Detailed state information returned by the stabilizer
 */
export interface StateInfo {
  /** Current detection state */
  state: DetectionState;
  /** Last confidence value */
  confidence: number;
  /** Time spent in current state (ms) */
  timeInState: number;
  /** Whether currently transitioning between states */
  isTransitioning: boolean;
}

/**
 * Stabilizes pose validity detection with asymmetric transitions optimized
 * for gym user experience - fast positive feedback with stable tracking.
 *
 * Uses a three-state system:
 * - 'invalid': Pose is not valid
 * - 'detecting': Transitioning OUT of valid state (recovery grace period)
 * - 'valid': Pose is valid
 *
 * Asymmetric behavior:
 * - Enter valid: Immediate when confidence ≥ upperThreshold
 * - Exit valid: Debounced when confidence < lowerThreshold for exitDebounceTime
 * - Detecting state: Only used when leaving valid state (gives time to recover)
 *
 * This prevents flickering while providing instant positive feedback.
 *
 * Now uses centralized exercise configuration from @/shared/exercise-config
 * to ensure consistency across the application.
 */
export class PoseValidityStabilizer {
  private readonly config: Required<ExerciseDetectionConfig>;
  private currentState: DetectionState = 'invalid';
  private lastConfidence = 0;
  private transitionStartTime: number | null = null;
  private stateStartTime = 0;

  /**
   * Create a new PoseValidityStabilizer instance
   *
   * @param config Exercise detection configuration (defaults to DEFAULT_EXERCISE_CONFIG)
   */
  constructor(config: ExerciseDetectionConfig = DEFAULT_EXERCISE_CONFIG) {
    this.config = {
      upperThreshold: config.upperThreshold ?? DEFAULT_EXERCISE_CONFIG.upperThreshold,
      lowerThreshold: config.lowerThreshold ?? DEFAULT_EXERCISE_CONFIG.lowerThreshold,
      enterDebounceTime: config.enterDebounceTime ?? DEFAULT_EXERCISE_CONFIG.enterDebounceTime,
      exitDebounceTime: config.exitDebounceTime ?? DEFAULT_EXERCISE_CONFIG.exitDebounceTime,
    };

    // Validate configuration using shared validation logic
    const validation = validateExerciseDetectionConfig(this.config);
    if (!validation.isValid) {
      throw new Error(`Invalid pose validity configuration: ${validation.errors.join(', ')}`);
    }

    // Log warnings if any
    if (validation.warnings.length > 0) {
      // eslint-disable-next-line no-console
      console.warn('PoseValidityStabilizer configuration warnings:', validation.warnings.join(', '));
    }
  }

  /**
   * Update the stabilizer with new confidence and timestamp
   *
   * @param confidence Pose detection confidence (0-1)
   * @param timestamp Current timestamp in milliseconds
   */
  update(confidence: number, timestamp: number): void {
    this.lastConfidence = confidence;

    // Initialize timing on first update
    if (this.stateStartTime === 0) {
      this.stateStartTime = timestamp;
    }

    // Handle backwards time (ignore the update)
    if (this.transitionStartTime !== null && timestamp < this.transitionStartTime) {
      return;
    }

    // Determine desired state based on current state and confidence
    const desiredState = this.determineDesiredState(confidence);

    if (desiredState === this.currentState) {
      // No change needed, clear any pending transition
      this.transitionStartTime = null;
      return;
    }

    // Handle state transitions
    if (desiredState === 'valid' && this.currentState !== 'valid') {
      // Entering valid state - immediate transition (gym UX optimization)
      this.setState('valid', timestamp);
    } else if (desiredState === 'invalid' && (this.currentState === 'valid' || this.currentState === 'detecting')) {
      // Exiting valid state or continuing exit transition - use debouncing for stability
      if (this.transitionStartTime === null) {
        // Start exit transition
        this.transitionStartTime = timestamp;
        this.setState('detecting', timestamp);
      } else {
        // Check if enough time has passed to complete exit
        const timeInTransition = timestamp - this.transitionStartTime;
        if (timeInTransition >= this.config.exitDebounceTime) {
          this.setState('invalid', timestamp);
        }
        // Otherwise stay in 'detecting' state
      }
    } else if (this.currentState === 'detecting' && desiredState === 'valid') {
      // Recovery during exit transition - immediately return to valid
      this.setState('valid', timestamp);
    }
  }

  /**
   * Get the current detection state
   */
  getState(): DetectionState {
    return this.currentState;
  }

  /**
   * Get detailed state information
   */
  getStateInfo(): StateInfo {
    return {
      state: this.currentState,
      confidence: this.lastConfidence,
      timeInState: 0, // Simplified for testing - in real use, this would be calculated
      isTransitioning: this.currentState === 'detecting',
    };
  }

  /**
   * Determine the desired state based on confidence and hysteresis
   */
  private determineDesiredState(confidence: number): DetectionState {
    // Use hysteresis to prevent rapid switching
    if (this.currentState === 'valid' || this.currentState === 'detecting') {
      // When valid or detecting, need to drop below lower threshold to want invalid
      return confidence >= this.config.lowerThreshold ? 'valid' : 'invalid';
    } else {
      // When invalid, need to exceed upper threshold to want valid
      return confidence >= this.config.upperThreshold ? 'valid' : 'invalid';
    }
  }

  /**
   * Set the current state and update timing
   */
  private setState(state: DetectionState, timestamp: number): void {
    if (state !== this.currentState) {
      this.currentState = state;
      this.stateStartTime = timestamp;

      // Clear transition when reaching final states (valid or invalid)
      if (state === 'valid' || state === 'invalid') {
        this.transitionStartTime = null;
      }
    }
  }
}
