import type { PoseLandmarker, PoseLandmarkerResult } from '@mediapipe/tasks-vision';
import { FilesetResolver } from '@mediapipe/tasks-vision';

import { errorMonitor } from '@/shared/services/error-monitor.service';
import { performanceMonitor } from '@/shared/services/performance-monitor.service';

/**
 * Configuration options for the OptimizedPoseDetector service
 */
interface PoseDetectorConfig {
  modelAssetPath?: string;
  delegate?: 'CPU' | 'GPU';
  runningMode?: 'IMAGE' | 'VIDEO';
  numPoses?: number;
  minPoseDetectionConfidence?: number;
  minPosePresenceConfidence?: number;
  minTrackingConfidence?: number;
  outputSegmentationMasks?: boolean;
}

/**
 * Result interface for pose detection with enhanced metadata
 */
interface PoseDetectionResult {
  landmarks: PoseLandmarkerResult | null;
  timestamp: number;
  confidence: number;
  processingTime: number;
  isValid: boolean;
}

/**
 * OptimizedPoseDetector - Production-ready MediaPipe Pose detection service
 *
 * Features:
 * - Singleton pattern for resource efficiency
 * - GPU acceleration with CPU fallback
 * - Comprehensive error handling and reporting
 * - Performance monitoring and throttling
 * - Proper resource cleanup
 * - 30+ FPS target performance
 */
export class OptimizedPoseDetector {
  private static instance: OptimizedPoseDetector | null = null;
  private poseLandmarker: PoseLandmarker | null = null;
  private isInitialized = false;
  private isInitializing = false;
  private config: Required<PoseDetectorConfig>;
  private totalFrames = 0;
  private successfulDetections = 0;
  private lastFrameTime = 0;
  private readonly targetFPS = 30;
  private readonly minFrameInterval = 1000 / this.targetFPS; // ~33.33ms

  private constructor(config: PoseDetectorConfig = {}) {
    this.config = {
      modelAssetPath:
        config.modelAssetPath ??
        'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
      delegate: config.delegate ?? 'GPU',
      runningMode: config.runningMode ?? 'VIDEO',
      numPoses: config.numPoses ?? 1,
      minPoseDetectionConfidence: config.minPoseDetectionConfidence ?? 0.5,
      minPosePresenceConfidence: config.minPosePresenceConfidence ?? 0.5,
      minTrackingConfidence: config.minTrackingConfidence ?? 0.5,
      outputSegmentationMasks: config.outputSegmentationMasks ?? false,
    };

    // Start the performance monitor (it has internal guards against multiple starts)
    performanceMonitor.start();
  }

  /**
   * Get the singleton instance of OptimizedPoseDetector
   */
  public static getInstance(config?: PoseDetectorConfig): OptimizedPoseDetector {
    OptimizedPoseDetector.instance ??= new OptimizedPoseDetector(config);
    return OptimizedPoseDetector.instance;
  }

