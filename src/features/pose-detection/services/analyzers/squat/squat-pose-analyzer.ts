import type { NormalizedLandmark, PoseLandmarkerResult } from '@mediapipe/tasks-vision';

import type { SquatAnalysisConfig, SquatExerciseConfig } from '@/shared/exercise-config/squat';
import { SQUAT_EXERCISE_CONFIG, validateSquatAnalysisConfig } from '@/shared/exercise-config/squat';
import { errorMonitor } from '@/shared/services/error-monitor.service';
import { performanceMonitor } from '@/shared/services/performance-monitor.service';

import { LandmarkCalculator } from '../../../utils/landmark-calculator.util';
import { LandmarkValidator } from '../../../utils/landmark-validator';
import { BasePoseDetector } from '../../core/base-pose-detector';
import type { DetectionState } from '../../core/types';
import { PoseValidityStabilizer } from '../../stabilizers/pose-validity-stabilizer';
import type { LandmarkGroupVisibility } from '../../stabilizers/visibility-stabilizer';
import { VisibilityStabilizer } from '../../stabilizers/visibility-stabilizer';
import type { BarPathPoint } from './squat-metrics-tracker';
import { MetricsTracker } from './squat-metrics-tracker';
import type { RepCountingMetrics, RepData, RepPhase } from './squat-rep-counter';
import { RepCounter } from './squat-rep-counter';

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

// Re-export types from the extracted classes
export type { BarPathPoint } from './squat-metrics-tracker';
export type { RepData, RepPhase } from './squat-rep-counter';

