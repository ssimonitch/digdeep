import type { NormalizedLandmark, PoseLandmarker, PoseLandmarkerResult } from '@mediapipe/tasks-vision';
import { FilesetResolver } from '@mediapipe/tasks-vision';

import { errorMonitor } from '@/shared/services/error-monitor.service';
import { performanceMonitor } from '@/shared/services/performance-monitor.service';

import { SquatAnalyzerMetricsAdapter } from './adapters/squat-analyzer-metrics-adapter';

/**
 * MediaPipe Pose Landmark indices for squat analysis
 * Based on the 33-point pose model
 */
export const SQUAT_LANDMARKS = {
  // Core body landmarks for squat analysis
  NOSE: 0,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32,
} as const;

/**
 * Configuration optimized for squat form analysis
 */
interface SquatPoseAnalyzerConfig {
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
 * Squat-specific pose analysis result
 */
export interface SquatPoseAnalysis {
  landmarks: PoseLandmarkerResult | null;
  timestamp: number;
  confidence: number;
  processingTime: number;
  isValid: boolean;
  squatMetrics: {
    hasValidSquatPose: boolean;
    keyLandmarkVisibility: {
      hips: number;
      knees: number;
      ankles: number;
      shoulders: number;
    };
    jointAngles: {
      leftKneeAngle: number | null;
      rightKneeAngle: number | null;
      leftHipAngle: number | null;
      rightHipAngle: number | null;
      averageKneeAngle: number | null;
    };
    barPosition: {
      shoulderMidpoint: { x: number; y: number; z: number } | null;
      isValidBarPosition: boolean;
    };
    balance: {
      lateralDeviation: number | null;
      isBalanced: boolean;
    };
    depth: {
      hipKneeRatio: number | null;
      hasAchievedDepth: boolean;
      depthPercentage: number | null;
    };
  };
}

/**
 * Performance metrics for squat analysis
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
 * SquatPoseAnalyzer - Specialized MediaPipe Pose service for squat form analysis
 *
 * Optimized for:
 * - Bar path tracking via shoulder midpoint
 * - Depth achievement detection via hip-knee angles
 * - Joint angle measurements for form analysis
 * - Lateral imbalance detection
 * - Tempo tracking preparation
 */
export class SquatPoseAnalyzer {
  private static instance: SquatPoseAnalyzer | null = null;
  private poseLandmarker: PoseLandmarker | null = null;
  private isInitialized = false;
  private isInitializing = false;
  private config: Required<SquatPoseAnalyzerConfig>;
  private metricsAdapter: SquatAnalyzerMetricsAdapter;
  private lastFrameTime = 0;
  private readonly targetFPS = 30;
  private readonly minFrameInterval = 1000 / this.targetFPS; // ~33.33ms

  constructor(config: SquatPoseAnalyzerConfig = {}) {
    this.config = {
      modelAssetPath:
        config.modelAssetPath ??
        'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
      delegate: config.delegate ?? 'GPU',
      runningMode: config.runningMode ?? 'VIDEO',
      numPoses: config.numPoses ?? 1,
      minPoseDetectionConfidence: config.minPoseDetectionConfidence ?? 0.7, // Higher for squat analysis
      minPosePresenceConfidence: config.minPosePresenceConfidence ?? 0.7,
      minTrackingConfidence: config.minTrackingConfidence ?? 0.7,
      outputSegmentationMasks: config.outputSegmentationMasks ?? false,
    };

    // Initialize metrics adapter with shared performance monitor
    this.metricsAdapter = new SquatAnalyzerMetricsAdapter(performanceMonitor);

    // Start the performance monitor (it has internal guards against multiple starts)
    performanceMonitor.start();
  }

  /**
   * Get the singleton instance of SquatPoseAnalyzer
   */
  public static getInstance(config?: SquatPoseAnalyzerConfig): SquatPoseAnalyzer {
    SquatPoseAnalyzer.instance ??= new SquatPoseAnalyzer(config);
    return SquatPoseAnalyzer.instance;
  }

