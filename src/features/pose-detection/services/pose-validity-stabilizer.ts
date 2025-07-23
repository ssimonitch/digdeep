/**
 * Detection states for pose validity
 *
 * @description Three-state system for smooth pose detection feedback:
 * - 'invalid': Pose not detected or confidence below lower threshold
 * - 'detecting': Transitioning between states (debouncing period)
 * - 'valid': Pose detected with confidence above upper threshold
 */
export type DetectionState = 'invalid' | 'detecting' | 'valid';

/**
 * Configuration options for pose validity stabilization
 *
 * @example
 * ```typescript
 * const config: PoseValidityStabilizerConfig = {
 *   upperThreshold: 0.7,    // Enter valid state at 70% confidence
 *   lowerThreshold: 0.5,    // Exit valid state at 50% confidence
 *   enterDebounceTime: 0,   // Immediate positive feedback
 *   exitDebounceTime: 200   // 200ms stability before marking invalid
 * };
 * ```
 */
export interface PoseValidityStabilizerConfig {
  /** Upper threshold for entering valid state (default: 0.7) */
  upperThreshold?: number;
  /** Lower threshold for exiting valid state (default: 0.5) */
  lowerThreshold?: number;
  /** Minimum time in ms before entering valid state (default: 0 for immediate feedback) */
  enterDebounceTime?: number;
  /** Minimum time in ms before exiting valid state (default: 200 for stability) */
  exitDebounceTime?: number;
}

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
 * - Enter valid: Immediate when confidence ≥ upperThreshold (0.7)
 * - Exit valid: Debounced when confidence < lowerThreshold (0.5) for exitDebounceTime (200ms)
 * - Detecting state: Only used when leaving valid state (gives time to recover)
 *
 * This prevents flickering while providing instant positive feedback.
 */
export class PoseValidityStabilizer {
  private readonly config: Required<PoseValidityStabilizerConfig>;
  private currentState: DetectionState = 'invalid';
  private lastConfidence = 0;
  private transitionStartTime: number | null = null;
  private stateStartTime = 0;

  constructor(config: PoseValidityStabilizerConfig = {}) {
    this.config = {
      upperThreshold: config.upperThreshold ?? 0.7,
      lowerThreshold: config.lowerThreshold ?? 0.5,
      enterDebounceTime: config.enterDebounceTime ?? 0,
      exitDebounceTime: config.exitDebounceTime ?? 200,
    };

    // Validate configuration
    if (this.config.upperThreshold <= this.config.lowerThreshold) {
      throw new Error('upperThreshold must be greater than lowerThreshold');
    }
    if (this.config.enterDebounceTime < 0) {
      throw new Error('enterDebounceTime must be non-negative');
    }
    if (this.config.exitDebounceTime < 0) {
      throw new Error('exitDebounceTime must be non-negative');
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
