import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

/**
 * Result of landmark visibility validation
 */
export interface ValidationResult {
  /** Whether all landmarks meet the visibility threshold */
  isValid: boolean;
  /** Number of landmarks that meet the visibility threshold */
  visibleCount: number;
  /** Total number of landmarks checked */
  totalCount: number;
  /** Indices of landmarks that don't meet the threshold */
  invalidIndices: number[];
  /** Average visibility across all landmarks */
  averageVisibility: number;
  /** Minimum visibility value found */
  minVisibility: number;
  /** Percentage of landmarks that are visible (0-100) */
  visibilityPercentage: number;
}

/**
 * Result of pose completeness validation
 */
export interface CompletenessResult {
  /** Whether all required landmarks are present */
  isComplete: boolean;
  /** Number of required landmarks present */
  presentCount: number;
  /** Total number of required landmarks */
  requiredCount: number;
  /** Indices of missing required landmarks */
  missingIndices: number[];
  /** Completeness percentage (0-100) */
  completenessPercentage: number;
}

/**
 * Quality metrics for pose assessment
 */
export interface QualityMetrics {
  /** Overall quality score (0-1) */
  overallScore: number;
  /** Average confidence across landmarks */
  averageConfidence: number;
  /** Bilateral symmetry score (0-1) */
  symmetryScore: number;
  /** Temporal stability score (0-1) */
  stabilityScore: number;
  /** Whether quality meets minimum threshold */
  meetsQualityThreshold: boolean;
}

/**
 * Configuration for quality assessment
 */
export interface QualityConfig {
  /** Minimum confidence threshold */
  minConfidence?: number;
  /** Whether to check bilateral symmetry */
  checkSymmetry?: boolean;
  /** Whether to check temporal stability */
  checkStability?: boolean;
  /** Previous frame landmarks for stability check */
  previousLandmarks?: NormalizedLandmark[];
}

/**
 * Result of overall pose validation
 */
export interface PoseValidationResult {
  /** Whether the pose is valid for the exercise */
  isValid: boolean;
  /** Visibility validation result */
  visibility: ValidationResult;
  /** Completeness validation result */
  completeness: CompletenessResult;
  /** Quality assessment metrics */
  quality: QualityMetrics;
  /** Exercise-specific validation passed */
  exerciseSpecificValid: boolean;
  /** Detailed validation messages */
  messages: string[];
}

/**
 * Exercise types supported by the validator
 */
export type ExerciseType = 'squat' | 'bench' | 'deadlift' | 'generic';

/**
 * Landmark validator for pose detection
 * Handles validation of landmark visibility, completeness, and quality
 */
export class LandmarkValidator {
  /**
   * Validate landmark visibility against a threshold
   * @param landmarks Array of landmarks to validate
   * @param threshold Minimum visibility threshold (default: 0.5)
   * @returns Validation result with detailed metrics
   */
  validateVisibility(landmarks: NormalizedLandmark[], threshold = 0.5): ValidationResult {
    const totalCount = landmarks.length;
    const invalidIndices: number[] = [];
    let visibleCount = 0;
    let visibilitySum = 0;
    let minVisibility = 1;

    // Handle empty array case
    if (totalCount === 0) {
      return {
        isValid: false,
        visibleCount: 0,
        totalCount: 0,
        invalidIndices: [],
        averageVisibility: 0,
        minVisibility: 0,
        visibilityPercentage: 0,
      };
    }

    // Process each landmark
    for (let i = 0; i < totalCount; i++) {
      const landmark = landmarks[i];

      // Handle null/undefined landmarks
      if (landmark?.visibility === undefined) {
        invalidIndices.push(i);
        continue;
      }

      const visibility = landmark.visibility;
      visibilitySum += visibility;
      minVisibility = Math.min(minVisibility, visibility);

      if (visibility >= threshold) {
        visibleCount++;
      } else {
        invalidIndices.push(i);
      }
    }

    const averageVisibility = totalCount > 0 ? visibilitySum / totalCount : 0;
    const visibilityPercentage = totalCount > 0 ? (visibleCount / totalCount) * 100 : 0;

    return {
      isValid: invalidIndices.length === 0,
      visibleCount,
      totalCount,
      invalidIndices,
      averageVisibility,
      minVisibility: minVisibility === 1 ? 0 : minVisibility, // Handle case where no valid landmarks
      visibilityPercentage,
    };
  }

