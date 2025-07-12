import type { PoseLandmarkerResult } from '@mediapipe/tasks-vision';
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';

import { errorMonitor } from '@/shared/services/error-monitor.service';
import { performanceMonitor } from '@/shared/services/performance-monitor.service';

export interface PoseDetectorConfig {
  modelAssetPath?: string;
  delegate?: 'GPU' | 'CPU';
  runningMode?: 'VIDEO' | 'IMAGE';
  numPoses?: number;
  minPoseDetectionConfidence?: number;
  minPosePresenceConfidence?: number;
  minTrackingConfidence?: number;
  outputSegmentationMasks?: boolean;
}

export interface PoseDetectionResult {
  landmarks: PoseLandmarkerResult | null;
  timestamp: number;
  confidence: number;
  processingTime: number;
  isValid: boolean;
}

/**
 * Base class for pose detection services
 * Provides common MediaPipe initialization and frame processing logic
 *
 * @example
 * ```typescript
 * class SquatPoseDetector extends BasePoseDetector {
 *   constructor() {
 *     super({
 *       minPoseDetectionConfidence: 0.7,
 *       minPosePresenceConfidence: 0.7,
 *       minTrackingConfidence: 0.7
 *     });
 *   }
 *
 *   protected calculateConfidence(result: PoseLandmarkerResult): number {
 *     // Custom confidence calculation for squat-specific landmarks
 *     // Focus on lower body landmarks
 *     return customSquatConfidence;
 *   }
 * }
 * ```
 */
export abstract class BasePoseDetector {
  /**
   * Indicates whether the pose detector has been successfully initialized
   * @protected
   */
  protected isInitialized = false;

  /**
   * Indicates whether initialization is currently in progress
   * Used to prevent concurrent initialization attempts
   * @protected
   */
  protected isInitializing = false;

  /**
   * MediaPipe PoseLandmarker instance
   * Will be null until successfully initialized
   * @protected
   */
  protected poseLandmarker: PoseLandmarker | null = null;

  /**
   * Complete configuration with all default values applied
   * @protected
   */
  protected config: Required<PoseDetectorConfig>;

  /**
   * Timestamp of the last processed frame
   * Used for frame rate throttling to maintain 30 FPS
   * @protected
   */
  protected lastFrameTime = 0;

  /**
   * Total number of frames processed since initialization
   * Used for performance metrics
   * @protected
   */
  protected totalFrames = 0;

  /**
   * Number of frames with successful pose detection
   * Used for calculating detection success rate
   * @protected
   */
  protected successfulDetections = 0;

  constructor(config: PoseDetectorConfig = {}) {
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

    // Validate configuration
    this.validateConfig();

    // Start performance monitor
    performanceMonitor.start();
  }

  /**
   * Validates the configuration values
   * @throws {Error} If any configuration value is invalid
   * @private
   */
  private validateConfig(): void {
    // Validate delegate
    if (this.config.delegate !== 'GPU' && this.config.delegate !== 'CPU') {
      throw new Error(`Invalid delegate: ${String(this.config.delegate)}. Must be 'GPU' or 'CPU'`);
    }

    // Validate running mode
    if (this.config.runningMode !== 'VIDEO' && this.config.runningMode !== 'IMAGE') {
      throw new Error(`Invalid runningMode: ${String(this.config.runningMode)}. Must be 'VIDEO' or 'IMAGE'`);
    }

    // Validate numPoses
    if (!Number.isInteger(this.config.numPoses) || this.config.numPoses < 1) {
      throw new Error(`Invalid numPoses: ${this.config.numPoses}. Must be a positive integer`);
    }

    // Validate confidence thresholds
    const confidenceFields = [
      'minPoseDetectionConfidence',
      'minPosePresenceConfidence',
      'minTrackingConfidence',
    ] as const;

    for (const field of confidenceFields) {
      const value = this.config[field];
      if (typeof value !== 'number' || value < 0 || value > 1) {
        throw new Error(`Invalid ${field}: ${value}. Must be a number between 0 and 1`);
      }
    }

    // Validate boolean fields
    if (typeof this.config.outputSegmentationMasks !== 'boolean') {
      throw new Error(
        `Invalid outputSegmentationMasks: ${String(this.config.outputSegmentationMasks)}. Must be a boolean`,
      );
    }
  }

