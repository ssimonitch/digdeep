import { act, render, screen } from '@testing-library/react';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { useSquatAnalysis } from '@/features/pose-detection/hooks/useSquatAnalysis';
import { PoseValidityStabilizer } from '@/features/pose-detection/services/pose-validity-stabilizer';
import { SQUAT_DETECTION_CONFIG } from '@/shared/exercise-config/squat';
import { setupMediaStreamMock, setupResizeObserverMock, setupVideoElementMock } from '@/test-utils/mocks';

import { ActiveAnalysisScreen } from '../ActiveAnalysisScreen';
import { createMockUseSquatAnalysis, mockAnalysisWithDirectLandmarks } from './mocks/analysis-screen.mocks';
import { ConfidenceStreamGenerator, UIFlickerDetector } from './test-utils';

// Mock the hook
vi.mock('@/features/pose-detection/hooks/useSquatAnalysis');

// Setup mocks for jsdom compatibility
setupMediaStreamMock();
setupResizeObserverMock();

let cleanupVideoMock: (() => void) | undefined;

beforeAll(() => {
  cleanupVideoMock = setupVideoElementMock();
});

afterAll(() => {
  cleanupVideoMock?.();
});

/**
 * Tests for UI Flickering Detection with Stabilization
 *
 * These tests verify that the PoseValidityStabilizer properly prevents
 * UI flickering when confidence values fluctuate around detection thresholds.
 *
 * The tests use realistic confidence streams and the actual PoseValidityStabilizer
 * to ensure the stabilization logic works correctly in preventing rapid state changes.
 */