  /**
   * Validate pose completeness based on required landmarks
   * @param landmarks Array of landmarks to validate
   * @param requiredIndices Indices of required landmarks (defaults to all 33 MediaPipe landmarks)
   * @returns Completeness validation result
   */
  validateCompleteness(landmarks: NormalizedLandmark[], requiredIndices?: number[]): CompletenessResult {
    // Default to all 33 MediaPipe pose landmarks if no indices specified
    const defaultIndices = Array.from({ length: 33 }, (_, i) => i);
    const indices = requiredIndices ?? defaultIndices;

    // Handle empty required indices (no requirements = complete)
    if (indices.length === 0) {
      return {
        isComplete: true,
        presentCount: 0,
        requiredCount: 0,
        missingIndices: [],
        completenessPercentage: 100,
      };
    }

    // Deduplicate required indices
    const uniqueIndices = [...new Set(indices)];
    const requiredCount = uniqueIndices.length;
    const missingIndices: number[] = [];
    let presentCount = 0;

    // Check each required landmark
    for (const index of uniqueIndices) {
      // Check if index is within bounds
      if (index >= landmarks.length) {
        missingIndices.push(index);
        continue;
      }

      const landmark = landmarks[index];

      // Check if landmark exists and has non-zero visibility
      if (landmark?.visibility === undefined || landmark.visibility === 0) {
        missingIndices.push(index);
      } else {
        presentCount++;
      }
    }

    const completenessPercentage = requiredCount > 0 ? (presentCount / requiredCount) * 100 : 100;

    return {
      isComplete: missingIndices.length === 0,
      presentCount,
      requiredCount,
      missingIndices,
      completenessPercentage,
    };
  }

  /**
   * Assess overall quality of the pose
   * @param landmarks Array of landmarks to assess
   * @param config Quality assessment configuration
   * @returns Quality metrics
   */
  assessQuality(landmarks: NormalizedLandmark[], config?: QualityConfig): QualityMetrics {
    // Handle empty array
    if (landmarks.length === 0) {
      return {
        overallScore: 0,
        averageConfidence: 0,
        symmetryScore: 1.0,
        stabilityScore: 1.0,
        meetsQualityThreshold: false,
      };
    }

    // Calculate average confidence
    let visibilitySum = 0;
    let validCount = 0;

    for (const landmark of landmarks) {
      if (landmark?.visibility !== undefined) {
        visibilitySum += landmark.visibility;
        validCount++;
      }
    }

    const averageConfidence = validCount > 0 ? visibilitySum / validCount : 0;

    // Calculate symmetry score if enabled
    let symmetryScore = 1.0;
    if (config?.checkSymmetry) {
      symmetryScore = this.calculateSymmetryScore(landmarks);
    }

    // Calculate stability score if enabled
    let stabilityScore = 1.0;
    if (config?.checkStability && config.previousLandmarks) {
      stabilityScore = this.calculateStabilityScore(landmarks, config.previousLandmarks);
    }

    // Calculate overall score with weighted factors
    // Weights: confidence (50%), symmetry (25%), stability (25%)
    let overallScore = averageConfidence * 0.5 + symmetryScore * 0.25 + stabilityScore * 0.25;

    // Apply penalty for very low confidence landmarks
    const lowConfidencePenalty = this.calculateLowConfidencePenalty(landmarks);
    overallScore *= lowConfidencePenalty;

    // Determine if quality meets threshold
    const threshold = config?.minConfidence ?? 0.5;
    const meetsQualityThreshold = averageConfidence >= threshold && overallScore >= threshold;

    return {
      overallScore,
      averageConfidence,
      symmetryScore,
      stabilityScore,
      meetsQualityThreshold,
    };
  }

