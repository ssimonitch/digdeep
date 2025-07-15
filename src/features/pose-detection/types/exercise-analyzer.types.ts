/**
 * Generic interface for exercise analyzers to enable multi-exercise support
 *
 * This interface provides a common contract for all exercise analyzers,
 * allowing the infrastructure to work with any type of exercise analysis
 * while maintaining type safety through generics.
 *
 * @template TAnalysis - The analysis result type (e.g., SquatPoseAnalysis)
 * @template TMetrics - The simplified metrics type for UI (e.g., SquatAnalysisMetrics)
 * @template TConfig - The analyzer configuration type (e.g., SquatPoseAnalyzerConfig)
 */
export interface ExerciseAnalyzer<TAnalysis, TMetrics, TConfig = unknown> {
  /**
   * Initialize the analyzer (e.g., load ML models, set up resources)
   */
  initialize(): Promise<void>;

  /**
   * Analyze a single video frame for the specific exercise
   * @param video - The video element containing the current frame
   * @returns The exercise-specific analysis result
   */
  analyze(video: HTMLVideoElement): TAnalysis;

  /**
   * Extract simplified metrics from the analysis for UI consumption
   * @param analysis - The full analysis result
   * @returns Simplified metrics suitable for UI display
   */
  extractMetrics(analysis: TAnalysis): TMetrics;

  /**
   * Reset the analyzer state (e.g., rep counting, history tracking)
   */
  reset(): void;

  /**
   * Clean up resources when the analyzer is no longer needed
   */
  cleanup(): void;

  /**
   * Get the current configuration
   */
  getConfig(): TConfig;

  /**
   * Update the analyzer configuration
   * @param config - Partial configuration to update
   */
  updateConfig(config: Partial<TConfig>): void;
}

/**
 * Base metrics that all exercises should include
 */
export interface BaseExerciseMetrics {
  /** Overall confidence of the pose detection (0-1) */
  confidence: number;
  /** Whether a valid pose is detected */
  isValidPose: boolean;
  /** Current repetition count */
  currentRep: number;
  /** Current phase in the repetition cycle */
  repPhase: string;
}

/**
 * Options for the generic exercise analysis hook
 */
export interface UseExerciseAnalysisOptions<TAnalysis, TMetrics, TConfig> {
  /** Factory function to create the exercise-specific analyzer */
  analyzerFactory: (config?: TConfig) => ExerciseAnalyzer<TAnalysis, TMetrics, TConfig>;
  /** Empty/default metrics to use when no analysis has been performed */
  emptyMetrics: TMetrics;
  /** Whether to auto-start analysis when camera is ready */
  autoStart?: boolean;
  /** Configuration for the exercise analyzer */
  config?: TConfig;
  /** Callback fired on each analysis frame */
  onAnalysis?: (analysis: TAnalysis) => void;
  /** Target frame rate for analysis (default: 30 FPS) */
  targetFPS?: number;
}

/**
 * Return type for the generic exercise analysis hook
 */
export interface UseExerciseAnalysisReturn<TAnalysis, TMetrics> {
  // Analysis data
  analysis: TAnalysis | null;
  metrics: TMetrics;
  isAnalyzing: boolean;
  isInitialized: boolean;

  // Controls
  startAnalysis: () => Promise<void>;
  stopAnalysis: () => void;
  resetSession: () => void;

  // Performance metrics
  fps: number;
  processingTime: number;

  // Camera state
  camera: {
    stream: MediaStream | null;
    isActive: boolean;
    permission: {
      granted: boolean;
      pending: boolean;
      error?: string;
    };
    error?: string;
    config: {
      width: number;
      height: number;
      frameRate: number;
      facingMode: 'user' | 'environment';
    };
  };

  // Error state
  error: string | undefined;
}