describe('UI Flickering Detection with Stabilization', () => {
  const mockOnBack = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Set up initial mock to prevent undefined errors
    vi.mocked(useSquatAnalysis).mockReturnValue(createMockUseSquatAnalysis());
  });

  /**
   * Helper function to capture current UI state using semantic queries
   * Following React Testing Library best practices by using data attributes and roles
   */
  const captureUIState = () => {
    try {
      // Query the overlay using data-testid
      const overlay = screen.queryByTestId('pose-guidance-overlay');

      // Get the heading using role
      const heading = screen.queryByTestId('pose-guidance-heading');

      // Get confidence from data attribute
      const detectionState =
        (overlay?.getAttribute('data-detection-state') as 'invalid' | 'detecting' | 'valid') ?? 'invalid';
      const confidenceValue = parseInt(overlay?.getAttribute('data-confidence') ?? '0');
      const headingText = heading?.textContent ?? '';

      return {
        detectionState,
        confidenceValue,
        headingText,
      };
    } catch {
      // Return default values if elements not found
      return {
        detectionState: 'invalid' as const,
        confidenceValue: 0,
        headingText: '',
      };
    }
  };

  /**
   * Helper to create mock data with specific confidence
   *
   * Uses the actual PoseValidityStabilizer to determine pose validity,
   * simulating the real stabilized behavior in production.
   */
  const createMockWithConfidence = (confidence: number, timestamp: number, stabilizer: PoseValidityStabilizer) => {
    // Update the stabilizer with the new confidence value
    stabilizer.update(confidence, timestamp);
    const detectionState = stabilizer.getState();

    const baseMock = mockAnalysisWithDirectLandmarks();
    return {
      ...baseMock,
      metrics: {
        ...baseMock.metrics,
        confidence,
        isValidPose: detectionState === 'valid',
        detectionState,
      },
    };
  };

  describe('Core Flickering Detection', () => {
    it('prevents excessive state transitions with realistic confidence stream', async () => {
      const flickerDetector = new UIFlickerDetector();
      const stabilizer = new PoseValidityStabilizer(SQUAT_DETECTION_CONFIG);
      const confidenceStream = ConfidenceStreamGenerator.generateFlickeringStream(1000, 30, SQUAT_DETECTION_CONFIG); // 1 second at 30 FPS

      // Initial render
      const { rerender } = render(<ActiveAnalysisScreen onBack={mockOnBack} />);

      let previousState: ReturnType<typeof captureUIState> | null = null;

      // Process confidence stream
      for (const { confidence, timestamp } of confidenceStream) {
        const mockData = createMockWithConfidence(confidence, timestamp, stabilizer);

        await act(async () => {
          vi.mocked(useSquatAnalysis).mockReturnValue(mockData);
          rerender(<ActiveAnalysisScreen onBack={mockOnBack} />);

          // Give React time to process the update
          await new Promise((resolve) => setTimeout(resolve, 0));
        });

        // Capture current state and only record if it changed
        const currentState = captureUIState();
        if (
          !previousState ||
          previousState.detectionState !== currentState.detectionState ||
          previousState.headingText !== currentState.headingText
        ) {
          flickerDetector.recordState(currentState);
        }
        previousState = currentState;
      }

      // Analyze flickering behavior
      const analysis = flickerDetector.getFlickerAnalysis();

      // With stabilization, we should see minimal state changes
      expect(analysis.stateChanges).toBeLessThan(5);
      expect(analysis.hasRapidFlickering).toBe(false);
      expect(analysis.changeFrequency).toBeLessThan(5); // Changes per second
    });

    it('handles confidence values at exact thresholds without flickering', () => {
      const flickerDetector = new UIFlickerDetector();
      const stabilizer = new PoseValidityStabilizer(SQUAT_DETECTION_CONFIG);
      const thresholdStream = ConfidenceStreamGenerator.generateThresholdBoundaryStream(SQUAT_DETECTION_CONFIG);

      const { rerender } = render(<ActiveAnalysisScreen onBack={mockOnBack} />);

      for (const { confidence, timestamp } of thresholdStream) {
        const mockData = createMockWithConfidence(confidence, timestamp, stabilizer);

        act(() => {
          vi.mocked(useSquatAnalysis).mockReturnValue(mockData);
          rerender(<ActiveAnalysisScreen onBack={mockOnBack} />);
        });

        flickerDetector.recordState(captureUIState());
      }

      // With hysteresis, threshold boundaries should be stable
      expect(flickerDetector.getDetectionStateChanges()).toBeLessThanOrEqual(2);
      expect(flickerDetector.getHeadingTextChanges()).toBeLessThanOrEqual(2);
    });

    it('maintains stability during rapid confidence oscillation', async () => {
      const flickerDetector = new UIFlickerDetector();
      const stabilizer = new PoseValidityStabilizer(SQUAT_DETECTION_CONFIG);
      const oscillationStream = ConfidenceStreamGenerator.generateRapidOscillationStream(
        500,
        30,
        SQUAT_DETECTION_CONFIG,
      );

      const { rerender } = render(<ActiveAnalysisScreen onBack={mockOnBack} />);

      let previousState: ReturnType<typeof captureUIState> | null = null;

      for (const { confidence, timestamp } of oscillationStream) {
        const mockData = createMockWithConfidence(confidence, timestamp, stabilizer);

        await act(async () => {
          vi.mocked(useSquatAnalysis).mockReturnValue(mockData);
          rerender(<ActiveAnalysisScreen onBack={mockOnBack} />);
          await new Promise((resolve) => setTimeout(resolve, 16)); // Simulate ~60 FPS render
        });

        // Only record state changes
        const currentState = captureUIState();
        if (
          !previousState ||
          previousState.detectionState !== currentState.detectionState ||
          previousState.headingText !== currentState.headingText
        ) {
          flickerDetector.recordState(currentState);
        }
        previousState = currentState;
      }

      // Stabilization should prevent rapid flickering
      expect(flickerDetector.hasRapidFlickering(200)).toBe(false); // No changes faster than 200ms
      expect(flickerDetector.getStateChangeFrequency()).toBeLessThan(3); // Max 3 changes per second
    });
  });

  describe('Unnecessary Re-renders', () => {
    it('avoids unnecessary re-renders with stable confidence', () => {
      const flickerDetector = new UIFlickerDetector();
      const stabilizer = new PoseValidityStabilizer(SQUAT_DETECTION_CONFIG);
      const stableStream = ConfidenceStreamGenerator.generateStream(
        {
          durationMs: 1000,
          baseConfidence: 0.8,
          variance: 0.02, // Very small variance
          pattern: 'stable',
        },
        SQUAT_DETECTION_CONFIG,
      );

      const { rerender } = render(<ActiveAnalysisScreen onBack={mockOnBack} />);

      for (const { confidence, timestamp } of stableStream) {
        const mockData = createMockWithConfidence(confidence, timestamp, stabilizer);

        act(() => {
          vi.mocked(useSquatAnalysis).mockReturnValue(mockData);
          rerender(<ActiveAnalysisScreen onBack={mockOnBack} />);
        });

        flickerDetector.recordState(captureUIState());
      }

      // With stable confidence above threshold, there should be no state changes
      const analysis = flickerDetector.getFlickerAnalysis();
      expect(analysis.stateChanges).toBe(0); // No state changes
      expect(analysis.headingChanges).toBe(0); // No heading text changes
    });
  });

  describe('Visual Feedback Stability', () => {
    it('provides stable guidance messages during borderline detection', async () => {
      const flickerDetector = new UIFlickerDetector();
      const stabilizer = new PoseValidityStabilizer(SQUAT_DETECTION_CONFIG);

      // Simulate user adjusting position with borderline confidence
      const adjustmentSequence = [0.45, 0.48, 0.51, 0.49, 0.52, 0.55, 0.58, 0.62, 0.65, 0.68, 0.71];
      let timestamp = 0;

      const { rerender } = render(<ActiveAnalysisScreen onBack={mockOnBack} />);

      let previousState: ReturnType<typeof captureUIState> | null = null;

      for (const confidence of adjustmentSequence) {
        timestamp += 100; // 100ms between samples
        const mockData = createMockWithConfidence(confidence, timestamp, stabilizer);

        await act(async () => {
          vi.mocked(useSquatAnalysis).mockReturnValue(mockData);
          rerender(<ActiveAnalysisScreen onBack={mockOnBack} />);
          await new Promise((resolve) => setTimeout(resolve, 33)); // 30 FPS timing
        });

        // Only record state changes
        const currentState = captureUIState();
        if (
          !previousState ||
          previousState.detectionState !== currentState.detectionState ||
          previousState.headingText !== currentState.headingText
        ) {
          flickerDetector.recordState(currentState);
        }
        previousState = currentState;
      }

      // Guidance should transition smoothly with stabilization
      expect(flickerDetector.getHeadingTextChanges()).toBeLessThan(3); // Max 3 message changes
      expect(flickerDetector.hasRapidFlickering(300)).toBe(false); // No rapid visual changes
    });

    it('maintains consistent progress bar updates', () => {
      const confidenceValues: number[] = [];
      const stabilizer = new PoseValidityStabilizer(SQUAT_DETECTION_CONFIG);
      const confidenceStream = ConfidenceStreamGenerator.generateFlickeringStream(500, 30, SQUAT_DETECTION_CONFIG);

      const { rerender } = render(<ActiveAnalysisScreen onBack={mockOnBack} />);

      for (const { confidence, timestamp } of confidenceStream) {
        const mockData = createMockWithConfidence(confidence, timestamp, stabilizer);

        act(() => {
          vi.mocked(useSquatAnalysis).mockReturnValue(mockData);
          rerender(<ActiveAnalysisScreen onBack={mockOnBack} />);
        });

        // Get confidence value from the overlay data attribute
        const overlay = screen.queryByTestId('pose-guidance-overlay');
        const confidenceValue = parseInt(overlay?.getAttribute('data-confidence') ?? '0');
        confidenceValues.push(confidenceValue);
      }

      // Count rapid percentage changes
      let rapidChanges = 0;
      for (let i = 1; i < confidenceValues.length; i++) {
        const prev = confidenceValues[i - 1];
        const curr = confidenceValues[i];
        if (Math.abs(curr - prev) > 10) {
          // Large jumps in percentage
          rapidChanges++;
        }
      }

      // Progress bar should update smoothly
      expect(rapidChanges).toBeLessThan(3); // Max 3 large jumps
    });
  });

  describe('State Transition Patterns', () => {
    it('handles recovery from invalid to valid state smoothly', () => {
      const flickerDetector = new UIFlickerDetector();
      const stabilizer = new PoseValidityStabilizer(SQUAT_DETECTION_CONFIG);
      const scenarios = ConfidenceStreamGenerator.generateTestScenarios(SQUAT_DETECTION_CONFIG);

      const { rerender } = render(<ActiveAnalysisScreen onBack={mockOnBack} />);

      // Test recovery pattern
      for (const { confidence, timestamp } of scenarios.recovery) {
        const mockData = createMockWithConfidence(confidence, timestamp, stabilizer);

        act(() => {
          vi.mocked(useSquatAnalysis).mockReturnValue(mockData);
          rerender(<ActiveAnalysisScreen onBack={mockOnBack} />);
        });

        flickerDetector.recordState(captureUIState());
      }

      // Should have smooth transition from invalid to valid
      const analysis = flickerDetector.getFlickerAnalysis();
      expect(analysis.stateChanges).toBeLessThanOrEqual(1); // One transition
      expect(analysis.headingChanges).toBeLessThanOrEqual(1); // One message change
    });

    it('handles degradation from valid to invalid state smoothly', () => {
      const flickerDetector = new UIFlickerDetector();
      const stabilizer = new PoseValidityStabilizer(SQUAT_DETECTION_CONFIG);
      const scenarios = ConfidenceStreamGenerator.generateTestScenarios(SQUAT_DETECTION_CONFIG);

      const { rerender } = render(<ActiveAnalysisScreen onBack={mockOnBack} />);

      // Test degradation pattern
      for (const { confidence, timestamp } of scenarios.degradation) {
        const mockData = createMockWithConfidence(confidence, timestamp, stabilizer);

        act(() => {
          vi.mocked(useSquatAnalysis).mockReturnValue(mockData);
          rerender(<ActiveAnalysisScreen onBack={mockOnBack} />);
        });

        flickerDetector.recordState(captureUIState());
      }

      // Should have smooth transition from valid to invalid with debouncing
      const analysis = flickerDetector.getFlickerAnalysis();
      expect(analysis.stateChanges).toBeLessThanOrEqual(3); // valid -> detecting -> invalid
      expect(analysis.headingChanges).toBeLessThanOrEqual(3); // Corresponding message changes
    });
  });
});