  /**
   * Initialize the MediaPipe pose detection system optimized for squat analysis
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized || this.isInitializing) {
      return;
    }

    this.isInitializing = true;
    const startTime = performance.now();

    try {
      errorMonitor.reportError('Starting SquatPoseAnalyzer initialization', 'custom', 'low', {
        config: this.config,
      });

      // Load MediaPipe WASM files
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm',
      );

      // Create pose landmarker with optimized settings for squat analysis
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
        `SquatPoseAnalyzer initialized successfully in ${initializationTime.toFixed(2)}ms`,
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

      errorMonitor.reportError('Failed to initialize SquatPoseAnalyzer', 'custom', 'critical', {
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Analyze squat pose in a video frame with specialized squat metrics
   */
  public analyzeSquatPose(videoElement: HTMLVideoElement): SquatPoseAnalysis {
    if (!this.isInitialized || !this.poseLandmarker) {
      throw new Error('SquatPoseAnalyzer not initialized. Call initialize() first.');
    }

    const now = performance.now();

    // Throttle frame processing to maintain target FPS
    if (now - this.lastFrameTime < this.minFrameInterval) {
      return this.createEmptyAnalysis(now);
    }

    this.lastFrameTime = now;

    const startProcessingTime = performance.now();

    try {
      // Perform pose detection
      const result = this.poseLandmarker.detectForVideo(videoElement, now);
      const processingTime = performance.now() - startProcessingTime;

      // Processing time will be recorded after full analysis

      // Calculate confidence based on squat-specific landmarks
      const confidence = this.calculateSquatConfidence(result);

      // Analyze squat-specific metrics
      const squatMetrics = this.analyzeSquatMetrics(result);
      const isValid = confidence > 0.5 && squatMetrics.hasValidSquatPose;

      // Record frame with metrics adapter
      this.metricsAdapter.recordFrame(processingTime, isValid, confidence);

      return {
        landmarks: result,
        timestamp: now,
        confidence,
        processingTime,
        isValid,
        squatMetrics,
      };
    } catch (error) {
      const processingTime = performance.now() - startProcessingTime;

      // Record failed frame
      this.metricsAdapter.recordFrame(processingTime, false, 0);

      errorMonitor.reportError('Squat pose analysis failed', 'custom', 'high', {
        error: error instanceof Error ? error.message : String(error),
        processingTime,
        videoElementReady: videoElement.readyState >= 2,
      });

      return {
        ...this.createEmptyAnalysis(now),
        processingTime,
      };
    }
  }

  /**
   * Calculate confidence score based on squat-specific landmarks
   */
  private calculateSquatConfidence(result: PoseLandmarkerResult): number {
    if (!result.landmarks || result.landmarks.length === 0) {
      return 0;
    }

    const landmarks = result.landmarks[0];
    if (!landmarks || landmarks.length === 0) {
      return 0;
    }

    // Key landmarks for squat analysis with their importance weights
    const keyLandmarks = [
      { index: SQUAT_LANDMARKS.LEFT_HIP, weight: 0.25 },
      { index: SQUAT_LANDMARKS.RIGHT_HIP, weight: 0.25 },
      { index: SQUAT_LANDMARKS.LEFT_KNEE, weight: 0.2 },
      { index: SQUAT_LANDMARKS.RIGHT_KNEE, weight: 0.2 },
      { index: SQUAT_LANDMARKS.LEFT_ANKLE, weight: 0.1 },
      { index: SQUAT_LANDMARKS.RIGHT_ANKLE, weight: 0.1 },
    ];

    let totalWeight = 0;
    let weightedVisibility = 0;

    for (const { index, weight } of keyLandmarks) {
      const landmark = landmarks[index];
      if (landmark?.visibility !== undefined) {
        totalWeight += weight;
        weightedVisibility += landmark.visibility * weight;
      }
    }

    return totalWeight > 0 ? weightedVisibility / totalWeight : 0;
  }

