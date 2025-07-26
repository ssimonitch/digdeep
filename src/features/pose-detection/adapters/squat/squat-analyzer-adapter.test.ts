import { describe, expect, it } from 'vitest';

import type { SquatExerciseConfig } from '@/shared/exercise-config/squat';
import { SQUAT_EXERCISE_CONFIG } from '@/shared/exercise-config/squat';

import { createEmptySquatMetrics, SquatAnalyzerAdapter } from './squat-analyzer-adapter';

describe('SquatAnalyzerAdapter', () => {
  describe('createEmptySquatMetrics', () => {
    it('should create empty metrics with default values', () => {
      const metrics = createEmptySquatMetrics();

      expect(metrics).toMatchObject({
        depthPercentage: 0,
        depthAchieved: false,
        lateralShift: 0,
        isBalanced: true,
        barPathDeviation: 0,
        currentRep: 0,
        repPhase: 'standing',
        confidence: 0,
        isValidPose: false,
        detectionState: 'invalid',
        visibilityFlags: {
          shoulders: false,
          hips: false,
          knees: false,
          ankles: false,
        },
      });
    });

    it('should accept config parameter for future extensibility', () => {
      const customConfig: SquatExerciseConfig = {
        ...SQUAT_EXERCISE_CONFIG,
        analysis: {
          ...SQUAT_EXERCISE_CONFIG.analysis,
          depth: {
            ...SQUAT_EXERCISE_CONFIG.analysis.depth,
            depthThreshold: 0.5, // 50% depth
          },
        },
      };

      const metrics = createEmptySquatMetrics(customConfig);

      // Currently, config doesn't affect empty metrics
      // depthAchieved is always false for 0% depth
      expect(metrics.depthAchieved).toBe(false);
      expect(metrics.depthPercentage).toBe(0);
    });
  });

  describe('getEmptyMetrics', () => {
    it('should return empty metrics based on current configuration', () => {
      const adapter = new SquatAnalyzerAdapter();
      const emptyMetrics = adapter.getEmptyMetrics();

      expect(emptyMetrics).toMatchObject({
        depthPercentage: 0,
        depthAchieved: false,
        isValidPose: false,
        detectionState: 'invalid',
      });
    });

    it('should update empty metrics when config is updated', () => {
      const adapter = new SquatAnalyzerAdapter();

      // Get initial empty metrics
      const initialMetrics = adapter.getEmptyMetrics();
      expect(initialMetrics.depthAchieved).toBe(false);

      // Update config (for future when empty metrics might be config-aware)
      const customConfig: Partial<SquatExerciseConfig> = {
        analysis: {
          ...SQUAT_EXERCISE_CONFIG.analysis,
          depth: {
            ...SQUAT_EXERCISE_CONFIG.analysis.depth,
            depthThreshold: 0.5,
          },
        },
      };

      adapter.updateConfig(customConfig);

      // Get updated empty metrics
      const updatedMetrics = adapter.getEmptyMetrics();

      // Currently still false, but infrastructure is in place for future changes
      expect(updatedMetrics.depthAchieved).toBe(false);
    });
  });

  describe('config propagation', () => {
    it('should store and return configuration', () => {
      const customConfig: SquatExerciseConfig = {
        ...SQUAT_EXERCISE_CONFIG,
        displayName: 'Custom Squat',
      };

      const adapter = new SquatAnalyzerAdapter(customConfig);
      const config = adapter.getConfig();

      expect(config.displayName).toBe('Custom Squat');
    });

    it('should update configuration', () => {
      const adapter = new SquatAnalyzerAdapter();
      const initialConfig = adapter.getConfig();

      expect(initialConfig.displayName).toBe('Squat');

      adapter.updateConfig({ displayName: 'Updated Squat' });
      const updatedConfig = adapter.getConfig();

      expect(updatedConfig.displayName).toBe('Updated Squat');
    });
  });
});
