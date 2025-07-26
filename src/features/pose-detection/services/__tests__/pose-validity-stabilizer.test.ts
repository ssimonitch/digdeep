import { beforeEach, describe, expect, it } from 'vitest';

import { DEFAULT_EXERCISE_CONFIG } from '@/shared/exercise-config';

import { PoseValidityStabilizer } from '../stabilizers/pose-validity-stabilizer';

describe('PoseValidityStabilizer', () => {
  let stabilizer: PoseValidityStabilizer;

  beforeEach(() => {
    stabilizer = new PoseValidityStabilizer();
  });

  describe('Threshold Behavior', () => {
    it('should enter valid state immediately when confidence exceeds upper threshold', () => {
      // Start in invalid state
      expect(stabilizer.getState()).toBe('invalid');

      // Update with high confidence (above upper threshold) - should be immediate
      stabilizer.update(0.8, 100);

      expect(stabilizer.getState()).toBe('valid');
    });

    it('should exit valid state through detecting state when confidence drops below lower threshold', () => {
      // First, get to valid state immediately
      stabilizer.update(0.8, 100);
      expect(stabilizer.getState()).toBe('valid');

      // Update with confidence between thresholds (should stay valid)
      stabilizer.update(0.6, 200);
      expect(stabilizer.getState()).toBe('valid');

      // Update with confidence below lower threshold - should enter detecting state
      stabilizer.update(0.4, 300);
      expect(stabilizer.getState()).toBe('detecting');

      // After exitDebounceTime (200ms), should transition to invalid
      stabilizer.update(0.4, 500); // 200ms later
      expect(stabilizer.getState()).toBe('invalid');
    });

    it('should maintain current state when confidence is between thresholds (hysteresis)', () => {
      // Start invalid, confidence between thresholds
      stabilizer.update(0.6, 100);
      expect(stabilizer.getState()).toBe('invalid'); // Still invalid

      // Get to valid state immediately
      stabilizer.update(0.8, 200);
      expect(stabilizer.getState()).toBe('valid');

      // Back to between thresholds
      stabilizer.update(0.6, 300);
      expect(stabilizer.getState()).toBe('valid'); // Still valid due to hysteresis
    });
  });

  describe('Debouncing Behavior', () => {
    it('should provide immediate transition to valid state (no enter debouncing)', () => {
      // Start invalid
      expect(stabilizer.getState()).toBe('invalid');

      // High confidence - should immediately transition to valid (gym UX optimization)
      stabilizer.update(0.8, 100);
      expect(stabilizer.getState()).toBe('valid');
    });

    it('should handle rapid fluctuations with recovery during detecting state', () => {
      // Get to valid state immediately
      stabilizer.update(0.8, 100);
      expect(stabilizer.getState()).toBe('valid');

      // Drop below threshold - enter detecting state
      stabilizer.update(0.4, 200);
      expect(stabilizer.getState()).toBe('detecting');

      // Recover before exitDebounceTime - immediately return to valid
      stabilizer.update(0.8, 250);
      expect(stabilizer.getState()).toBe('valid');

      // Another drop
      stabilizer.update(0.4, 300);
      expect(stabilizer.getState()).toBe('detecting');

      // Quick recovery again
      stabilizer.update(0.8, 350);
      expect(stabilizer.getState()).toBe('valid'); // Immediate recovery
    });

    it('should handle exit transition timing correctly', () => {
      // Get to valid state immediately
      stabilizer.update(0.8, 100);
      expect(stabilizer.getState()).toBe('valid');

      // Start exit transition
      stabilizer.update(0.3, 200);
      expect(stabilizer.getState()).toBe('detecting');

      // Continue low confidence for less than exitDebounceTime (200ms)
      stabilizer.update(0.3, 350); // 150ms later
      expect(stabilizer.getState()).toBe('detecting'); // Still detecting

      // Reach exitDebounceTime
      stabilizer.update(0.3, 400); // 200ms later
      expect(stabilizer.getState()).toBe('invalid'); // Now invalid
    });

    it("should provide 'detecting' state only when exiting valid state", () => {
      // Invalid to valid - immediate (no detecting state)
      stabilizer.update(0.8, 100);
      expect(stabilizer.getState()).toBe('valid');

      // Valid to detecting (going invalid)
      stabilizer.update(0.3, 200);
      expect(stabilizer.getState()).toBe('detecting');

      // Complete transition to invalid after exitDebounceTime
      stabilizer.update(0.3, 400); // 200ms later
      expect(stabilizer.getState()).toBe('invalid');
    });
  });

  describe('Edge Cases', () => {
    it('should handle exact threshold values correctly', () => {
      // Exact upper threshold - immediate transition
      stabilizer.update(0.7, 100);
      expect(stabilizer.getState()).toBe('valid');

      // Exact lower threshold from valid state
      stabilizer.update(0.5, 200);
      expect(stabilizer.getState()).toBe('valid'); // Hysteresis

      // Below lower threshold - go to detecting state
      stabilizer.update(0.49, 300);
      expect(stabilizer.getState()).toBe('detecting');

      // After exitDebounceTime - go to invalid
      stabilizer.update(0.49, 500);
      expect(stabilizer.getState()).toBe('invalid');
    });

    it('should handle time jumps gracefully', () => {
      // Enter valid state immediately
      stabilizer.update(0.8, 100);
      expect(stabilizer.getState()).toBe('valid');

      // Large time jump while maintaining high confidence
      stabilizer.update(0.8, 10000);
      expect(stabilizer.getState()).toBe('valid');
    });

    it('should handle backwards time gracefully', () => {
      // Get to valid state
      stabilizer.update(0.8, 200);
      expect(stabilizer.getState()).toBe('valid');

      // Time goes backwards (should ignore)
      stabilizer.update(0.8, 100);
      expect(stabilizer.getState()).toBe('valid');
    });
  });

  describe('Configuration', () => {
    it('should accept custom thresholds', () => {
      const customStabilizer = new PoseValidityStabilizer({
        ...DEFAULT_EXERCISE_CONFIG,
        upperThreshold: 0.9,
        lowerThreshold: 0.3,
      });

      // Below upper threshold
      customStabilizer.update(0.8, 100);
      expect(customStabilizer.getState()).toBe('invalid');

      // Above upper threshold - immediate transition
      customStabilizer.update(0.95, 200);
      expect(customStabilizer.getState()).toBe('valid');

      // Between thresholds
      customStabilizer.update(0.5, 300);
      expect(customStabilizer.getState()).toBe('valid');

      // Below lower threshold - enter detecting
      customStabilizer.update(0.2, 400);
      expect(customStabilizer.getState()).toBe('detecting');

      // After custom exitDebounceTime - go to invalid
      customStabilizer.update(0.2, 900); // 500ms later
      expect(customStabilizer.getState()).toBe('invalid');
    });

    it('should accept custom exit debounce time', () => {
      const customStabilizer = new PoseValidityStabilizer({
        ...DEFAULT_EXERCISE_CONFIG,
        exitDebounceTime: 1000, // 1 second
      });

      // Enter valid immediately
      customStabilizer.update(0.8, 100);
      expect(customStabilizer.getState()).toBe('valid');

      // Drop confidence - enter detecting
      customStabilizer.update(0.4, 200);
      expect(customStabilizer.getState()).toBe('detecting');

      // Still detecting after 500ms
      customStabilizer.update(0.4, 700);
      expect(customStabilizer.getState()).toBe('detecting');

      // After 1000ms - transition to invalid
      customStabilizer.update(0.4, 1200); // 1000ms elapsed
      expect(customStabilizer.getState()).toBe('invalid');
    });
  });

  describe('State Information', () => {
    it('should provide detailed state information', () => {
      const stateInfo = stabilizer.getStateInfo();
      expect(stateInfo).toEqual({
        state: 'invalid',
        confidence: 0,
        timeInState: 0,
        isTransitioning: false,
      });

      // Immediate transition to valid
      stabilizer.update(0.8, 100);
      const validInfo = stabilizer.getStateInfo();
      expect(validInfo).toEqual({
        state: 'valid',
        confidence: 0.8,
        timeInState: 0,
        isTransitioning: false,
      });

      // Start exit transition to detecting
      stabilizer.update(0.4, 200);
      const transitionInfo = stabilizer.getStateInfo();
      expect(transitionInfo).toEqual({
        state: 'detecting',
        confidence: 0.4,
        timeInState: 0,
        isTransitioning: true,
      });
    });
  });
});
