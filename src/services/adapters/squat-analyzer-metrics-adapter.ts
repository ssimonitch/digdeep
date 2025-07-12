import type { PerformanceMonitor } from '@/shared/services/performance-monitor.service';

/**
 * SquatAnalysisMetrics interface - must match the existing public API
 */
interface SquatAnalysisMetrics {
  totalFrames: number;
  validSquatPoses: number;
  averageProcessingTime: number;
  successRate: number;
  currentFPS: number;
  averageConfidence: number;
}

/**
 * Adapter to translate PerformanceMonitor metrics to SquatAnalysisMetrics format
 * Maintains backward compatibility with existing API including confidence tracking
 */
export class SquatAnalyzerMetricsAdapter {
  private totalFrames = 0;
  private validSquatPoses = 0;
  private confidenceScores: number[] = [];
  private readonly maxHistorySize = 30;

  private readonly performanceMonitor: PerformanceMonitor;

  constructor(performanceMonitor: PerformanceMonitor) {
    this.performanceMonitor = performanceMonitor;
  }

  /**
   * Record a frame processing operation with confidence score
   */
  recordFrame(processingTime: number, success: boolean, confidence: number): void {
    this.totalFrames++;
    if (success) {
      this.validSquatPoses++;
    }

    // Track confidence scores
    this.confidenceScores.push(confidence);
    if (this.confidenceScores.length > this.maxHistorySize) {
      this.confidenceScores.shift();
    }

    // Record in PerformanceMonitor
    this.performanceMonitor.recordOperation({
      name: 'squatAnalysis',
      processingTime,
      timestamp: performance.now(),
      success,
    });

    // Also record confidence as a separate metric for detailed tracking
    this.performanceMonitor.recordOperation({
      name: 'squatConfidence',
      processingTime: confidence * 100, // Store as percentage for analytics
      timestamp: performance.now(),
      success: true,
    });
  }

  /**
   * Get metrics in the expected format for backward compatibility
   */
  getMetrics(): SquatAnalysisMetrics {
    const operationStats = this.performanceMonitor.getOperationMetrics('squatAnalysis');
    const currentMetrics = this.performanceMonitor.getCurrentMetrics();

    // Calculate average confidence
    const averageConfidence =
      this.confidenceScores.length > 0
        ? this.confidenceScores.reduce((a, b) => a + b, 0) / this.confidenceScores.length
        : 0;

    return {
      totalFrames: this.totalFrames,
      validSquatPoses: this.validSquatPoses,
      averageProcessingTime: operationStats.averageTime,
      successRate: this.totalFrames > 0 ? this.validSquatPoses / this.totalFrames : 0,
      currentFPS: currentMetrics.fps,
      averageConfidence,
    };
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.totalFrames = 0;
    this.validSquatPoses = 0;
    this.confidenceScores = [];
  }
}