  /**
   * Initialize MediaPipe pose detection
   */
  async initialize(): Promise<void> {
    if (this.isInitialized || this.isInitializing) {
      return;
    }

    this.isInitializing = true;
    const startTime = performance.now();

    try {
      errorMonitor.reportError('Starting MediaPipe pose detection initialization', 'custom', 'low', {
        config: this.config,
      });

      // Load MediaPipe vision module
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm',
      );

      try {
        // Create pose landmarker
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
        const initTime = performance.now() - startTime;

        errorMonitor.reportError(
          `MediaPipe pose detection initialized successfully in ${initTime.toFixed(2)}ms`,
          'custom',
          'low',
          {
            initializationTime: initTime,
            delegate: this.config.delegate,
            modelPath: this.config.modelAssetPath,
          },
        );
      } catch (error) {
        // GPU fallback logic
        if (this.config.delegate === 'GPU' && error instanceof Error) {
          errorMonitor.reportError('GPU acceleration failed, attempting CPU fallback', 'custom', 'medium', {
            originalError: error.message,
          });

          this.config.delegate = 'CPU';
          this.isInitializing = false;
          return this.initialize();
        }
        throw error;
      }
    } catch (error) {
      this.isInitialized = false;
      errorMonitor.reportError('Failed to initialize MediaPipe pose detection', 'custom', 'critical', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Detect pose in video frame
   */
  detectPose(videoElement: HTMLVideoElement): PoseDetectionResult {
    if (!this.isInitialized || !this.poseLandmarker) {
      throw new Error('Pose detector not initialized');
    }

    const now = performance.now();

    // Throttle to 30 FPS
    if (now - this.lastFrameTime < 33.33) {
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
      const result = this.poseLandmarker.detectForVideo(videoElement, now);
      const processingTime = performance.now() - startProcessingTime;

      const isSuccess = result.landmarks.length > 0;
      this.totalFrames++;
      if (isSuccess) {
        this.successfulDetections++;
      }

      const confidence = this.calculateConfidence(result);
      const isValid = confidence > 0.5 && result.landmarks.length > 0;

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
      this.totalFrames++;

      performanceMonitor.recordOperation({
        name: 'poseDetection',
        processingTime,
        timestamp: now,
        success: false,
      });

      errorMonitor.reportError('Pose detection failed', 'custom', 'high', {
        error: error instanceof Error ? error.message : String(error),
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
   * Calculate confidence score for detected pose
   *
   * This method can be overridden by subclasses to provide custom confidence calculations
   * based on exercise-specific requirements. The default implementation calculates
   * the average visibility of key landmarks (nose, shoulders, hips).
   *
   * @param result - The pose detection result from MediaPipe
   * @returns A confidence score between 0 and 1
   *
   * @example
   * ```typescript
   * protected calculateConfidence(result: PoseLandmarkerResult): number {
   *   if (!result.landmarks?.[0]) return 0;
   *
   *   const landmarks = result.landmarks[0];
   *   // Focus on lower body landmarks for squat analysis
   *   const squatLandmarks = [23, 24, 25, 26, 27, 28]; // hips, knees, ankles
   *
   *   const visibilities = squatLandmarks
   *     .map(i => landmarks[i]?.visibility || 0)
   *     .filter(v => v > 0);
   *
   *   return visibilities.length > 0
   *     ? visibilities.reduce((a, b) => a + b) / visibilities.length
   *     : 0;
   * }
   * ```
   *
   * @protected
   */
  protected calculateConfidence(result: PoseLandmarkerResult): number {
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
   * Cleanup resources
   */
  cleanup(): void {
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
   * Check if detector is ready for use
   */
  isReady(): boolean {
    return this.isInitialized && this.poseLandmarker !== null;
  }
}
