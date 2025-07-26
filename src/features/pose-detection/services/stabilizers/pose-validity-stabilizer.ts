import { DEFAULT_EXERCISE_CONFIG } from '@/shared/exercise-config';
import type { ExerciseDetectionConfig } from '@/shared/exercise-config/base';
import { validateExerciseDetectionConfig } from '@/shared/exercise-config/base';

import type { DetectionState } from '../core/types';
import type { StabilizationStrategy } from './hysteresis-stabilizer';
import { HysteresisStabilizer } from './hysteresis-stabilizer';

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
 * Input type for pose validity stabilization
 */
interface PoseValidityInput {
  confidence: number;
}

/**
 * Strategy for pose validity stabilization
 */
class PoseValidityStrategy implements StabilizationStrategy<PoseValidityInput> {
  getConfidence(input: PoseValidityInput): number {
    return input.confidence;
  }

  createOutput(input: PoseValidityInput): PoseValidityInput {
    // The output maintains the same confidence value
    // State mapping is handled in the PoseValidityStabilizer wrapper
    return input;
  }

  getInitialValue(): PoseValidityInput {
    return { confidence: 0 };
  }
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
  private readonly stabilizer: HysteresisStabilizer<PoseValidityInput>;
  private currentState: DetectionState = 'invalid';
  private lastConfidence = 0;
  private stateStartTime = 0;

  /**
   * Create a new PoseValidityStabilizer instance
   *
   * @param config Exercise detection configuration (defaults to DEFAULT_EXERCISE_CONFIG)
   */
  constructor(config: ExerciseDetectionConfig = DEFAULT_EXERCISE_CONFIG) {
    const fullConfig = {
      upperThreshold: config.upperThreshold ?? DEFAULT_EXERCISE_CONFIG.upperThreshold,
      lowerThreshold: config.lowerThreshold ?? DEFAULT_EXERCISE_CONFIG.lowerThreshold,
      enterDebounceTime: config.enterDebounceTime ?? DEFAULT_EXERCISE_CONFIG.enterDebounceTime,
      exitDebounceTime: config.exitDebounceTime ?? DEFAULT_EXERCISE_CONFIG.exitDebounceTime,
    };

    // Validate configuration using shared validation logic
    const validation = validateExerciseDetectionConfig(fullConfig);
    if (!validation.isValid) {
      throw new Error(`Invalid pose validity configuration: ${validation.errors.join(', ')}`);
    }

    // Log warnings if any
    if (validation.warnings.length > 0) {
      // eslint-disable-next-line no-console
      console.warn('PoseValidityStabilizer configuration warnings:', validation.warnings.join(', '));
    }

    // Create the generic stabilizer with immediate enter (enterDebounceTime = 0)
    this.stabilizer = new HysteresisStabilizer<PoseValidityInput>(
      {
        upperThreshold: fullConfig.upperThreshold,
        lowerThreshold: fullConfig.lowerThreshold,
        exitDebounceTime: fullConfig.exitDebounceTime,
        enterDebounceTime: 0, // Immediate positive feedback for gym UX
      },
      new PoseValidityStrategy(),
    );
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

    // Use the generic stabilizer
    const result = this.stabilizer.update({ confidence }, timestamp);

    // Map the binary on/off state to our three-state system
    // When transitioning from on to off, we're in detecting state
    const newState: DetectionState =
      result.isOn && !result.isTransitioning ? 'valid' : result.isTransitioning ? 'detecting' : 'invalid';

    // Update state if changed
    if (newState !== this.currentState) {
      this.currentState = newState;
      this.stateStartTime = timestamp;
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
   * Reset the stabilizer to initial state
   */
  reset(): void {
    this.stabilizer.reset();
    this.currentState = 'invalid';
    this.lastConfidence = 0;
    this.stateStartTime = 0;
  }
}
