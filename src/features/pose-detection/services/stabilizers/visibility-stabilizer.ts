/**
 * Visibility stabilizer for landmark groups
 *
 * Prevents rapid toggling of visibility values using hysteresis and debouncing.
 * Each landmark group (hips, knees, ankles, shoulders) has independent stabilization.
 */

import type { StabilizationStrategy } from './hysteresis-stabilizer';
import { HysteresisStabilizer } from './hysteresis-stabilizer';

export interface VisibilityThresholds {
  /** Upper threshold to enter visible state (default: 0.7) */
  upperThreshold: number;
  /** Lower threshold to exit visible state (default: 0.5) */
  lowerThreshold: number;
  /** Time to wait before transitioning to not visible (ms, default: 200) */
  exitDebounceTime: number;
}

export interface StabilizedVisibility {
  /** Raw visibility value (0-1) */
  rawValue: number;
  /** Stabilized visibility value (0-1) */
  stabilizedValue: number;
  /** Whether the landmark group is considered visible */
  isVisible: boolean;
  /** Whether currently in transition */
  isTransitioning: boolean;
}

export interface LandmarkGroupVisibility {
  hips: StabilizedVisibility;
  knees: StabilizedVisibility;
  ankles: StabilizedVisibility;
  shoulders: StabilizedVisibility;
}

/**
 * Input type for visibility stabilization
 */
interface VisibilityInput {
  value: number;
}

/**
 * Strategy for visibility value stabilization
 */
class VisibilityStrategy implements StabilizationStrategy<VisibilityInput> {
  getConfidence(input: VisibilityInput): number {
    return input.value;
  }

  createOutput(input: VisibilityInput): VisibilityInput {
    return input;
  }

  getInitialValue(): VisibilityInput {
    return { value: 0 };
  }
}

/**
 * Stabilizes visibility values for landmark groups to prevent UI flickering.
 *
 * Uses hysteresis and asymmetric debouncing:
 * - Enter visible: Immediate when rawValue >= upperThreshold
 * - Exit visible: Debounced when rawValue < lowerThreshold for exitDebounceTime
 * - Maintains last stable value during transitions
 */
export class VisibilityStabilizer {
  private readonly stabilizers: Map<keyof LandmarkGroupVisibility, HysteresisStabilizer<VisibilityInput>>;

  constructor(thresholds: Partial<VisibilityThresholds> = {}) {
    const config = {
      upperThreshold: thresholds.upperThreshold ?? 0.7,
      lowerThreshold: thresholds.lowerThreshold ?? 0.5,
      exitDebounceTime: thresholds.exitDebounceTime ?? 200,
      enterDebounceTime: 0, // Immediate positive feedback
    };

    // Initialize a stabilizer for each landmark group
    this.stabilizers = new Map();
    const groups: (keyof LandmarkGroupVisibility)[] = ['hips', 'knees', 'ankles', 'shoulders'];
    const strategy = new VisibilityStrategy();

    for (const group of groups) {
      this.stabilizers.set(group, new HysteresisStabilizer<VisibilityInput>(config, strategy));
    }
  }

  /**
   * Update visibility values and return stabilized results
   *
   * @param rawVisibility Raw visibility values from pose detection
   * @param timestamp Current timestamp in milliseconds
   * @returns Stabilized visibility values with transition states
   */
  update(rawVisibility: Record<keyof LandmarkGroupVisibility, number>, timestamp: number): LandmarkGroupVisibility {
    const result: Partial<LandmarkGroupVisibility> = {};

    for (const [group, rawValue] of Object.entries(rawVisibility) as [keyof LandmarkGroupVisibility, number][]) {
      const stabilizer = this.stabilizers.get(group)!;
      const stabilizationResult = stabilizer.update({ value: rawValue }, timestamp);

      // Convert to our expected output format
      result[group] = {
        rawValue,
        stabilizedValue: stabilizationResult.output.value,
        isVisible: stabilizationResult.isOn,
        isTransitioning: stabilizationResult.isTransitioning,
      };
    }

    return result as LandmarkGroupVisibility;
  }

  /**
   * Reset all group states to initial values
   */
  reset(): void {
    for (const stabilizer of this.stabilizers.values()) {
      stabilizer.reset();
    }
  }

  /**
   * Get current state for a specific group (for debugging/testing)
   */
  getGroupState(group: keyof LandmarkGroupVisibility): { isVisible: boolean } | undefined {
    const stabilizer = this.stabilizers.get(group);
    if (!stabilizer) return undefined;

    const state = stabilizer.getState();
    return {
      isVisible: state.isOn,
    };
  }
}