  /**
   * Initialize the MediaPipe pose detection system
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized || this.isInitializing) {
      return;
    }

    this.isInitializing = true;
    const startTime = performance.now();

    try {
      errorMonitor.reportError('Starting MediaPipe pose detection initialization', 'custom', 'low', {
        config: this.config,
      });

      // Load MediaPipe WASM files
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm',
      );

      // Create pose landmarker with GPU acceleration
      const { PoseLandmarker } = await import('@mediapipe/tasks-vision');
      this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: this.config.modelAssetPath,
          delegate: this.config.delegate,
        },
        runningMode: this.config.runningMode,
        numPoses: this.config.numPoses,
        minPoseDetectionConfidence: this.config.minPoseDetectionConfidence,
        minPosePresenceConfidence: this.config.minPosePresenceConfidence,
        minTrackingConfidence: this.config.minTrackingConfidence,
        outputSegmentationMasks: this.config.outputSegmentationMasks,
      });

      this.isInitialized = true;
      const initializationTime = performance.now() - startTime;

      errorMonitor.reportError(
        `MediaPipe pose detection initialized successfully in ${initializationTime.toFixed(2)}ms`,
        'custom',
        'low',
        {
          initializationTime,
          delegate: this.config.delegate,
          modelPath: this.config.modelAssetPath,
        },
      );
    } catch (error) {
      this.isInitialized = false;

      // Try CPU fallback if GPU failed
      if (this.config.delegate === 'GPU' && error instanceof Error) {
        errorMonitor.reportError('GPU acceleration failed, attempting CPU fallback', 'custom', 'medium', {
          originalError: error.message,
        });

        this.config.delegate = 'CPU';
        this.isInitializing = false;
        return this.initialize(); // Retry with CPU
      }

      errorMonitor.reportError('Failed to initialize MediaPipe pose detection', 'custom', 'critical', {
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Detect poses in a video frame with performance optimization
   */
  public detectPose(videoElement: HTMLVideoElement): PoseDetectionResult {
    if (!this.isInitialized || !this.poseLandmarker) {
      throw new Error('OptimizedPoseDetector not initialized. Call initialize() first.');
    }

    const now = performance.now();

    // Throttle frame processing to maintain target FPS
    if (now - this.lastFrameTime < this.minFrameInterval) {
      return {
        landmarks: null,
        timestamp: now,
        confidence: 0,
        processingTime: 0,
        isValid: false,
      };
    }

    this.lastFrameTime = now;

    const startProcessingTime = performance.now();

    try {
      // Perform pose detection
      const result = this.poseLandmarker.detectForVideo(videoElement, now);
      const processingTime = performance.now() - startProcessingTime;

      // Record frame metrics
      const isSuccess = result.landmarks.length > 0;
      this.totalFrames++;
      if (isSuccess) {
        this.successfulDetections++;
      }

      // Calculate confidence based on landmark presence and quality
      const confidence = this.calculateConfidence(result);
      const isValid = confidence > 0.5 && result.landmarks.length > 0;

      // Record in PerformanceMonitor
      performanceMonitor.recordOperation({
        name: 'poseDetection',
        processingTime,
        timestamp: now,
        success: isSuccess,
      });

      return {
        landmarks: result,
        timestamp: now,
        confidence,
        processingTime,
        isValid,
      };
    } catch (error) {
      const processingTime = performance.now() - startProcessingTime;

      // Record failed frame
      this.totalFrames++;
      performanceMonitor.recordOperation({
        name: 'poseDetection',
        processingTime,
        timestamp: now,
        success: false,
      });

      errorMonitor.reportError('Pose detection failed', 'custom', 'high', {
        error: error instanceof Error ? error.message : String(error),
        processingTime,
        videoElementReady: videoElement.readyState >= 2,
      });

      return {
        landmarks: null,
        timestamp: now,
        confidence: 0,
        processingTime,
        isValid: false,
      };
    }
  }

  /**
   * Calculate confidence score based on landmark quality
   */
  private calculateConfidence(result: PoseLandmarkerResult): number {
    if (!result.landmarks || result.landmarks.length === 0) {
      return 0;
    }

    const landmarks = result.landmarks[0];
    if (!landmarks || landmarks.length === 0) {
      return 0;
    }

    // Calculate average visibility of key landmarks
    const keyLandmarkIndices = [0, 11, 12, 23, 24]; // nose, shoulders, hips
    const keyLandmarks = keyLandmarkIndices
      .map((index) => landmarks[index])
      .filter((landmark) => landmark !== undefined);

    if (keyLandmarks.length === 0) {
      return 0;
    }

    const averageVisibility =
      keyLandmarks.reduce((sum, landmark) => {
        return sum + (landmark.visibility || 0);
      }, 0) / keyLandmarks.length;

    return Math.min(1.0, Math.max(0.0, averageVisibility));
  }


  /**
   * Check if the detector is initialized and ready
   */
  public isReady(): boolean {
    return this.isInitialized && this.poseLandmarker !== null;
  }

  /**
   * Clean up resources and reset the detector
   */
  public cleanup(): void {
    if (this.poseLandmarker) {
      try {
        this.poseLandmarker.close();
      } catch (error) {
        errorMonitor.reportError('Error during pose detector cleanup', 'custom', 'medium', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    this.poseLandmarker = null;
    this.isInitialized = false;
    this.isInitializing = false;

    // Reset metrics
    const finalMetrics = {
      totalFrames: this.totalFrames,
      successfulDetections: this.successfulDetections,
      successRate: this.totalFrames > 0 ? this.successfulDetections / this.totalFrames : 0,
    };
    this.totalFrames = 0;
    this.successfulDetections = 0;

    errorMonitor.reportError('OptimizedPoseDetector cleanup completed', 'custom', 'low', {
      finalMetrics,
    });
  }

  /**
   * Reset the singleton instance (mainly for testing)
   */
  public static resetInstance(): void {
    if (OptimizedPoseDetector.instance) {
      OptimizedPoseDetector.instance.cleanup();
      OptimizedPoseDetector.instance = null;
    }
  }
}

// Export singleton getter function following established patterns
export const getPoseDetector = (config?: PoseDetectorConfig): OptimizedPoseDetector => {
  return OptimizedPoseDetector.getInstance(config);
};
