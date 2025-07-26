import { describe, expect, it } from 'vitest';

import type { StabilizationStrategy } from '../stabilizers/hysteresis-stabilizer';
import { HysteresisStabilizer } from '../stabilizers/hysteresis-stabilizer';

// Simple number stabilization for testing
interface NumberInput {
  value: number;
}

class NumberStrategy implements StabilizationStrategy<NumberInput> {
  getConfidence(input: NumberInput): number {
    return input.value;
  }

  createOutput(input: NumberInput): NumberInput {
    return input;
  }

  getInitialValue(): NumberInput {
    return { value: 0 };
  }
}

describe('HysteresisStabilizer', () => {
  it('should validate configuration', () => {
    const strategy = new NumberStrategy();

    // Upper threshold must be greater than lower
    expect(() => {
      new HysteresisStabilizer({ upperThreshold: 0.5, lowerThreshold: 0.5, exitDebounceTime: 100 }, strategy);
    }).toThrow('Upper threshold must be greater than lower threshold');

    // Thresholds must be between 0 and 1
    expect(() => {
      new HysteresisStabilizer({ upperThreshold: 1.5, lowerThreshold: 0.5, exitDebounceTime: 100 }, strategy);
    }).toThrow('Thresholds must be between 0 and 1');

    expect(() => {
      new HysteresisStabilizer({ upperThreshold: 0.7, lowerThreshold: -0.5, exitDebounceTime: 100 }, strategy);
    }).toThrow('Thresholds must be between 0 and 1');
  });

  it('should implement hysteresis correctly', () => {
    const strategy = new NumberStrategy();
    const stabilizer = new HysteresisStabilizer(
      {
        upperThreshold: 0.7,
        lowerThreshold: 0.5,
        exitDebounceTime: 200,
      },
      strategy,
    );

    // Start off
    let result = stabilizer.update({ value: 0.3 }, 1000);
    expect(result.isOn).toBe(false);
    expect(result.isTransitioning).toBe(false);

    // Value between thresholds - should stay off
    result = stabilizer.update({ value: 0.6 }, 2000);
    expect(result.isOn).toBe(false);

    // Value above upper threshold - turn on immediately
    result = stabilizer.update({ value: 0.8 }, 3000);
    expect(result.isOn).toBe(true);
    expect(result.isTransitioning).toBe(false);

    // Value between thresholds - should stay on (hysteresis)
    result = stabilizer.update({ value: 0.6 }, 4000);
    expect(result.isOn).toBe(true);

    // Value below lower threshold - start transition
    result = stabilizer.update({ value: 0.4 }, 5000);
    expect(result.isOn).toBe(true);
    expect(result.isTransitioning).toBe(true);

    // Complete transition after debounce time
    result = stabilizer.update({ value: 0.4 }, 5200);
    expect(result.isOn).toBe(false);
    expect(result.isTransitioning).toBe(false);
  });

  it('should handle enter debouncing when configured', () => {
    const strategy = new NumberStrategy();
    const stabilizer = new HysteresisStabilizer(
      {
        upperThreshold: 0.7,
        lowerThreshold: 0.5,
        exitDebounceTime: 200,
        enterDebounceTime: 100,
      },
      strategy,
    );

    // Start off
    let result = stabilizer.update({ value: 0.3 }, 1000);
    expect(result.isOn).toBe(false);

    // Value above upper threshold - start enter transition
    result = stabilizer.update({ value: 0.8 }, 2000);
    expect(result.isOn).toBe(false);
    expect(result.isTransitioning).toBe(true);

    // Still transitioning
    result = stabilizer.update({ value: 0.8 }, 2050);
    expect(result.isOn).toBe(false);
    expect(result.isTransitioning).toBe(true);

    // Complete transition after enter debounce time
    result = stabilizer.update({ value: 0.8 }, 2100);
    expect(result.isOn).toBe(true);
    expect(result.isTransitioning).toBe(false);
  });

  it('should maintain last output during transitions', () => {
    const strategy = new NumberStrategy();
    const stabilizer = new HysteresisStabilizer(
      {
        upperThreshold: 0.7,
        lowerThreshold: 0.5,
        exitDebounceTime: 200,
      },
      strategy,
    );

    // Get to on state
    stabilizer.update({ value: 0.8 }, 1000);
    const highResult = stabilizer.update({ value: 0.9 }, 2000);
    expect(highResult.output.value).toBe(0.9);

    // Start exit transition - should keep last output
    const transitionResult = stabilizer.update({ value: 0.4 }, 3000);
    expect(transitionResult.isTransitioning).toBe(true);
    expect(transitionResult.output.value).toBe(0.9); // Maintains last stable value
  });

  it('should handle recovery during exit transition', () => {
    const strategy = new NumberStrategy();
    const stabilizer = new HysteresisStabilizer(
      {
        upperThreshold: 0.7,
        lowerThreshold: 0.5,
        exitDebounceTime: 200,
      },
      strategy,
    );

    // Get to on state
    stabilizer.update({ value: 0.8 }, 1000);

    // Start exit transition
    let result = stabilizer.update({ value: 0.4 }, 2000);
    expect(result.isTransitioning).toBe(true);

    // Recover before debounce completes
    result = stabilizer.update({ value: 0.8 }, 2100);
    expect(result.isOn).toBe(true);
    expect(result.isTransitioning).toBe(false);
  });

  it('should reset to initial state', () => {
    const strategy = new NumberStrategy();
    const stabilizer = new HysteresisStabilizer(
      {
        upperThreshold: 0.7,
        lowerThreshold: 0.5,
        exitDebounceTime: 200,
      },
      strategy,
    );

    // Get to on state
    stabilizer.update({ value: 0.8 }, 1000);
    expect(stabilizer.getState().isOn).toBe(true);

    // Reset
    stabilizer.reset();
    expect(stabilizer.getState().isOn).toBe(false);

    // Should need upper threshold again to turn on
    let result = stabilizer.update({ value: 0.6 }, 2000);
    expect(result.isOn).toBe(false);

    result = stabilizer.update({ value: 0.8 }, 3000);
    expect(result.isOn).toBe(true);
  });
});
