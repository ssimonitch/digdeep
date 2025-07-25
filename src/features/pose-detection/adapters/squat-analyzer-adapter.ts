import type { SquatExerciseConfig } from '@/shared/exercise-config/squat';
import { SQUAT_EXERCISE_CONFIG } from '@/shared/exercise-config/squat';

import type { RepPhase, SquatPoseAnalysis, SquatPoseAnalyzer } from '../services/squat-pose-analyzer.service';
import { getSquatPoseAnalyzer } from '../services/squat-pose-analyzer.service';
import type { DetectionState } from '../services/pose-validity-stabilizer';
import type { ExerciseAnalyzer } from '../types/exercise-analyzer.types';

/**
 * Simplified metrics interface for UI components
 */
export interface SquatAnalysisMetrics {
  // Depth metrics
  depthPercentage: number;
  depthAchieved: boolean;

  // Balance metrics
  lateralShift: number;
  isBalanced: boolean;

  // Bar path metrics
  barPathDeviation: number;

  // Rep counting
  currentRep: number;
  repPhase: RepPhase;

  // Overall quality
  confidence: number;
  isValidPose: boolean;
  detectionState: DetectionState;
}

/**
 * Default empty metrics for squat analysis
 */
export const EMPTY_SQUAT_METRICS: SquatAnalysisMetrics = {
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
};

/**
 * Adapter that wraps the existing SquatPoseAnalyzer to implement the generic ExerciseAnalyzer interface.
 */
export class SquatAnalyzerAdapter
  implements ExerciseAnalyzer<SquatPoseAnalysis, SquatAnalysisMetrics, SquatExerciseConfig>
{
  private analyzer: SquatPoseAnalyzer;
  private config: SquatExerciseConfig;

  constructor(config?: SquatExerciseConfig) {
    this.config = config ?? SQUAT_EXERCISE_CONFIG;
    this.analyzer = getSquatPoseAnalyzer(this.config);
  }

  /**
   * Initialize the squat analyzer (loads MediaPipe models)
   */
  async initialize(): Promise<void> {
    await this.analyzer.initialize();
  }

  /**
   * Analyze a video frame for squat form
   */
  analyze(video: HTMLVideoElement): SquatPoseAnalysis {
    return this.analyzer.analyzeSquatPose(video);
  }

  /**
   * Extract simplified metrics from the full analysis for UI consumption
   */
  extractMetrics(analysis: SquatPoseAnalysis): SquatAnalysisMetrics {
    const { squatMetrics, confidence, isValid, detectionState } = analysis;

    return {
      // Depth metrics
      depthPercentage: squatMetrics.depth.depthPercentage ?? 0,
      depthAchieved: squatMetrics.depth.hasAchievedDepth,

      // Balance metrics
      lateralShift: squatMetrics.balance.lateralDeviation ?? 0,
      isBalanced: squatMetrics.balance.isBalanced,

      // Bar path metrics
      barPathDeviation: squatMetrics.barPath.verticalDeviation ?? 0,

      // Rep counting
      currentRep: squatMetrics.repCounting.repCount,
      repPhase: squatMetrics.repCounting.phase,

      // Overall quality
      confidence,
      isValidPose: isValid,
      detectionState,
    };
  }

  /**
   * Reset the analyzer state (rep counting and shift history)
   */
  reset(): void {
    this.analyzer.resetRepCounting();
    this.analyzer.resetShiftHistory();
  }

  /**
   * Clean up resources when the analyzer is no longer needed
   */
  cleanup(): void {
    this.analyzer.cleanup();
  }

  /**
   * Get the current configuration
   */
  getConfig(): SquatExerciseConfig {
    return { ...this.config };
  }

  /**
   * Update the analyzer configuration
   */
  updateConfig(config: Partial<SquatExerciseConfig>): void {
    this.config = { ...this.config, ...config };
    // Note: This doesn't recreate the analyzer instance as that would require re-initialization
    // The existing analyzer will continue with its current config until recreated
  }
}
