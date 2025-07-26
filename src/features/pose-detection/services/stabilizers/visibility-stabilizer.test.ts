import { describe, expect, it } from 'vitest';

import { VisibilityStabilizer } from '../stabilizers/visibility-stabilizer';

describe('VisibilityStabilizer', () => {
  it('should initialize with all groups not visible', () => {
    const stabilizer = new VisibilityStabilizer();
    const result = stabilizer.update({ hips: 0, knees: 0, ankles: 0, shoulders: 0 }, Date.now());

    expect(result.hips.isVisible).toBe(false);
    expect(result.knees.isVisible).toBe(false);
    expect(result.ankles.isVisible).toBe(false);
    expect(result.shoulders.isVisible).toBe(false);
  });

  it('should immediately transition to visible when value exceeds upper threshold', () => {
    const stabilizer = new VisibilityStabilizer({ upperThreshold: 0.7 });
    const result = stabilizer.update({ hips: 0.8, knees: 0.75, ankles: 0.9, shoulders: 0.71 }, Date.now());

    expect(result.hips.isVisible).toBe(true);
    expect(result.knees.isVisible).toBe(true);
    expect(result.ankles.isVisible).toBe(true);
    expect(result.shoulders.isVisible).toBe(true);
    expect(result.hips.isTransitioning).toBe(false);
  });

  it('should use hysteresis - stay visible above lower threshold', () => {
    const stabilizer = new VisibilityStabilizer({
      upperThreshold: 0.7,
      lowerThreshold: 0.5,
    });

    // First make visible
    stabilizer.update({ hips: 0.8, knees: 0.8, ankles: 0.8, shoulders: 0.8 }, 1000);

    // Drop to value between thresholds
    const result = stabilizer.update({ hips: 0.6, knees: 0.6, ankles: 0.6, shoulders: 0.6 }, 2000);

    expect(result.hips.isVisible).toBe(true);
    expect(result.hips.stabilizedValue).toBe(0.6);
  });

  it('should debounce exit transitions', () => {
    const stabilizer = new VisibilityStabilizer({
      upperThreshold: 0.7,
      lowerThreshold: 0.5,
      exitDebounceTime: 200,
    });

    // First make visible
    stabilizer.update({ hips: 0.8, knees: 0.8, ankles: 0.8, shoulders: 0.8 }, 1000);

    // Drop below lower threshold
    const result1 = stabilizer.update({ hips: 0.4, knees: 0.4, ankles: 0.4, shoulders: 0.4 }, 2000);

    // Should still be visible but transitioning
    expect(result1.hips.isVisible).toBe(true);
    expect(result1.hips.isTransitioning).toBe(true);
    expect(result1.hips.stabilizedValue).toBe(0.8); // Keeps last stable value

    // After debounce time
    const result2 = stabilizer.update({ hips: 0.4, knees: 0.4, ankles: 0.4, shoulders: 0.4 }, 2201);

    // Should now be not visible
    expect(result2.hips.isVisible).toBe(false);
    expect(result2.hips.isTransitioning).toBe(false);
    expect(result2.hips.stabilizedValue).toBe(0.4);
  });

  it('should recover during exit transition', () => {
    const stabilizer = new VisibilityStabilizer({
      upperThreshold: 0.7,
      lowerThreshold: 0.5,
      exitDebounceTime: 200,
    });

    // First make visible
    stabilizer.update({ hips: 0.8, knees: 0.8, ankles: 0.8, shoulders: 0.8 }, 1000);

    // Start exit transition
    stabilizer.update({ hips: 0.4, knees: 0.4, ankles: 0.4, shoulders: 0.4 }, 2000);

    // Recover before debounce completes
    const result = stabilizer.update({ hips: 0.8, knees: 0.8, ankles: 0.8, shoulders: 0.8 }, 2100);

    // Should immediately return to visible
    expect(result.hips.isVisible).toBe(true);
    expect(result.hips.isTransitioning).toBe(false);
  });

  it('should handle independent group states', () => {
    const stabilizer = new VisibilityStabilizer({
      upperThreshold: 0.7,
      lowerThreshold: 0.5,
    });

    const result = stabilizer.update({ hips: 0.8, knees: 0.3, ankles: 0.9, shoulders: 0.1 }, 1000);

    expect(result.hips.isVisible).toBe(true);
    expect(result.knees.isVisible).toBe(false);
    expect(result.ankles.isVisible).toBe(true);
    expect(result.shoulders.isVisible).toBe(false);
  });

  it('should reset all states', () => {
    const stabilizer = new VisibilityStabilizer();

    // Make some groups visible
    stabilizer.update({ hips: 0.8, knees: 0.8, ankles: 0.8, shoulders: 0.8 }, 1000);

    // Reset
    stabilizer.reset();

    // All should be not visible
    const result = stabilizer.update({ hips: 0.6, knees: 0.6, ankles: 0.6, shoulders: 0.6 }, 2000);

    expect(result.hips.isVisible).toBe(false);
    expect(result.knees.isVisible).toBe(false);
    expect(result.ankles.isVisible).toBe(false);
    expect(result.shoulders.isVisible).toBe(false);
  });
});
