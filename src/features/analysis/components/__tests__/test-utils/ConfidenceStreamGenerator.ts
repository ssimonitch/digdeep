/**
 * ConfidenceStreamGenerator - Generates realistic confidence value streams for testing
 *
 * Creates sequences of confidence values that simulate real MediaPipe pose detection
 * behavior, including borderline values that cause flickering in the UI.
 *
 * Now uses centralized exercise configuration to ensure consistency with
 * production threshold values and eliminate hardcoded magic numbers.
 */

import type { ExerciseDetectionConfig } from '@/shared/exercise-config/base';
import { SQUAT_DETECTION_CONFIG } from '@/shared/exercise-config/squat';

export interface ConfidenceFrame {
  timestamp: number;
  confidence: number;
  frameIndex: number;
}

export interface StreamGeneratorOptions {
  durationMs: number;
  fps?: number;
  baseConfidence?: number;
  variance?: number;
  includeNoise?: boolean;
  pattern?: 'stable' | 'oscillating' | 'flickering' | 'realistic';
}

export class ConfidenceStreamGenerator {
  /**
   * Generates a stream of confidence values that simulate real pose detection behavior
   * @param options Configuration for the stream generation
   * @param config Exercise detection configuration (default: SQUAT_DETECTION_CONFIG)
   * @returns Array of confidence frames with timestamps
   */
  static generateStream(
    options: StreamGeneratorOptions,
    config: ExerciseDetectionConfig = SQUAT_DETECTION_CONFIG,
  ): ConfidenceFrame[] {
    const {
      durationMs,
      fps = 30,
      baseConfidence = 0.7,
      variance = 0.1,
      includeNoise = true,
      pattern = 'realistic',
    } = options;

    const frameInterval = 1000 / fps;
    const totalFrames = Math.floor(durationMs / frameInterval);
    const frames: ConfidenceFrame[] = [];

    for (let i = 0; i < totalFrames; i++) {
      const timestamp = i * frameInterval;
      let confidence: number;

      switch (pattern) {
        case 'stable':
          confidence = this.generateStableConfidence(baseConfidence, variance, includeNoise);
          break;
        case 'oscillating':
          confidence = this.generateOscillatingConfidence(i, baseConfidence, variance, includeNoise);
          break;
        case 'flickering':
          confidence = this.generateFlickeringConfidence(i, includeNoise, config);
          break;
        case 'realistic':
        default:
          confidence = this.generateRealisticConfidence(i, baseConfidence, variance, includeNoise);
          break;
      }

      frames.push({
        timestamp,
        confidence: Math.max(0, Math.min(1, confidence)), // Clamp to [0, 1]
        frameIndex: i,
      });
    }

    return frames;
  }

  /**
   * Generates confidence values that cross the lower threshold frequently
   * This pattern causes maximum flickering in the current implementation
   *
   * @param durationMs Duration of the stream in milliseconds
   * @param fps Frames per second (default: 30)
   * @param config Exercise detection configuration (default: SQUAT_DETECTION_CONFIG)
   */
  static generateFlickeringStream(
    durationMs: number,
    fps = 30,
    config: ExerciseDetectionConfig = SQUAT_DETECTION_CONFIG,
  ): ConfidenceFrame[] {
    const frameInterval = 1000 / fps;
    const totalFrames = Math.floor(durationMs / frameInterval);
    const frames: ConfidenceFrame[] = [];

    // Create a pattern that oscillates around the lower threshold
    const baseConfidence = config.lowerThreshold;
    const oscillationAmplitude = 0.1;
    const oscillationFrequency = 0.3; // Controls how fast values oscillate

    for (let i = 0; i < totalFrames; i++) {
      // Sinusoidal pattern that crosses threshold frequently
      const sinValue = Math.sin(i * oscillationFrequency) * oscillationAmplitude;

      // Add small random noise to make it more realistic
      const noise = (Math.random() - 0.5) * 0.04;

      const confidence = baseConfidence + sinValue + noise;

      frames.push({
        timestamp: i * frameInterval,
        confidence: Math.max(0, Math.min(1, confidence)),
        frameIndex: i,
      });
    }

    return frames;
  }

  /**
   * Generates confidence values at exact threshold boundaries
   * Tests edge case behavior around configured thresholds
   *
   * @param config Exercise detection configuration (default: SQUAT_DETECTION_CONFIG)
   */
  static generateThresholdBoundaryStream(config: ExerciseDetectionConfig = SQUAT_DETECTION_CONFIG): ConfidenceFrame[] {
    const lowerThreshold = config.lowerThreshold;
    const upperThreshold = config.upperThreshold;

    // Generate boundary values around both thresholds
    const criticalValues = [
      // Around lower threshold
      lowerThreshold - 0.02,
      lowerThreshold - 0.01,
      lowerThreshold,
      lowerThreshold + 0.01,
      lowerThreshold + 0.02,
      // Lower threshold oscillation
      lowerThreshold - 0.01,
      lowerThreshold,
      lowerThreshold + 0.01,
      lowerThreshold,
      lowerThreshold - 0.01,
      // Around upper threshold
      upperThreshold - 0.02,
      upperThreshold - 0.01,
      upperThreshold,
      upperThreshold + 0.01,
      upperThreshold + 0.02,
      // Upper threshold oscillation
      upperThreshold - 0.01,
      upperThreshold,
      upperThreshold + 0.01,
      upperThreshold,
      upperThreshold - 0.01,
    ];

    return criticalValues.map((confidence, i) => ({
      timestamp: i * 33, // ~30 FPS
      confidence: Math.max(0, Math.min(1, confidence)), // Clamp to [0, 1]
      frameIndex: i,
    }));
  }

