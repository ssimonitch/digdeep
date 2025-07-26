/**
 * Generic hysteresis stabilizer for preventing rapid state transitions
 *
 * Provides a reusable implementation of hysteresis-based stabilization with:
 * - Dual thresholds (upper/lower) for state transitions
 * - Asymmetric transitions (immediate positive, debounced negative)
 * - Time-based debouncing for exit transitions
 * - Support for both simple values and complex state objects
 */

/**
 * Configuration for hysteresis behavior
 */
export interface HysteresisConfig {
  /** Upper threshold to enter "on" state */
  upperThreshold: number;
  /** Lower threshold to exit "on" state */
  lowerThreshold: number;
  /** Time to wait before completing exit transition (ms) */
  exitDebounceTime: number;
  /** Optional time to wait before entering "on" state (ms) */
  enterDebounceTime?: number;
}

/**
 * Internal state for tracking transitions
 */
interface TransitionState {
  /** Whether currently in "on" state */
  isOn: boolean;
  /** Timestamp when transition started */
  transitionStartTime: number | null;
  /** Last update timestamp */
  lastUpdateTime: number;
}

/**
 * Result of a stabilization update
 */
export interface StabilizationResult<T> {
  /** Original input value */
  input: T;
  /** Stabilized output value */
  output: T;
  /** Whether in "on" state */
  isOn: boolean;
  /** Whether currently transitioning */
  isTransitioning: boolean;
  /** Current confidence/metric value */
  confidence: number;
}

/**
 * Strategy for extracting confidence values and managing state
 */
export interface StabilizationStrategy<T> {
  /** Extract confidence value (0-1) from input */
  getConfidence(input: T): number;
  /** Create output value based on current state and input */
  createOutput(input: T, state: TransitionState, isTransitioning: boolean): T;
  /** Optional: Get initial state value */
  getInitialValue?(): T;
}

/**
 * Generic hysteresis stabilizer
 *
 * @template T Type of value being stabilized
 */
export class HysteresisStabilizer<T> {
  private readonly config: Required<HysteresisConfig>;
  private readonly strategy: StabilizationStrategy<T>;
  private state: TransitionState;
  private lastOutput: T | undefined;

  constructor(config: HysteresisConfig, strategy: StabilizationStrategy<T>) {
    // Validate configuration
    if (config.upperThreshold <= config.lowerThreshold) {
      throw new Error('Upper threshold must be greater than lower threshold');
    }
    if (config.lowerThreshold < 0 || config.upperThreshold > 1) {
      throw new Error('Thresholds must be between 0 and 1');
    }
    if (config.exitDebounceTime < 0) {
      throw new Error('Exit debounce time must be non-negative');
    }

    this.config = {
      upperThreshold: config.upperThreshold,
      lowerThreshold: config.lowerThreshold,
      exitDebounceTime: config.exitDebounceTime,
      enterDebounceTime: config.enterDebounceTime ?? 0,
    };

    this.strategy = strategy;
    this.state = {
      isOn: false,
      transitionStartTime: null,
      lastUpdateTime: 0,
    };

    // Initialize last output if strategy provides initial value
    if (strategy.getInitialValue) {
      this.lastOutput = strategy.getInitialValue();
    }
  }

  /**
   * Update the stabilizer with new input
   *
   * @param input New input value
   * @param timestamp Current timestamp in milliseconds
   * @returns Stabilized result
   */
  update(input: T, timestamp: number): StabilizationResult<T> {
    // Handle backwards time
    if (this.state.transitionStartTime !== null && timestamp < this.state.transitionStartTime) {
      return this.createResult(input, false);
    }

    this.state.lastUpdateTime = timestamp;
    const confidence = this.strategy.getConfidence(input);

    // Determine desired state based on hysteresis
    const desiredOn = this.state.isOn
      ? confidence >= this.config.lowerThreshold // When on, stay on until below lower
      : confidence >= this.config.upperThreshold; // When off, need upper to turn on

    // Handle state transitions
    if (desiredOn === this.state.isOn) {
      // No change needed, clear any pending transition
      this.state.transitionStartTime = null;
      this.lastOutput = this.strategy.createOutput(input, this.state, false);

      return this.createResult(input, false);
    }

    // Handle transitions
    if (desiredOn && !this.state.isOn) {
      // Entering "on" state
      if (this.config.enterDebounceTime > 0) {
        // Use enter debouncing
        if (this.state.transitionStartTime === null) {
          this.state.transitionStartTime = timestamp;
          return this.createResult(input, true);
        }

        const timeInTransition = timestamp - this.state.transitionStartTime;
        if (timeInTransition >= this.config.enterDebounceTime) {
          this.completeTransition(true, timestamp);
          this.lastOutput = this.strategy.createOutput(input, this.state, false);
          return this.createResult(input, false);
        }

        return this.createResult(input, true);
      } else {
        // Immediate transition
        this.completeTransition(true, timestamp);
        this.lastOutput = this.strategy.createOutput(input, this.state, false);
        return this.createResult(input, false);
      }
    } else if (!desiredOn && this.state.isOn) {
      // Exiting "on" state - always use debouncing
      if (this.state.transitionStartTime === null) {
        this.state.transitionStartTime = timestamp;
        return this.createResult(input, true);
      }

      const timeInTransition = timestamp - this.state.transitionStartTime;
      if (timeInTransition >= this.config.exitDebounceTime) {
        this.completeTransition(false, timestamp);
        this.lastOutput = this.strategy.createOutput(input, this.state, false);
        return this.createResult(input, false);
      }

      return this.createResult(input, true);
    }

    // Should not reach here
    return this.createResult(input, false);
  }

  /**
   * Reset the stabilizer to initial state
   */
  reset(): void {
    this.state = {
      isOn: false,
      transitionStartTime: null,
      lastUpdateTime: 0,
    };

    if (this.strategy.getInitialValue) {
      this.lastOutput = this.strategy.getInitialValue();
    } else {
      this.lastOutput = undefined;
    }
  }

  /**
   * Get current state (for testing/debugging)
   */
  getState(): TransitionState {
    return { ...this.state };
  }

  /**
   * Complete a state transition
   */
  private completeTransition(isOn: boolean, timestamp: number): void {
    this.state.isOn = isOn;
    this.state.transitionStartTime = null;
    this.state.lastUpdateTime = timestamp;
  }

  /**
   * Create a stabilization result
   */
  private createResult(input: T, isTransitioning: boolean): StabilizationResult<T> {
    const output =
      isTransitioning && this.lastOutput !== undefined
        ? this.lastOutput
        : this.strategy.createOutput(input, this.state, isTransitioning);

    return {
      input,
      output,
      isOn: this.state.isOn,
      isTransitioning,
      confidence: this.strategy.getConfidence(input),
    };
  }
}