  /**
   * Analyze squat-specific metrics from pose landmarks
   */
  private analyzeSquatMetrics(result: PoseLandmarkerResult) {
    const emptyMetrics = {
      hasValidSquatPose: false,
      keyLandmarkVisibility: {
        hips: 0,
        knees: 0,
        ankles: 0,
        shoulders: 0,
      },
      jointAngles: {
        leftKneeAngle: null,
        rightKneeAngle: null,
        leftHipAngle: null,
        rightHipAngle: null,
        averageKneeAngle: null,
      },
      barPosition: {
        shoulderMidpoint: null,
        isValidBarPosition: false,
      },
      balance: {
        lateralDeviation: null,
        isBalanced: false,
      },
      depth: {
        hipKneeRatio: null,
        hasAchievedDepth: false,
        depthPercentage: null,
      },
    };

    if (!result.landmarks || result.landmarks.length === 0) {
      return emptyMetrics;
    }

    const landmarks = result.landmarks[0];
    if (!landmarks || landmarks.length < 33) {
      return emptyMetrics;
    }

    // Calculate key landmark visibilities
    const keyLandmarkVisibility = this.calculateKeyLandmarkVisibility(landmarks);

    // Calculate joint angles
    const jointAngles = this.calculateJointAngles(landmarks);

    // Calculate bar position (shoulder midpoint)
    const barPosition = this.calculateBarPosition(landmarks);

    // Calculate balance metrics
    const balance = this.calculateBalance(landmarks);

    // Calculate depth metrics
    const depth = this.calculateDepth(landmarks);

    // Determine if this is a valid squat pose
    const hasValidSquatPose = this.isValidSquatPose(keyLandmarkVisibility, jointAngles);

    return {
      hasValidSquatPose,
      keyLandmarkVisibility,
      jointAngles,
      barPosition,
      balance,
      depth,
    };
  }

  /**
   * Calculate visibility of key landmarks for squat analysis
   */
  private calculateKeyLandmarkVisibility(landmarks: NormalizedLandmark[]) {
    const getVisibility = (indices: number[]) => {
      const visibilities = indices.map((index) => landmarks[index]?.visibility ?? 0).filter((v) => v > 0);
      return visibilities.length > 0 ? visibilities.reduce((a, b) => a + b, 0) / visibilities.length : 0;
    };

    return {
      hips: getVisibility([SQUAT_LANDMARKS.LEFT_HIP, SQUAT_LANDMARKS.RIGHT_HIP]),
      knees: getVisibility([SQUAT_LANDMARKS.LEFT_KNEE, SQUAT_LANDMARKS.RIGHT_KNEE]),
      ankles: getVisibility([SQUAT_LANDMARKS.LEFT_ANKLE, SQUAT_LANDMARKS.RIGHT_ANKLE]),
      shoulders: getVisibility([SQUAT_LANDMARKS.LEFT_SHOULDER, SQUAT_LANDMARKS.RIGHT_SHOULDER]),
    };
  }

  /**
   * Calculate joint angles for squat analysis
   */
  private calculateJointAngles(landmarks: NormalizedLandmark[]) {
    const calculateAngle = (p1: NormalizedLandmark, p2: NormalizedLandmark, p3: NormalizedLandmark): number => {
      const radians = Math.atan2(p3.y - p2.y, p3.x - p2.x) - Math.atan2(p1.y - p2.y, p1.x - p2.x);
      let angle = Math.abs(radians * (180 / Math.PI));
      if (angle > 180) {
        angle = 360 - angle;
      }
      return angle;
    };

    const leftKneeAngle = this.safeCalculateAngle(
      landmarks[SQUAT_LANDMARKS.LEFT_HIP],
      landmarks[SQUAT_LANDMARKS.LEFT_KNEE],
      landmarks[SQUAT_LANDMARKS.LEFT_ANKLE],
      calculateAngle,
    );

    const rightKneeAngle = this.safeCalculateAngle(
      landmarks[SQUAT_LANDMARKS.RIGHT_HIP],
      landmarks[SQUAT_LANDMARKS.RIGHT_KNEE],
      landmarks[SQUAT_LANDMARKS.RIGHT_ANKLE],
      calculateAngle,
    );

    const leftHipAngle = this.safeCalculateAngle(
      landmarks[SQUAT_LANDMARKS.LEFT_SHOULDER],
      landmarks[SQUAT_LANDMARKS.LEFT_HIP],
      landmarks[SQUAT_LANDMARKS.LEFT_KNEE],
      calculateAngle,
    );

    const rightHipAngle = this.safeCalculateAngle(
      landmarks[SQUAT_LANDMARKS.RIGHT_SHOULDER],
      landmarks[SQUAT_LANDMARKS.RIGHT_HIP],
      landmarks[SQUAT_LANDMARKS.RIGHT_KNEE],
      calculateAngle,
    );

    const averageKneeAngle =
      leftKneeAngle !== null && rightKneeAngle !== null ? (leftKneeAngle + rightKneeAngle) / 2 : null;

    return {
      leftKneeAngle,
      rightKneeAngle,
      leftHipAngle,
      rightHipAngle,
      averageKneeAngle,
    };
  }