  /**
   * Calculate symmetry score based on paired landmarks
   * @param landmarks Array of landmarks to check
   * @returns Symmetry score (0-1)
   */
  private calculateSymmetryScore(landmarks: NormalizedLandmark[]): number {
    // Define left/right landmark pairs (MediaPipe indices)
    const pairs = [
      [1, 4], // Eyes inner
      [2, 5], // Eyes
      [3, 6], // Eyes outer
      [7, 8], // Ears
      [9, 10], // Mouth
      [11, 12], // Shoulders
      [13, 14], // Elbows
      [15, 16], // Wrists
      [17, 18], // Pinky
      [19, 20], // Index
      [21, 22], // Thumb
      [23, 24], // Hips
      [25, 26], // Knees
      [27, 28], // Ankles
      [29, 30], // Heels
      [31, 32], // Foot index
    ];

    let symmetrySum = 0;
    let validPairs = 0;

    for (const [leftIdx, rightIdx] of pairs) {
      if (leftIdx >= landmarks.length || rightIdx >= landmarks.length) {
        continue;
      }

      const left = landmarks[leftIdx];
      const right = landmarks[rightIdx];

      if (!left || !right || left.visibility === undefined || right.visibility === undefined) {
        continue;
      }

      // Calculate symmetry based on visibility difference
      const visibilityDiff = Math.abs(left.visibility - right.visibility);
      const pairSymmetry = 1 - visibilityDiff;

      // Weight important landmarks more heavily (shoulders, hips, knees)
      let weight = 1.0;
      if ([11, 12, 23, 24, 25, 26].includes(leftIdx)) {
        weight = 2.0;
      }

      symmetrySum += pairSymmetry * weight;
      validPairs += weight;
    }

    return validPairs > 0 ? symmetrySum / validPairs : 1.0;
  }

  /**
   * Calculate stability score between frames
   * @param current Current frame landmarks
   * @param previous Previous frame landmarks
   * @returns Stability score (0-1)
   */
  private calculateStabilityScore(current: NormalizedLandmark[], previous: NormalizedLandmark[]): number {
    if (previous.length === 0) {
      return 1.0;
    }

    let stabilitySum = 0;
    let validLandmarks = 0;

    const maxMovement = 0.02; // Maximum expected movement between frames (2% of normalized space)

    for (let i = 0; i < Math.min(current.length, previous.length); i++) {
      const curr = current[i];
      const prev = previous[i];

      if (!curr || !prev) {
        continue;
      }

      // Calculate euclidean distance
      const dx = curr.x - prev.x;
      const dy = curr.y - prev.y;
      const dz = curr.z - prev.z;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

      // Convert distance to stability score (1 = no movement, 0 = max movement)
      const stability = Math.max(0, 1 - distance / maxMovement);

      stabilitySum += stability;
      validLandmarks++;
    }

    return validLandmarks > 0 ? stabilitySum / validLandmarks : 1.0;
  }

  /**
   * Calculate penalty for landmarks with very low confidence
   * @param landmarks Array of landmarks
   * @returns Penalty multiplier (0-1)
   */
  private calculateLowConfidencePenalty(landmarks: NormalizedLandmark[]): number {
    let penaltySum = 0;
    let count = 0;

    for (const landmark of landmarks) {
      if (landmark?.visibility !== undefined) {
        // Apply heavier penalty for very low confidence (<0.4)
        if (landmark.visibility < 0.4) {
          penaltySum += landmark.visibility / 0.4; // Linear penalty
        } else {
          penaltySum += 1.0; // No penalty
        }
        count++;
      }
    }

    return count > 0 ? penaltySum / count : 1.0;
  }

