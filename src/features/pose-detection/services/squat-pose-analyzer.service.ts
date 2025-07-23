import type { NormalizedLandmark, PoseLandmarkerResult } from '@mediapipe/tasks-vision';

import type { SquatAnalysisConfig, SquatExerciseConfig } from '@/shared/exercise-config/squat';
import { SQUAT_EXERCISE_CONFIG, validateSquatAnalysisConfig } from '@/shared/exercise-config/squat';
import { errorMonitor } from '@/shared/services/error-monitor.service';
import { performanceMonitor } from '@/shared/services/performance-monitor.service';

import { LandmarkCalculator } from '../utils/landmark-calculator.util';
import { LandmarkValidator } from '../utils/landmark-validator';
import { BasePoseDetector } from './base-pose-detector';
import { PoseValidityStabilizer } from './pose-validity-stabilizer';

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
 * Bar path tracking data point
 */
export interface BarPathPoint {
  position: { x: number; y: number; z: number };
  timestamp: number;
  deviation: number;
}

/**
 * Rep counting state
 */
export type RepPhase = 'standing' | 'descending' | 'bottom' | 'ascending' | 'completed';

/**
 * Rep tracking data
 */
export interface RepData {
  phase: RepPhase;
  startTime: number;
  maxDepth: number;
  maxLateralShift: number;
  barPathDeviation: number;
  isValid: boolean;
}

export interface SquatMetrics {
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
  private validSquatPoses = 0;
  private confidenceScores: number[] = [];
  private readonly maxHistorySize = 30;
  private readonly landmarkValidator = new LandmarkValidator();
  private readonly analysisConfig: SquatAnalysisConfig;
  private readonly poseValidityStabilizer: PoseValidityStabilizer;

  // Lateral shift history tracking
  private lateralShiftHistory: number[] = [];
  private maxLateralShift = 0;

  // Dynamic baseline tracking for depth calculation
  private standingHipY: number | null = null;
  private standingKneeY: number | null = null;
  private calibrationFrames = 0;
  private readonly CALIBRATION_FRAMES_NEEDED = 10;
  private maxShiftDepth: number | null = null;

  // Bar path tracking
  private barPathHistory: BarPathPoint[] = [];
  private maxBarPathDeviation = 0;
  private startingBarPosition: { x: number; y: number; z: number } | null = null;

  // Rep counting state
  private currentRepPhase: RepPhase = 'standing';
  private currentRep: RepData | null = null;
  private completedReps: RepData[] = [];
  private repCount = 0;

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

    // Store analysis configuration
    this.analysisConfig = config.analysis;

    // Initialize pose validity stabilizer with detection config
    this.poseValidityStabilizer = new PoseValidityStabilizer(config);
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

