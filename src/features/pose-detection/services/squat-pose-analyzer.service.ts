import type { NormalizedLandmark, PoseLandmarkerResult } from '@mediapipe/tasks-vision';

import { errorMonitor } from '@/shared/services/error-monitor.service';
import { performanceMonitor } from '@/shared/services/performance-monitor.service';

import { LandmarkCalculator } from '../utils/landmark-calculator.util';
import { LandmarkValidator } from '../utils/landmark-validator';
import type { PoseDetectorConfig } from './base-pose-detector';
import { BasePoseDetector } from './base-pose-detector';

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
 * Extends the base configuration with squat-specific defaults
 */
type SquatPoseAnalyzerConfig = PoseDetectorConfig;

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
 * SquatPoseAnalyzer - Specialized MediaPipe Pose service for squat form analysis
 *
 * Extends BasePoseDetector with squat-specific functionality:
 * - Bar path tracking via shoulder midpoint
 * - Depth achievement detection via hip-knee angles
 * - Joint angle measurements for form analysis
 * - Lateral imbalance detection
 * - Tempo tracking preparation
 */
export class SquatPoseAnalyzer extends BasePoseDetector {
  private static instance: SquatPoseAnalyzer | null = null;
  private validSquatPoses = 0;
  private confidenceScores: number[] = [];
  private readonly maxHistorySize = 30;
  private readonly landmarkValidator = new LandmarkValidator();