  /**
   * Validate pose for a specific exercise
   * @param landmarks Array of landmarks to validate
   * @param exerciseType Type of exercise to validate for
   * @returns Complete pose validation result
   */
  validatePose(landmarks: NormalizedLandmark[], exerciseType: ExerciseType = 'generic'): PoseValidationResult {
    const messages: string[] = [];

    // Get exercise-specific configuration
    const config = this.getExerciseConfig(exerciseType);

    // Perform visibility validation
    const visibility = this.validateVisibility(landmarks, config.minVisibility);
    if (!visibility.isValid) {
      messages.push(`${visibility.totalCount - visibility.visibleCount} landmarks below visibility threshold`);
    }

    // Perform completeness validation
    const completeness = this.validateCompleteness(landmarks, config.requiredLandmarks);
    if (!completeness.isComplete) {
      messages.push(`Missing ${completeness.missingIndices.length} required landmarks`);
    }

    // Perform quality assessment
    const quality = this.assessQuality(landmarks, {
      minConfidence: config.minConfidence,
      checkSymmetry: config.checkSymmetry,
      checkStability: false, // Stability requires previous frame
    });
    if (!quality.meetsQualityThreshold) {
      messages.push('Pose quality below threshold');
    }

    // Exercise-specific validation
    const exerciseSpecificValid = this.validateExerciseSpecific(landmarks, exerciseType);
    if (!exerciseSpecificValid) {
      messages.push(`Does not meet ${exerciseType} exercise requirements`);
    }

    // Overall validation
    const isValid =
      visibility.isValid && completeness.isComplete && quality.meetsQualityThreshold && exerciseSpecificValid;

    return {
      isValid,
      visibility,
      completeness,
      quality,
      exerciseSpecificValid,
      messages,
    };
  }

  /**
   * Get exercise-specific configuration
   * @param exerciseType Type of exercise
   * @returns Exercise configuration
   */
  private getExerciseConfig(exerciseType: ExerciseType): {
    minVisibility: number;
    minConfidence: number;
    requiredLandmarks?: number[];
    checkSymmetry: boolean;
  } {
    switch (exerciseType) {
      case 'squat':
        return {
          minVisibility: 0.7,
          minConfidence: 0.7,
          requiredLandmarks: [
            11,
            12, // Shoulders (bar position)
            23,
            24, // Hips
            25,
            26, // Knees
            27,
            28, // Ankles
          ],
          checkSymmetry: true,
        };

      case 'bench':
        return {
          minVisibility: 0.7,
          minConfidence: 0.7,
          requiredLandmarks: [
            11,
            12, // Shoulders
            13,
            14, // Elbows
            15,
            16, // Wrists
          ],
          checkSymmetry: true,
        };

      case 'deadlift':
        return {
          minVisibility: 0.7,
          minConfidence: 0.7,
          requiredLandmarks: [
            11,
            12, // Shoulders
            23,
            24, // Hips
            25,
            26, // Knees
            27,
            28, // Ankles
          ],
          checkSymmetry: true,
        };

      case 'generic':
      default:
        return {
          minVisibility: 0.5,
          minConfidence: 0.5,
          requiredLandmarks: undefined, // Uses default (all 33)
          checkSymmetry: false,
        };
    }
  }

  /**
   * Validate exercise-specific requirements
   * @param landmarks Array of landmarks
   * @param exerciseType Type of exercise
   * @returns Whether exercise-specific requirements are met
   */
  private validateExerciseSpecific(landmarks: NormalizedLandmark[], exerciseType: ExerciseType): boolean {
    // For now, we'll just check that key landmarks have good visibility
    // In the future, this could check joint angles, positions, etc.
    const squatLandmarks = [23, 24, 25, 26];
    const benchLandmarks = [11, 12, 13, 14, 15, 16];
    const deadliftLandmarks = [11, 12, 23, 24, 25, 26];
    switch (exerciseType) {
      case 'squat':
        // Check that hip and knee landmarks are well visible
        return squatLandmarks.every(
          (idx) => landmarks[idx]?.visibility !== undefined && landmarks[idx].visibility > 0.7,
        );

      case 'bench':
        // Check that upper body landmarks are well visible
        return benchLandmarks.every(
          (idx) => landmarks[idx]?.visibility !== undefined && landmarks[idx].visibility > 0.7,
        );

      case 'deadlift':
        // Check that full body landmarks are well visible
        return deadliftLandmarks.every(
          (idx) => landmarks[idx]?.visibility !== undefined && landmarks[idx].visibility > 0.7,
        );

      case 'generic':
      default:
        return true; // No specific requirements for generic
    }
  }
}