  /**
   * Generates rapid oscillation pattern (worst case scenario)
   * Simulates maximum instability for stress testing
   *
   * @param durationMs Duration of the stream in milliseconds
   * @param fps Frames per second (default: 30)
   * @param config Exercise detection configuration (default: SQUAT_DETECTION_CONFIG)
   */
  static generateRapidOscillationStream(
    durationMs: number,
    fps = 30,
    config: ExerciseDetectionConfig = SQUAT_DETECTION_CONFIG,
  ): ConfidenceFrame[] {
    const frameInterval = 1000 / fps;
    const totalFrames = Math.floor(durationMs / frameInterval);
    const frames: ConfidenceFrame[] = [];

    // Alternates between values just below and above lower threshold
    const lowValue = config.lowerThreshold - 0.02;
    const highValue = config.lowerThreshold + 0.02;

    for (let i = 0; i < totalFrames; i++) {
      const confidence = i % 2 === 0 ? lowValue : highValue;

      frames.push({
        timestamp: i * frameInterval,
        confidence: Math.max(0, Math.min(1, confidence)), // Clamp to [0, 1]
        frameIndex: i,
      });
    }

    return frames;
  }

  /**
   * Generates confidence values that simulate real MediaPipe behavior
   * Includes natural variance, occasional dips, and recovery patterns
   */
  private static generateRealisticConfidence(
    frameIndex: number,
    baseConfidence: number,
    variance: number,
    includeNoise: boolean,
  ): number {
    // Primary sinusoidal variation (simulates natural movement)
    const primaryWave = Math.sin(frameIndex * 0.1) * variance * 0.5;

    // Secondary wave (simulates minor body movements)
    const secondaryWave = Math.sin(frameIndex * 0.3) * variance * 0.3;

    // Occasional dips (simulates temporary occlusion or poor detection)
    const occasionalDip = frameIndex % 50 === 0 ? -variance * 2 : 0;

    // Random noise
    const noise = includeNoise ? (Math.random() - 0.5) * 0.04 : 0;

    return baseConfidence + primaryWave + secondaryWave + occasionalDip + noise;
  }

  /**
   * Generates stable confidence values with minimal variation
   * Used to test behavior with consistent detection
   */
  private static generateStableConfidence(baseConfidence: number, variance: number, includeNoise: boolean): number {
    const noise = includeNoise ? (Math.random() - 0.5) * variance * 0.1 : 0;
    return baseConfidence + noise;
  }

  /**
   * Generates oscillating confidence values
   * Used to test smooth transitions without rapid flickering
   */
  private static generateOscillatingConfidence(
    frameIndex: number,
    baseConfidence: number,
    variance: number,
    includeNoise: boolean,
  ): number {
    const oscillation = Math.sin(frameIndex * 0.05) * variance;
    const noise = includeNoise ? (Math.random() - 0.5) * 0.02 : 0;
    return baseConfidence + oscillation + noise;
  }

  /**
   * Generates confidence values specifically around the lower threshold
   * Maximizes flickering for current implementation
   */
  private static generateFlickeringConfidence(
    frameIndex: number,
    includeNoise: boolean,
    config: ExerciseDetectionConfig = SQUAT_DETECTION_CONFIG,
  ): number {
    // Base at exactly the lower threshold to maximize threshold crossing
    const base = config.lowerThreshold;

    // High frequency oscillation
    const oscillation = Math.sin(frameIndex * 0.5) * 0.15;

    // Add noise to ensure values cross threshold
    const noise = includeNoise ? (Math.random() - 0.5) * 0.05 : 0;

    return base + oscillation + noise;
  }

  /**
   * Generates a sequence of confidence values for specific test scenarios
   *
   * @param config Exercise detection configuration (default: SQUAT_DETECTION_CONFIG)
   */
  static generateTestScenarios(config: ExerciseDetectionConfig = SQUAT_DETECTION_CONFIG): {
    borderlineFlickering: ConfidenceFrame[];
    stableHigh: ConfidenceFrame[];
    stableLow: ConfidenceFrame[];
    recovery: ConfidenceFrame[];
    degradation: ConfidenceFrame[];
  } {
    return {
      // Values that cause maximum flickering
      borderlineFlickering: this.generateFlickeringStream(1000, 30, config),

      // Stable high confidence (should remain in 'valid' state)
      stableHigh: this.generateStream(
        {
          durationMs: 1000,
          baseConfidence: 0.85,
          variance: 0.05,
          pattern: 'stable',
        },
        config,
      ),

      // Stable low confidence (should remain in 'invalid' state)
      stableLow: this.generateStream(
        {
          durationMs: 1000,
          baseConfidence: 0.3,
          variance: 0.05,
          pattern: 'stable',
        },
        config,
      ),

      // Recovery pattern (low -> high)
      recovery: [
        ...this.generateStream({ durationMs: 500, baseConfidence: 0.3, variance: 0.05 }, config),
        ...this.generateStream({ durationMs: 500, baseConfidence: 0.8, variance: 0.05 }, config),
      ],

      // Degradation pattern (high -> low)
      degradation: [
        ...this.generateStream({ durationMs: 500, baseConfidence: 0.8, variance: 0.05 }, config),
        ...this.generateStream({ durationMs: 500, baseConfidence: 0.3, variance: 0.05 }, config),
      ],
    };
  }
}