export interface SquatMetrics {
  hasValidSquatPose: boolean;
  keyLandmarkVisibility: {
    hips: number;
    knees: number;
    ankles: number;
    shoulders: number;
  };
  stabilizedVisibility?: LandmarkGroupVisibility;
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
    shiftHistory: number[];
    maxLateralShift: number;
    maxShiftDepth: number | null;
  };
  depth: {
    hipKneeRatio: number | null;
    hasAchievedDepth: boolean;
    depthPercentage: number | null;
    depthThreshold?: number;
  };
  barPath: {
    currentPosition: { x: number; y: number; z: number } | null;
    history: BarPathPoint[];
    verticalDeviation: number | null;
    maxDeviation: number;
    startingPosition: { x: number; y: number; z: number } | null;
  };
  repCounting: {
    currentRep: RepData | null;
    repCount: number;
    phase: RepPhase;
    completedReps: RepData[];
  };
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
  detectionState: DetectionState;
  squatMetrics: SquatMetrics;
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
  private confidenceScores: number[] = [];
  private readonly maxHistorySize = 30;
  private readonly landmarkValidator = new LandmarkValidator();
  private readonly analysisConfig: SquatAnalysisConfig;
  private readonly exerciseConfig: SquatExerciseConfig;
  private poseValidityStabilizer: PoseValidityStabilizer;
  private readonly visibilityStabilizer: VisibilityStabilizer;

  // Noise floor threshold to filter out spurious low-confidence detections
  // MediaPipe may report very low visibility values (0.01-0.1) for landmarks
  // that aren't actually present, causing UI flickering
  private readonly NOISE_FLOOR_THRESHOLD = 0.1;

  // Metrics tracking
  private readonly metricsTracker: MetricsTracker;
  private readonly repCounter: RepCounter;

  // Dynamic baseline tracking for depth calculation
  private standingHipY: number | null = null;
  private standingKneeY: number | null = null;
  private calibrationFrames = 0;
  private readonly CALIBRATION_FRAMES_NEEDED = 10;

  constructor(config: SquatExerciseConfig = SQUAT_EXERCISE_CONFIG) {
    // Validate the analysis configuration
    const validation = validateSquatAnalysisConfig(config.analysis);
    if (!validation.isValid) {
      throw new Error(`Invalid squat analysis configuration: ${validation.errors.join(', ')}`);
    }

    // Log warnings if any
    if (validation.warnings.length > 0) {
      // eslint-disable-next-line no-console
      console.warn('SquatPoseAnalyzer configuration warnings:', validation.warnings.join(', '));
    }

    // Call parent constructor with MediaPipe configuration from exercise config
    super({
      ...config,
      minPoseDetectionConfidence: config.analysis.mediaPipe.minPoseDetectionConfidence,
      minPosePresenceConfidence: config.analysis.mediaPipe.minPosePresenceConfidence,
      minTrackingConfidence: config.analysis.mediaPipe.minTrackingConfidence,
    });

    // Store both the full exercise config and analysis config
    this.exerciseConfig = config;
    this.analysisConfig = config.analysis;

    // Initialize pose validity stabilizer with detection config
    this.poseValidityStabilizer = new PoseValidityStabilizer(config);

    // Initialize visibility stabilizer with its own thresholds
    // Using default values (enter at 0.7, exit at 0.5, 200ms debounce)
    // These are specifically for landmark visibility, not pose validity
    this.visibilityStabilizer = new VisibilityStabilizer();

    // Initialize metrics tracker and rep counter
    this.metricsTracker = new MetricsTracker(this.maxHistorySize);
    this.repCounter = new RepCounter(this.analysisConfig);
  }

  /**
   * Get the singleton instance of SquatPoseAnalyzer
   */
  public static getInstance(config?: SquatExerciseConfig): SquatPoseAnalyzer {
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
      // Update stabilizer with zero confidence for failed detection
      this.poseValidityStabilizer.update(0, baseResult.timestamp);

      // Update visibility stabilizer with zero values for all landmarks
      const zeroVisibility = {
        hips: 0,
        knees: 0,
        ankles: 0,
        shoulders: 0,
      };
      const stabilizedVisibility = this.visibilityStabilizer.update(zeroVisibility, baseResult.timestamp);

      const stabilizedState = this.poseValidityStabilizer.getState();
      const emptyAnalysis = this.createEmptyAnalysis(baseResult.timestamp, baseResult.processingTime);
      emptyAnalysis.isValid = stabilizedState === 'valid';
      emptyAnalysis.detectionState = stabilizedState;
      emptyAnalysis.squatMetrics.stabilizedVisibility = stabilizedVisibility;

      return emptyAnalysis;
    }

    const startAnalysisTime = performance.now();

    // Analyze squat-specific metrics
    const squatMetrics = this.analyzeSquatMetrics(baseResult.landmarks, baseResult.timestamp);

    // Update pose validity stabilizer with combined confidence
    const combinedConfidence = baseResult.confidence * (squatMetrics.hasValidSquatPose ? 1.0 : 0.0);
    this.poseValidityStabilizer.update(combinedConfidence, baseResult.timestamp);

    // Use stabilized validity instead of direct checks
    const stabilizedState = this.poseValidityStabilizer.getState();
    const isValid = stabilizedState === 'valid';

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
      detectionState: stabilizedState,
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
    let anyLandmarkAboveThreshold = false;

    for (const { index, weight } of keyLandmarks) {
      const landmark = landmarks[index];
      if (landmark?.visibility !== undefined) {
        // Apply noise floor threshold - treat very low visibility as 0
        const visibility = landmark.visibility < this.NOISE_FLOOR_THRESHOLD ? 0 : landmark.visibility;

        if (visibility > 0) {
          anyLandmarkAboveThreshold = true;
          totalWeight += weight;
          weightedVisibility += visibility * weight;
        }
      }
    }

    // If no landmarks are above the noise threshold, return 0
    if (!anyLandmarkAboveThreshold) {
      return 0;
    }

    return totalWeight > 0 ? weightedVisibility / totalWeight : 0;
  }

  /**
   * Analyze squat-specific metrics from pose landmarks
   */
  private analyzeSquatMetrics(result: PoseLandmarkerResult, timestamp: number): SquatMetrics {
    if (!result.landmarks || result.landmarks.length === 0) {
      return this.createEmptySquatMetrics();
    }

    const landmarks = result.landmarks[0];
    if (!landmarks || landmarks.length < 33) {
      return this.createEmptySquatMetrics();
    }

    // Calculate key landmark visibilities
    const keyLandmarkVisibility = this.calculateKeyLandmarkVisibility(landmarks);

    // Get stabilized visibility values
    const stabilizedVisibility = this.visibilityStabilizer.update(keyLandmarkVisibility, timestamp);

    // Calculate joint angles
    const jointAngles = this.calculateJointAngles(landmarks);

    // Calculate bar position (shoulder midpoint)
    const barPosition = this.calculateBarPosition(landmarks);

    // Calculate depth metrics first (needed for balance tracking)
    const depth = this.calculateDepth(landmarks);

    // Calculate balance metrics
    const balance = this.calculateBalance(landmarks, depth.depthPercentage);

    // Calculate bar path metrics
    const barPath = this.calculateBarPath(barPosition.shoulderMidpoint, timestamp);

    // Update rep counting state
    const repCounting = this.updateRepCounting(depth, balance, barPath, timestamp);

    // Determine if this is a valid squat pose
    const hasValidSquatPose = this.isValidSquatPose(keyLandmarkVisibility, jointAngles);

    return {
      hasValidSquatPose,
      keyLandmarkVisibility,
      stabilizedVisibility,
      jointAngles,
      barPosition,
      balance,
      depth,
      barPath,
      repCounting,
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

      // Apply noise floor threshold - return 0 if average visibility is below threshold
      return result.averageVisibility < this.NOISE_FLOOR_THRESHOLD ? 0 : result.averageVisibility;
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
    const isValidBarPosition =
      (leftShoulder?.visibility ?? 0) > this.analysisConfig.visibility.barPositionVisibility &&
      (rightShoulder?.visibility ?? 0) > this.analysisConfig.visibility.barPositionVisibility;

    return {
      shoulderMidpoint,
      isValidBarPosition,
    };
  }

  /**
   * Calculate lateral balance based on hip and knee alignment
   */
  private calculateBalance(landmarks: NormalizedLandmark[], currentDepth: number | null) {
    // Use LandmarkCalculator to get midpoints
    const hipMidpoint = LandmarkCalculator.calculateHipMidpoint(landmarks, SQUAT_LANDMARKS);
    const kneeMidpoint = LandmarkCalculator.calculateMidpoint(
      landmarks[SQUAT_LANDMARKS.LEFT_KNEE],
      landmarks[SQUAT_LANDMARKS.RIGHT_KNEE],
    );

    if (!hipMidpoint || !kneeMidpoint) {
      const lateralMetrics = this.metricsTracker.getLateralShiftMetrics();
      return {
        lateralDeviation: null,
        isBalanced: false,
        shiftHistory: lateralMetrics.shiftHistory,
        maxLateralShift: lateralMetrics.maxLateralShift,
        maxShiftDepth: lateralMetrics.maxShiftDepth,
      };
    }

    // Lateral deviation is the difference between hip and knee midpoints
    const lateralDeviation = Math.abs(hipMidpoint.x - kneeMidpoint.x);

    // Calculate hip width for balance threshold
    const leftHip = landmarks[SQUAT_LANDMARKS.LEFT_HIP];
    const rightHip = landmarks[SQUAT_LANDMARKS.RIGHT_HIP];

    if (!leftHip || !rightHip) {
      const lateralMetrics = this.metricsTracker.getLateralShiftMetrics();
      return {
        lateralDeviation,
        isBalanced: false,
        shiftHistory: lateralMetrics.shiftHistory,
        maxLateralShift: lateralMetrics.maxLateralShift,
        maxShiftDepth: lateralMetrics.maxShiftDepth,
      };
    }

    const hipWidth = Math.abs(leftHip.x - rightHip.x);
    const isBalanced = lateralDeviation < hipWidth * this.analysisConfig.balance.maxLateralDeviationRatio;

    // Track lateral shift history
    if (lateralDeviation !== null) {
      this.metricsTracker.updateLateralShift(lateralDeviation, currentDepth);
    }

    const lateralMetrics = this.metricsTracker.getLateralShiftMetrics();
    return {
      lateralDeviation,
      isBalanced,
      shiftHistory: lateralMetrics.shiftHistory,
      maxLateralShift: lateralMetrics.maxLateralShift,
      maxShiftDepth: lateralMetrics.maxShiftDepth,
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
        depthThreshold: this.analysisConfig.depth.depthThreshold,
      };
    }

    // Hip-knee ratio (higher values indicate deeper squat)
    const hipKneeRatio = hipMidpoint.y / kneeMidpoint.y;

    // Dynamic baseline calibration
    // If we haven't calibrated yet, track standing position
    if (
      this.standingHipY === null ||
      this.standingKneeY === null ||
      this.calibrationFrames < this.CALIBRATION_FRAMES_NEEDED
    ) {
      // Look for standing position (hips above knees with reasonable ratio)
      if (hipKneeRatio < this.analysisConfig.balance.standingPositionRatio) {
        // Standing position typically has hip/knee ratio < 0.8
        if (this.standingHipY === null || this.standingKneeY === null) {
          this.standingHipY = hipMidpoint.y;
          this.standingKneeY = kneeMidpoint.y;
        } else {
          // Average over calibration frames for stability
          this.standingHipY =
            (this.standingHipY * this.calibrationFrames + hipMidpoint.y) / (this.calibrationFrames + 1);
          this.standingKneeY =
            (this.standingKneeY * this.calibrationFrames + kneeMidpoint.y) / (this.calibrationFrames + 1);
        }
        this.calibrationFrames++;
      }
    }

    // Use dynamic baseline if available, otherwise use reasonable defaults
    const standingHipY = this.standingHipY ?? 0.5;
    const standingKneeY = this.standingKneeY ?? 0.7;

    // Calculate the range from standing to parallel
    const totalRange = standingKneeY - standingHipY;

    // Calculate how far the hip has moved from standing position
    const hipMovement = hipMidpoint.y - standingHipY;

    // Calculate percentage (0-100+%)
    let depthPercentage = 0;
    if (totalRange > 0) {
      depthPercentage = (hipMovement / totalRange) * 100;
    }

    // Ensure non-negative values
    depthPercentage = Math.max(0, depthPercentage);

    // Check if depth threshold is achieved
    // Use a small epsilon for floating-point comparison
    const hasAchievedDepth = depthPercentage >= this.analysisConfig.depth.depthThreshold * 100 - 0.01;

    return {
      hipKneeRatio,
      hasAchievedDepth,
      depthPercentage,
      depthThreshold: this.analysisConfig.depth.depthThreshold,
    };
  }

  /**
   * Calculate bar path tracking metrics
   */
  private calculateBarPath(shoulderMidpoint: { x: number; y: number; z: number } | null, timestamp: number) {
    if (!shoulderMidpoint) {
      const barPathMetrics = this.metricsTracker.getBarPathMetrics();
      return {
        currentPosition: null,
        history: barPathMetrics.history,
        verticalDeviation: null,
        maxDeviation: barPathMetrics.maxDeviation,
        startingPosition: barPathMetrics.startingPosition,
      };
    }

    return this.metricsTracker.updateBarPath(shoulderMidpoint, timestamp);
  }

  /**
   * Update rep counting state machine
   */
  private updateRepCounting(
    depth: { depthPercentage: number | null; hasAchievedDepth: boolean },
    balance: { lateralDeviation: number | null; maxLateralShift: number },
    barPath: { verticalDeviation: number | null; maxDeviation: number },
    timestamp: number,
  ) {
    const metrics: RepCountingMetrics = {
      depthPercentage: depth.depthPercentage ?? 0,
      hasAchievedDepth: depth.hasAchievedDepth,
      lateralShift: balance.maxLateralShift,
      barPathDeviation: barPath.maxDeviation,
    };

    const result = this.repCounter.update(metrics, timestamp);

    // Check if we completed a rep to reset bar path tracking
    if (this.repCounter.getCurrentPhase() === 'standing' && result.phase === 'standing') {
      this.metricsTracker.resetBarPath();
    }

    return result;
  }

  /**
   * Determine if the current pose is a valid squat pose
   */
  private isValidSquatPose(
    keyLandmarkVisibility: { hips: number; knees: number; ankles: number; shoulders: number },
    jointAngles: { averageKneeAngle: number | null },
  ): boolean {
    // Require good visibility of key landmarks
    const minVisibility = this.analysisConfig.visibility.minLandmarkVisibility;
    const hasGoodVisibility =
      keyLandmarkVisibility.hips > minVisibility &&
      keyLandmarkVisibility.knees > minVisibility &&
      keyLandmarkVisibility.ankles > minVisibility;

    // Require reasonable knee angle (squat position)
    const hasValidKneeAngle =
      jointAngles.averageKneeAngle !== null &&
      jointAngles.averageKneeAngle < this.analysisConfig.validation.maxValidKneeAngle;

    return hasGoodVisibility && hasValidKneeAngle;
  }

  /**
   * Create empty squat metrics
   */
  private createEmptySquatMetrics(): SquatMetrics {
    const lateralMetrics = this.metricsTracker.getLateralShiftMetrics();
    const barPathMetrics = this.metricsTracker.getBarPathMetrics();
    const repCountingState = this.repCounter.getState();

    return {
      hasValidSquatPose: false,
      keyLandmarkVisibility: {
        hips: 0,
        knees: 0,
        ankles: 0,
        shoulders: 0,
      },
      // stabilizedVisibility will be set by caller to ensure consistency
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
        shiftHistory: lateralMetrics.shiftHistory,
        maxLateralShift: lateralMetrics.maxLateralShift,
        maxShiftDepth: lateralMetrics.maxShiftDepth,
      },
      depth: {
        hipKneeRatio: null,
        hasAchievedDepth: false,
        depthPercentage: null,
        depthThreshold: this.analysisConfig.depth.depthThreshold,
      },
      barPath: {
        currentPosition: null,
        history: barPathMetrics.history,
        verticalDeviation: null,
        maxDeviation: barPathMetrics.maxDeviation,
        startingPosition: barPathMetrics.startingPosition,
      },
      repCounting: repCountingState,
    };
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
      detectionState: 'invalid',
      squatMetrics: this.createEmptySquatMetrics(),
    };
  }

  /**
   * Clean up resources and reset the analyzer
   * Overrides base class to handle squat-specific metrics
   */
  public cleanup(): void {
    // Reset squat-specific metrics
    this.confidenceScores = [];

    // Reset metrics tracker and rep counter
    this.metricsTracker.reset();
    this.repCounter.reset();

    // Reset calibration
    this.resetCalibration();

    // Reset both stabilizers
    this.resetPoseValidityStabilizer();
    this.resetVisibilityStabilizer();

    // Call parent cleanup
    super.cleanup();

    errorMonitor.reportError('SquatPoseAnalyzer cleanup completed', 'custom', 'low', {});
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
   * Reset lateral shift history (for new rep or testing)
   */
  public resetShiftHistory(): void {
    this.metricsTracker.resetLateralShift();
  }

  /**
   * Reset visibility stabilizer state
   */
  public resetVisibilityStabilizer(): void {
    this.visibilityStabilizer.reset();
  }

  /**
   * Reset rep counting state (for new session or testing)
   */
  public resetRepCounting(): void {
    this.repCounter.reset();
    this.metricsTracker.resetBarPath();
    this.resetCalibration();
  }

  /**
   * Reset calibration state
   */
  private resetCalibration(): void {
    this.standingHipY = null;
    this.standingKneeY = null;
    this.calibrationFrames = 0;
  }

  /**
   * Reset pose validity stabilizer (for testing or session reset)
   */
  private resetPoseValidityStabilizer(): void {
    this.poseValidityStabilizer = new PoseValidityStabilizer(this.exerciseConfig);
  }
}

// Export singleton getter function following established patterns
export const getSquatPoseAnalyzer = (config?: SquatExerciseConfig): SquatPoseAnalyzer => {
  return SquatPoseAnalyzer.getInstance(config);
};
