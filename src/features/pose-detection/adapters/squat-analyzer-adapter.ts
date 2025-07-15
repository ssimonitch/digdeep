import type {
  RepPhase,
  SquatPoseAnalysis,
  SquatPoseAnalyzer,
  SquatPoseAnalyzerConfig,
} from '../services/squat-pose-analyzer.service';
import { getSquatPoseAnalyzer } from '../services/squat-pose-analyzer.service';
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
};

/**
 * Adapter that wraps the existing SquatPoseAnalyzer to implement the generic ExerciseAnalyzer interface
 *
 * This adapter enables the squat analyzer to work with the generic exercise analysis infrastructure
 * while maintaining all existing functionality and backward compatibility.
 */
export class SquatAnalyzerAdapter
  implements ExerciseAnalyzer<SquatPoseAnalysis, SquatAnalysisMetrics, SquatPoseAnalyzerConfig>
{
  private analyzer: SquatPoseAnalyzer;
  private config: SquatPoseAnalyzerConfig;

  constructor(config?: SquatPoseAnalyzerConfig) {
    this.config = config ?? {};
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
    const { squatMetrics, confidence, isValid } = analysis;

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
  getConfig(): SquatPoseAnalyzerConfig {
    return { ...this.config };
  }

  /**
   * Update the analyzer configuration
   */
  updateConfig(config: Partial<SquatPoseAnalyzerConfig>): void {
    this.config = { ...this.config, ...config };
    // Note: This doesn't recreate the analyzer instance as that would require re-initialization
    // The existing analyzer will continue with its current config until recreated
  }
}
