import type { PerformanceMonitor } from '@/shared/services/performance-monitor.service';

/**
 * PoseDetectionMetrics interface - must match the existing public API
 */
interface PoseDetectionMetrics {
  totalFrames: number;
  successfulDetections: number;
  averageProcessingTime: number;
  successRate: number;
  currentFPS: number;
}

/**
 * Adapter to translate PerformanceMonitor metrics to PoseDetectionMetrics format
 * Maintains backward compatibility with existing API
 */
export class PoseDetectorMetricsAdapter {
  private totalFrames = 0;
  private successfulDetections = 0;

  private readonly performanceMonitor: PerformanceMonitor;

  constructor(performanceMonitor: PerformanceMonitor) {
    this.performanceMonitor = performanceMonitor;
  }

  /**
   * Record a frame processing operation
   */
  recordFrame(processingTime: number, success: boolean): void {
    this.totalFrames++;
    if (success) {
      this.successfulDetections++;
    }

    // Record in PerformanceMonitor
    this.performanceMonitor.recordOperation({
      name: 'poseDetection',
      processingTime,
      timestamp: performance.now(),
      success,
    });
  }

  /**
   * Get metrics in the expected format for backward compatibility
   */
  getMetrics(): PoseDetectionMetrics {
    const operationStats = this.performanceMonitor.getOperationMetrics('poseDetection');
    const currentMetrics = this.performanceMonitor.getCurrentMetrics();

    return {
      totalFrames: this.totalFrames,
      successfulDetections: this.successfulDetections,
      averageProcessingTime: operationStats.averageTime,
      successRate: this.totalFrames > 0 ? this.successfulDetections / this.totalFrames : 0,
      currentFPS: currentMetrics.fps,
    };
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.totalFrames = 0;
    this.successfulDetections = 0;
    // Note: PerformanceMonitor keeps its own history, which is fine
    // as it provides more detailed analytics beyond this simple interface
  }
}
