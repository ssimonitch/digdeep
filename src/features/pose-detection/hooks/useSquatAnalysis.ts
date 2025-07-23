import type { SquatExerciseConfig } from '@/shared/exercise-config/squat';
import { useExerciseAnalysis } from '@/shared/hooks/useExerciseAnalysis';

import {
  EMPTY_SQUAT_METRICS,
  type SquatAnalysisMetrics,
  SquatAnalyzerAdapter,
} from '../adapters/squat-analyzer-adapter';
import type { SquatPoseAnalysis } from '../services/squat-pose-analyzer.service';

/**
 * Configuration options for useSquatAnalysis hook
 */
export interface UseSquatAnalysisOptions {
  /** Whether to auto-start analysis when camera is ready */
  autoStart?: boolean;
  /** Configuration for the squat pose analyzer */
  config?: SquatExerciseConfig;
  /** Callback fired on each analysis frame */
  onAnalysis?: (analysis: SquatPoseAnalysis) => void;
  /** Target frame rate for analysis (default: 30 FPS) */
  targetFPS?: number;
}

/**
 * Hook return interface
 */
export interface UseSquatAnalysisReturn {
  // Analysis data
  analysis: SquatPoseAnalysis | null;
  metrics: SquatAnalysisMetrics;
  isAnalyzing: boolean;
  isInitialized: boolean;

  // Controls
  startAnalysis: () => Promise<void>;
  stopAnalysis: () => void;
  resetSession: () => void;

  // Performance metrics
  fps: number;
  processingTime: number;

  // Camera integration
  camera: ReturnType<typeof useExerciseAnalysis>['camera'];

  // Error state
  error: string | undefined;
}

/**
 * React hook for real-time squat analysis combining camera management and pose detection
 *
 * This hook is a thin wrapper around the generic useExerciseAnalysis hook.
 *
 * @param options Configuration options for analysis behavior
 * @returns Analysis state, metrics, and control functions
 *
 * @example
 * ```typescript
 * const {
 *   metrics,
 *   isAnalyzing,
 *   startAnalysis,
 *   stopAnalysis,
 *   fps
 * } = useSquatAnalysis({
 *   autoStart: true,
 *   targetFPS: 30,
 *   onAnalysis: (analysis) => console.log('Rep:', analysis.squatMetrics.repCounting.repCount)
 * });
 *
 * // metrics.depthPercentage, metrics.isBalanced, etc.
 * ```
 */
export function useSquatAnalysis(options: UseSquatAnalysisOptions = {}): UseSquatAnalysisReturn {
  // Use the generic exercise analysis hook with squat-specific configuration
  return useExerciseAnalysis<SquatPoseAnalysis, SquatAnalysisMetrics, SquatExerciseConfig>({
    analyzerFactory: (config) => new SquatAnalyzerAdapter(config),
    emptyMetrics: EMPTY_SQUAT_METRICS,
    ...options,
  });
}
