import type { SquatExerciseConfig } from '@/shared/exercise-config/squat';
import { SQUAT_EXERCISE_CONFIG } from '@/shared/exercise-config/squat';

import type { DetectionState } from '../../services';
import type {
  RepPhase,
  SquatPoseAnalysis,
  SquatPoseAnalyzer,
} from '../../services/analyzers/squat/squat-pose-analyzer';
import { getSquatPoseAnalyzer } from '../../services/analyzers/squat/squat-pose-analyzer';
import type { ExerciseAnalyzer } from '../../services/analyzers/types';

/**
 * Boolean visibility flags for key body parts
 * Used for UI components to show/hide guidance
 */
export interface VisibilityFlags {
  shoulders: boolean;
  hips: boolean;
  knees: boolean;
  ankles: boolean;
}

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

  // Visibility flags for UI guidance
  visibilityFlags: VisibilityFlags;
}

/**
 * Create empty metrics for squat analysis based on configuration
 * @param _config Optional squat exercise configuration
 * @returns Empty metrics that respect the provided configuration
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function createEmptySquatMetrics(_config?: SquatExerciseConfig): SquatAnalysisMetrics {
  // Note: config parameter is preserved for future extensibility
  // Currently, empty metrics always have depthAchieved: false (0% depth)
  // In the future, we might want to use config values to set different defaults

  return {
    depthPercentage: 0,
    // depthAchieved should be false when depthPercentage is 0, regardless of threshold
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
  };
}

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

    // Extract visibility flags from stabilized visibility if available,
    // otherwise fall back to threshold-based approach with raw values
    let visibilityFlags: VisibilityFlags;

    if (squatMetrics.stabilizedVisibility) {
      // Prefer stabilized visibility for stable UI
      visibilityFlags = {
        shoulders: squatMetrics.stabilizedVisibility.shoulders.isVisible,
        hips: squatMetrics.stabilizedVisibility.hips.isVisible,
        knees: squatMetrics.stabilizedVisibility.knees.isVisible,
        ankles: squatMetrics.stabilizedVisibility.ankles.isVisible,
      };
    } else {
      // Fallback to raw values with threshold
      const visibilityThreshold = 0.5;
      visibilityFlags = {
        shoulders: squatMetrics.keyLandmarkVisibility.shoulders > visibilityThreshold,
        hips: squatMetrics.keyLandmarkVisibility.hips > visibilityThreshold,
        knees: squatMetrics.keyLandmarkVisibility.knees > visibilityThreshold,
        ankles: squatMetrics.keyLandmarkVisibility.ankles > visibilityThreshold,
      };
    }

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

      // Visibility flags for UI
      visibilityFlags,
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

  /**
   * Get empty metrics based on the current configuration
   */
  getEmptyMetrics(): SquatAnalysisMetrics {
    return createEmptySquatMetrics(this.config);
  }
}