      const emptyAnalysis = this.createEmptyAnalysis(baseResult.timestamp, baseResult.processingTime);
      // Update isValid based on stabilized state
      const stabilizedState = this.poseValidityStabilizer.getState();
      emptyAnalysis.isValid = stabilizedState === 'valid';

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
  private analyzeSquatMetrics(result: PoseLandmarkerResult, timestamp: number): SquatMetrics {
    const emptyMetrics: SquatMetrics = {
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
        shiftHistory: [...this.lateralShiftHistory],
        maxLateralShift: this.maxLateralShift,
        maxShiftDepth: this.maxShiftDepth,
      },
      depth: {
        hipKneeRatio: null,
        hasAchievedDepth: false,
        depthPercentage: null,
      },
      barPath: {
        currentPosition: null,
        history: [],
        verticalDeviation: null,
        maxDeviation: 0,
        startingPosition: null,
      },
      repCounting: {
        currentRep: null,
        repCount: 0,
        phase: 'standing' as RepPhase,
        completedReps: [],
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
      return {
        lateralDeviation: null,
        isBalanced: false,
        shiftHistory: [...this.lateralShiftHistory],
        maxLateralShift: this.maxLateralShift,
        maxShiftDepth: this.maxShiftDepth,
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
        shiftHistory: [...this.lateralShiftHistory],
        maxLateralShift: this.maxLateralShift,
        maxShiftDepth: this.maxShiftDepth,
      };
    }

    const hipWidth = Math.abs(leftHip.x - rightHip.x);
    const isBalanced = lateralDeviation < hipWidth * this.analysisConfig.balance.maxLateralDeviationRatio;

    // Track lateral shift history
    if (lateralDeviation !== null) {
      // Add to history (circular buffer)
      this.lateralShiftHistory.push(lateralDeviation);
      if (this.lateralShiftHistory.length > this.maxHistorySize) {
        this.lateralShiftHistory.shift();
      }

      // Update max shift if current is greater
      if (lateralDeviation > this.maxLateralShift) {
        this.maxLateralShift = lateralDeviation;
        this.maxShiftDepth = currentDepth;
      }
    }

    return {
      lateralDeviation,
      isBalanced,
      shiftHistory: [...this.lateralShiftHistory],
      maxLateralShift: this.maxLateralShift,
      maxShiftDepth: this.maxShiftDepth,
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
      return {
        currentPosition: null,
        history: [...this.barPathHistory],
        verticalDeviation: null,
        maxDeviation: this.maxBarPathDeviation,
        startingPosition: this.startingBarPosition,
      };
    }

    // Set starting position if not already set
    this.startingBarPosition ??= { ...shoulderMidpoint };

    // Calculate vertical deviation from starting position
    const verticalDeviation = Math.abs(shoulderMidpoint.y - this.startingBarPosition.y);

    // Update max deviation
    if (verticalDeviation > this.maxBarPathDeviation) {
      this.maxBarPathDeviation = verticalDeviation;
    }

    // Create new bar path point
    const barPathPoint: BarPathPoint = {
      position: { ...shoulderMidpoint },
      timestamp,
      deviation: verticalDeviation,
    };

    // Add to history (bounded array)
    this.barPathHistory.push(barPathPoint);
    if (this.barPathHistory.length > this.maxHistorySize) {
      this.barPathHistory.shift();
    }

    return {
      currentPosition: shoulderMidpoint,
      history: [...this.barPathHistory],
      verticalDeviation,
      maxDeviation: this.maxBarPathDeviation,
      startingPosition: this.startingBarPosition,
    };
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
    const depthPercentage = depth.depthPercentage ?? 0;

    // State machine transitions
    switch (this.currentRepPhase) {
      case 'standing':
        // Start rep when moving down (depth > startRepThreshold)
        if (depthPercentage > this.analysisConfig.depth.startRepThreshold) {
          this.currentRepPhase = 'descending';
          this.currentRep = {
            phase: 'descending',
            startTime: timestamp,
            maxDepth: depthPercentage,
            maxLateralShift: balance.maxLateralShift,
            barPathDeviation: barPath.maxDeviation,
            isValid: true,
          };
        }
        break;

      case 'descending':
        // Continue descending or reach bottom
        if (this.currentRep) {
          this.currentRep.maxDepth = Math.max(this.currentRep.maxDepth, depthPercentage);
          this.currentRep.maxLateralShift = Math.max(this.currentRep.maxLateralShift, balance.maxLateralShift);
          this.currentRep.barPathDeviation = Math.max(this.currentRep.barPathDeviation, barPath.maxDeviation);
        }

        // Transition to bottom when depth achieved or depth stops increasing
        if (depth.hasAchievedDepth || depthPercentage > this.analysisConfig.depth.bottomPhaseThreshold) {
          this.currentRepPhase = 'bottom';
          if (this.currentRep) {
            this.currentRep.phase = 'bottom';
          }
        }
        break;

      case 'bottom':
        // Update max values while at bottom
        if (this.currentRep) {
          this.currentRep.maxDepth = Math.max(this.currentRep.maxDepth, depthPercentage);
          this.currentRep.maxLateralShift = Math.max(this.currentRep.maxLateralShift, balance.maxLateralShift);
          this.currentRep.barPathDeviation = Math.max(this.currentRep.barPathDeviation, barPath.maxDeviation);
        }

        // Start ascending when depth decreases significantly
        if (depthPercentage < this.analysisConfig.depth.ascendingThreshold) {
          this.currentRepPhase = 'ascending';
          if (this.currentRep) {
            this.currentRep.phase = 'ascending';
          }
        }
        break;

      case 'ascending':
        // Complete rep when returning to standing (depth < completeRepThreshold)
        if (depthPercentage < this.analysisConfig.depth.completeRepThreshold) {
          this.currentRepPhase = 'completed';
          if (this.currentRep) {
            this.currentRep.phase = 'completed';

            // Validate rep quality
            this.currentRep.isValid = this.validateRep(this.currentRep);

            // Add to completed reps and increment counter
            this.completedReps.push(this.currentRep);
            if (this.currentRep.isValid) {
              this.repCount++;
            }
          }
        }
        break;

      case 'completed':
        // Return to standing and reset for next rep
        this.currentRepPhase = 'standing';
        this.currentRep = null;
        // Reset bar path tracking for next rep
        this.resetBarPathTracking();
        break;
    }

    return {
      currentRep: this.currentRep,
      repCount: this.repCount,
      phase: this.currentRepPhase,
      completedReps: [...this.completedReps],
    };
  }