  /**
   * Safely calculate angle with null checks
   */
  private safeCalculateAngle(
    p1: NormalizedLandmark | undefined,
    p2: NormalizedLandmark | undefined,
    p3: NormalizedLandmark | undefined,
    calculateFn: (p1: NormalizedLandmark, p2: NormalizedLandmark, p3: NormalizedLandmark) => number,
  ): number | null {
    if (!p1 || !p2 || !p3) return null;
    if ((p1.visibility ?? 0) < 0.5 || (p2.visibility ?? 0) < 0.5 || (p3.visibility ?? 0) < 0.5) return null;
    return calculateFn(p1, p2, p3);
  }

  /**
   * Calculate bar position based on shoulder midpoint
   */
  private calculateBarPosition(landmarks: NormalizedLandmark[]) {
    const leftShoulder = landmarks[SQUAT_LANDMARKS.LEFT_SHOULDER];
    const rightShoulder = landmarks[SQUAT_LANDMARKS.RIGHT_SHOULDER];

    if (!leftShoulder || !rightShoulder) {
      return {
        shoulderMidpoint: null,
        isValidBarPosition: false,
      };
    }

    const shoulderMidpoint = {
      x: (leftShoulder.x + rightShoulder.x) / 2,
      y: (leftShoulder.y + rightShoulder.y) / 2,
      z: (leftShoulder.z + rightShoulder.z) / 2,
    };

    const isValidBarPosition = (leftShoulder.visibility ?? 0) > 0.7 && (rightShoulder.visibility ?? 0) > 0.7;

    return {
      shoulderMidpoint,
      isValidBarPosition,
    };
  }

  /**
   * Calculate lateral balance based on hip and knee alignment
   */
  private calculateBalance(landmarks: NormalizedLandmark[]) {
    const leftHip = landmarks[SQUAT_LANDMARKS.LEFT_HIP];
    const rightHip = landmarks[SQUAT_LANDMARKS.RIGHT_HIP];
    const leftKnee = landmarks[SQUAT_LANDMARKS.LEFT_KNEE];
    const rightKnee = landmarks[SQUAT_LANDMARKS.RIGHT_KNEE];

    if (!leftHip || !rightHip || !leftKnee || !rightKnee) {
      return {
        lateralDeviation: null,
        isBalanced: false,
      };
    }

    // Calculate hip midpoint
    const hipMidpoint = (leftHip.x + rightHip.x) / 2;

    // Calculate knee midpoint
    const kneeMidpoint = (leftKnee.x + rightKnee.x) / 2;

    // Lateral deviation is the difference between hip and knee midpoints
    const lateralDeviation = Math.abs(hipMidpoint - kneeMidpoint);

    // Consider balanced if deviation is less than 5% of hip width
    const hipWidth = Math.abs(leftHip.x - rightHip.x);
    const isBalanced = lateralDeviation < hipWidth * 0.05;

    return {
      lateralDeviation,
      isBalanced,
    };
  }