  constructor(config: SquatPoseAnalyzerConfig = {}) {
    // Call parent constructor with squat-specific defaults
    super({
      ...config,
      minPoseDetectionConfidence: config.minPoseDetectionConfidence ?? 0.7, // Higher for squat analysis
      minPosePresenceConfidence: config.minPosePresenceConfidence ?? 0.7,
      minTrackingConfidence: config.minTrackingConfidence ?? 0.7,
    });
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
   * Overrides base class to add squat-specific initialization logging
   */
  public async initialize(): Promise<void> {
    errorMonitor.reportError('Starting SquatPoseAnalyzer initialization', 'custom', 'low', {
      config: this.config,
    });

    // Call parent initialization
    await super.initialize();

    errorMonitor.reportError('SquatPoseAnalyzer initialized successfully', 'custom', 'low', {
      delegate: this.config.delegate,
      modelPath: this.config.modelAssetPath,
    });
  }

  /**
   * Analyze squat pose in a video frame with specialized squat metrics
   */
  public analyzeSquatPose(videoElement: HTMLVideoElement): SquatPoseAnalysis {
    // Use base class detection with additional squat analysis
    const baseResult = this.detectPose(videoElement);

    // If the base detection was throttled or failed, return empty squat analysis
    if (!baseResult.landmarks) {
      return this.createEmptyAnalysis(baseResult.timestamp, baseResult.processingTime);
    }

    const startAnalysisTime = performance.now();

    // Analyze squat-specific metrics
    const squatMetrics = this.analyzeSquatMetrics(baseResult.landmarks);
    const isValid = baseResult.confidence > 0.5 && squatMetrics.hasValidSquatPose;

    // Track squat-specific metrics
    if (isValid) {
      this.validSquatPoses++;
    }

    // Track confidence scores for squat analysis
    this.confidenceScores.push(baseResult.confidence);
    if (this.confidenceScores.length > this.maxHistorySize) {
      this.confidenceScores.shift();
    }

    const totalProcessingTime = baseResult.processingTime + (performance.now() - startAnalysisTime);

    // Record squat-specific metrics
    performanceMonitor.recordOperation({
      name: 'squatAnalysis',
      processingTime: totalProcessingTime,
      timestamp: baseResult.timestamp,
      success: isValid,
    });

    return {
      landmarks: baseResult.landmarks,
      timestamp: baseResult.timestamp,
      confidence: baseResult.confidence,
      processingTime: totalProcessingTime,
      isValid,
      squatMetrics,
    };
  }

  /**
   * Calculate confidence score based on squat-specific landmarks
   * Overrides base class to focus on lower body landmarks
   */
  protected calculateConfidence(result: PoseLandmarkerResult): number {
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
    // Use LandmarkValidator to get average visibility for each group
    const hipIndices = [SQUAT_LANDMARKS.LEFT_HIP, SQUAT_LANDMARKS.RIGHT_HIP];
    const kneeIndices = [SQUAT_LANDMARKS.LEFT_KNEE, SQUAT_LANDMARKS.RIGHT_KNEE];
    const ankleIndices = [SQUAT_LANDMARKS.LEFT_ANKLE, SQUAT_LANDMARKS.RIGHT_ANKLE];
    const shoulderIndices = [SQUAT_LANDMARKS.LEFT_SHOULDER, SQUAT_LANDMARKS.RIGHT_SHOULDER];

    const getGroupVisibility = (indices: number[]) => {
      const groupLandmarks = indices.map((i) => landmarks[i]).filter((l) => l !== undefined);
      if (groupLandmarks.length === 0) return 0;
      const result = this.landmarkValidator.validateVisibility(groupLandmarks, 0);
      return result.averageVisibility;
    };

    return {
      hips: getGroupVisibility(hipIndices),
      knees: getGroupVisibility(kneeIndices),
      ankles: getGroupVisibility(ankleIndices),
      shoulders: getGroupVisibility(shoulderIndices),
    };
  }

  /**
   * Calculate joint angles for squat analysis
   */
  private calculateJointAngles(landmarks: NormalizedLandmark[]) {
    // Use LandmarkCalculator for angle calculations
    const leftKneeAngle = LandmarkCalculator.calculateKneeAngle(landmarks, SQUAT_LANDMARKS, 'LEFT');
    const rightKneeAngle = LandmarkCalculator.calculateKneeAngle(landmarks, SQUAT_LANDMARKS, 'RIGHT');
    const leftHipAngle = LandmarkCalculator.calculateHipAngle(landmarks, SQUAT_LANDMARKS, 'LEFT');
    const rightHipAngle = LandmarkCalculator.calculateHipAngle(landmarks, SQUAT_LANDMARKS, 'RIGHT');

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
   * Calculate bar position based on shoulder midpoint
   */
  private calculateBarPosition(landmarks: NormalizedLandmark[]) {
    // Use LandmarkCalculator to get shoulder midpoint
    const shoulderMidpoint = LandmarkCalculator.calculateShoulderMidpoint(landmarks, SQUAT_LANDMARKS);

    if (!shoulderMidpoint) {
      return {
        shoulderMidpoint: null,
        isValidBarPosition: false,
      };
    }

    // Check if both shoulders have good visibility for valid bar position
    const leftShoulder = landmarks[SQUAT_LANDMARKS.LEFT_SHOULDER];
    const rightShoulder = landmarks[SQUAT_LANDMARKS.RIGHT_SHOULDER];
    const isValidBarPosition = (leftShoulder?.visibility ?? 0) > 0.7 && (rightShoulder?.visibility ?? 0) > 0.7;

    return {
      shoulderMidpoint,
      isValidBarPosition,
    };
  }

  /**
   * Calculate lateral balance based on hip and knee alignment
   */
  private calculateBalance(landmarks: NormalizedLandmark[]) {
    // Use LandmarkCalculator to get midpoints
    const hipMidpoint = LandmarkCalculator.calculateHipMidpoint(landmarks, SQUAT_LANDMARKS);
    const kneeMidpoint = LandmarkCalculator.calculateMidpoint(
      landmarks[SQUAT_LANDMARKS.LEFT_KNEE],
      landmarks[SQUAT_LANDMARKS.RIGHT_KNEE],
    );

    if (!hipMidpoint || !kneeMidpoint) {
      return {
        lateralDeviation: null,
        isBalanced: false,
      };
    }

    // Lateral deviation is the difference between hip and knee midpoints
    const lateralDeviation = Math.abs(hipMidpoint.x - kneeMidpoint.x);

    // Calculate hip width for balance threshold
    const leftHip = landmarks[SQUAT_LANDMARKS.LEFT_HIP];
    const rightHip = landmarks[SQUAT_LANDMARKS.RIGHT_HIP];

    if (!leftHip || !rightHip) {
      return {
        lateralDeviation,
        isBalanced: false,
      };
    }

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
    // Use LandmarkCalculator to get midpoints
    const hipMidpoint = LandmarkCalculator.calculateHipMidpoint(landmarks, SQUAT_LANDMARKS);
    const kneeMidpoint = LandmarkCalculator.calculateMidpoint(
      landmarks[SQUAT_LANDMARKS.LEFT_KNEE],
      landmarks[SQUAT_LANDMARKS.RIGHT_KNEE],
    );

    if (!hipMidpoint || !kneeMidpoint) {
      return {
        hipKneeRatio: null,
        hasAchievedDepth: false,
        depthPercentage: null,
      };
    }

    // Hip-knee ratio (higher values indicate deeper squat)
    const hipKneeRatio = hipMidpoint.y / kneeMidpoint.y;

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
  private createEmptyAnalysis(timestamp: number, processingTime = 0): SquatPoseAnalysis {
    return {
      landmarks: null,
      timestamp,
      confidence: 0,
      processingTime,
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

  /**
   * Clean up resources and reset the analyzer
   * Overrides base class to handle squat-specific metrics
   */
  public cleanup(): void {
    // Calculate squat-specific final metrics before cleanup
    const averageConfidence =
      this.confidenceScores.length > 0
        ? this.confidenceScores.reduce((a, b) => a + b, 0) / this.confidenceScores.length
        : 0;

    const finalMetrics = {
      totalFrames: this.totalFrames,
      validSquatPoses: this.validSquatPoses,
      successRate: this.totalFrames > 0 ? this.validSquatPoses / this.totalFrames : 0,
      averageConfidence,
    };

    // Reset squat-specific metrics
    this.validSquatPoses = 0;
    this.confidenceScores = [];

    // Call parent cleanup
    super.cleanup();

    errorMonitor.reportError('SquatPoseAnalyzer cleanup completed', 'custom', 'low', {
      finalMetrics,
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

  /**
   * Get confidence scores array for testing
   */
  public getConfidenceScores(): number[] {
    return [...this.confidenceScores];
  }

  /**
   * Get valid squat poses count for testing
   */
  public getValidSquatPoses(): number {
    return this.validSquatPoses;
  }

  /**
   * Get total frames processed count for testing
   */
  public getTotalFrames(): number {
    return this.totalFrames;
  }
}

// Export singleton getter function following established patterns
export const getSquatPoseAnalyzer = (config?: SquatPoseAnalyzerConfig): SquatPoseAnalyzer => {
  return SquatPoseAnalyzer.getInstance(config);
};