  /**
   * Validate rep quality based on depth and balance thresholds
   */
  private validateRep(rep: RepData): boolean {
    // Rep is valid if:
    // 1. Achieved minimum depth (configured threshold)
    const minDepthThreshold = this.analysisConfig.depth.depthThreshold * 100;
    const achievedDepth = rep.maxDepth >= minDepthThreshold;

    // 2. Maintained reasonable balance (lateral shift within configured limit)
    const reasonableBalance = rep.maxLateralShift < this.analysisConfig.validation.maxLateralShift;

    // 3. Bar path deviation is reasonable (within configured limit)
    const reasonableBarPath = rep.barPathDeviation < this.analysisConfig.validation.maxBarPathDeviation;

    return achievedDepth && reasonableBalance && reasonableBarPath;
  }

  /**
   * Reset bar path tracking for new rep
   */
  private resetBarPathTracking(): void {
    this.barPathHistory = [];
    this.maxBarPathDeviation = 0;
    this.startingBarPosition = null;
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
          shiftHistory: [...this.lateralShiftHistory],
          maxLateralShift: this.maxLateralShift,
          maxShiftDepth: this.maxShiftDepth,
        },
        depth: {
          hipKneeRatio: null,
          hasAchievedDepth: false,
          depthPercentage: null,
          depthThreshold: this.analysisConfig.depth.depthThreshold,
        },
        barPath: {
          currentPosition: null,
          history: [...this.barPathHistory],
          verticalDeviation: null,
          maxDeviation: this.maxBarPathDeviation,
          startingPosition: this.startingBarPosition,
        },
        repCounting: {
          currentRep: this.currentRep,
          repCount: this.repCount,
          phase: this.currentRepPhase,
          completedReps: [...this.completedReps],
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
    this.lateralShiftHistory = [];
    this.maxLateralShift = 0;
    this.maxShiftDepth = null;

    // Reset bar path and rep counting state
    this.barPathHistory = [];
    this.maxBarPathDeviation = 0;
    this.startingBarPosition = null;
    this.currentRepPhase = 'standing';
    this.currentRep = null;
    this.completedReps = [];
    this.repCount = 0;

    // Reset pose validity stabilizer
    this.resetPoseValidityStabilizer();

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

  /**
   * Reset lateral shift history (for new rep or testing)
   */
  public resetShiftHistory(): void {
    this.lateralShiftHistory = [];
    this.maxLateralShift = 0;
    this.maxShiftDepth = null;
  }

  /**
   * Get current rep counting data for testing
   */
  public getRepCountingData() {
    return {
      currentRep: this.currentRep,
      repCount: this.repCount,
      phase: this.currentRepPhase,
      completedReps: [...this.completedReps],
    };
  }

  /**
   * Get bar path history for testing
   */
  public getBarPathHistory(): BarPathPoint[] {
    return [...this.barPathHistory];
  }

  /**
   * Reset rep counting state (for new session or testing)
   */
  public resetRepCounting(): void {
    this.currentRepPhase = 'standing';
    this.currentRep = null;
    this.completedReps = [];
    this.repCount = 0;
    this.resetBarPathTracking();

    // Reset dynamic baseline calibration
    this.standingHipY = null;
    this.standingKneeY = null;
    this.calibrationFrames = 0;
  }

  /**
   * Reset pose validity stabilizer (for testing or session reset)
   */
  private resetPoseValidityStabilizer(): void {
    // Use a type assertion to bypass readonly restriction for reset
    // This is safe as it's only used for cleanup/reset scenarios
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
    (this as any).poseValidityStabilizer = new PoseValidityStabilizer();
  }
}

// Export singleton getter function following established patterns
export const getSquatPoseAnalyzer = (config?: SquatExerciseConfig): SquatPoseAnalyzer => {
  return SquatPoseAnalyzer.getInstance(config);
};