  /**
   * Calculate depth achievement based on hip-knee relationship
   */
  private calculateDepth(landmarks: NormalizedLandmark[]) {
    const leftHip = landmarks[SQUAT_LANDMARKS.LEFT_HIP];
    const rightHip = landmarks[SQUAT_LANDMARKS.RIGHT_HIP];
    const leftKnee = landmarks[SQUAT_LANDMARKS.LEFT_KNEE];
    const rightKnee = landmarks[SQUAT_LANDMARKS.RIGHT_KNEE];

    if (!leftHip || !rightHip || !leftKnee || !rightKnee) {
      return {
        hipKneeRatio: null,
        hasAchievedDepth: false,
        depthPercentage: null,
      };
    }

    // Calculate average hip and knee heights
    const avgHipY = (leftHip.y + rightHip.y) / 2;
    const avgKneeY = (leftKnee.y + rightKnee.y) / 2;

    // Hip-knee ratio (higher values indicate deeper squat)
    const hipKneeRatio = avgHipY / avgKneeY;

    // Calculate depth percentage (0-100%)
    // Assuming 1.0 ratio is parallel, values > 1.0 indicate below parallel
    const depthPercentage = Math.min(100, Math.max(0, (hipKneeRatio - 0.8) * 500));

    // Consider depth achieved if hips are at or below knee level
    const hasAchievedDepth = hipKneeRatio >= 1.0;

    return {
      hipKneeRatio,
      hasAchievedDepth,
      depthPercentage,
    };
  }

  /**
   * Determine if the current pose is a valid squat pose
   */
  private isValidSquatPose(
    keyLandmarkVisibility: { hips: number; knees: number; ankles: number; shoulders: number },
    jointAngles: { averageKneeAngle: number | null },
  ): boolean {
    // Require good visibility of key landmarks
    const minVisibility = 0.7;
    const hasGoodVisibility =
      keyLandmarkVisibility.hips > minVisibility &&
      keyLandmarkVisibility.knees > minVisibility &&
      keyLandmarkVisibility.ankles > minVisibility;

    // Require reasonable knee angle (squat position)
    const hasValidKneeAngle = jointAngles.averageKneeAngle !== null && jointAngles.averageKneeAngle < 140;

    return hasGoodVisibility && hasValidKneeAngle;
  }

  /**
   * Create empty analysis result
   */
  private createEmptyAnalysis(timestamp: number): SquatPoseAnalysis {
    return {
      landmarks: null,
      timestamp,
      confidence: 0,
      processingTime: 0,
      isValid: false,
      squatMetrics: {
        hasValidSquatPose: false,
        keyLandmarkVisibility: {
          hips: 0,
          knees: 0,
          ankles: 0,
          shoulders: 0,
        },
        jointAngles: {
          leftKneeAngle: null,
          rightKneeAngle: null,
          leftHipAngle: null,
          rightHipAngle: null,
          averageKneeAngle: null,
        },
        barPosition: {
          shoulderMidpoint: null,
          isValidBarPosition: false,
        },
        balance: {
          lateralDeviation: null,
          isBalanced: false,
        },
        depth: {
          hipKneeRatio: null,
          hasAchievedDepth: false,
          depthPercentage: null,
        },
      },
    };
  }

  // Note: updateMetrics method removed - now handled by SquatAnalyzerMetricsAdapter

  /**
   * Get current analysis metrics
   */
  public getMetrics(): SquatAnalysisMetrics {
    return this.metricsAdapter.getMetrics();
  }

  /**
   * Check if the analyzer is initialized and ready
   */
  public isReady(): boolean {
    return this.isInitialized && this.poseLandmarker !== null;
  }

  /**
   * Clean up resources and reset the analyzer
   */
  public cleanup(): void {
    if (this.poseLandmarker) {
      try {
        this.poseLandmarker.close();
      } catch (error) {
        errorMonitor.reportError('Error during squat pose analyzer cleanup', 'custom', 'medium', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    this.poseLandmarker = null;
    this.isInitialized = false;
    this.isInitializing = false;

    // Reset metrics adapter
    this.metricsAdapter.reset();

    errorMonitor.reportError('SquatPoseAnalyzer cleanup completed', 'custom', 'low', {
      finalMetrics: this.metricsAdapter.getMetrics(),
    });
  }

  /**
   * Reset the singleton instance (mainly for testing)
   */
  public static resetInstance(): void {
    if (SquatPoseAnalyzer.instance) {
      SquatPoseAnalyzer.instance.cleanup();
      SquatPoseAnalyzer.instance = null;
    }
  }
}

// Export singleton getter function following established patterns
export const getSquatPoseAnalyzer = (config?: SquatPoseAnalyzerConfig): SquatPoseAnalyzer => {
  return SquatPoseAnalyzer.getInstance(config);
};
