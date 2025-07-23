import { act, render, screen } from '@testing-library/react';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { useSquatAnalysis } from '@/features/pose-detection/hooks/useSquatAnalysis';
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
 * TDD Tests for UI Flickering Detection
 *
 * These tests are designed to FAIL with the current implementation,
 * demonstrating the flickering behavior that needs to be fixed.
 *
 * Once the stabilization logic is implemented, these tests should pass.
 *
 * NOTE: These tests replace the inadequate "should not flicker during rapid state changes"
 * test that was previously in ActiveAnalysisScreen.test.tsx. That test used static
 * mock data and only checked final state, causing it to pass incorrectly.
 *
 * These tests use realistic confidence streams and measure actual flickering behavior.
 */
describe('UI Flickering Detection (TDD)', () => {
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
   * Uses shared exercise configuration to determine pose validity.
   * This simulates the current broken logic that will be replaced by PoseValidityStabilizer.
   */
  const createMockWithConfidence = (confidence: number) => {
    const baseMock = mockAnalysisWithDirectLandmarks();
    return {
      ...baseMock,
      metrics: {
        ...baseMock.metrics,
        confidence,
        // Current logic that causes flickering - uses simple threshold instead of stabilizer
        // This will be replaced with PoseValidityStabilizer logic in the actual fix
        isValidPose: confidence > SQUAT_DETECTION_CONFIG.upperThreshold,
      },
    };
  };

  describe('Core Flickering Detection', () => {
    it('SHOULD FAIL: detects excessive state transitions with realistic confidence stream', async () => {
      const flickerDetector = new UIFlickerDetector();
      const confidenceStream = ConfidenceStreamGenerator.generateFlickeringStream(1000, 30, SQUAT_DETECTION_CONFIG); // 1 second at 30 FPS

      // Initial render
      const { rerender } = render(<ActiveAnalysisScreen onBack={mockOnBack} />);

      // Process confidence stream
      for (const { confidence } of confidenceStream) {
        const mockData = createMockWithConfidence(confidence);

        await act(async () => {
          vi.mocked(useSquatAnalysis).mockReturnValue(mockData);
          rerender(<ActiveAnalysisScreen onBack={mockOnBack} />);

          // Give React time to process the update
          await new Promise((resolve) => setTimeout(resolve, 0));
        });

        // Capture current state
        flickerDetector.recordState(captureUIState());
      }

      // Analyze flickering behavior
      const analysis = flickerDetector.getFlickerAnalysis();

      // These assertions MUST FAIL with current implementation
      // Current implementation will have ~15-20 transitions instead of <5
      expect(analysis.stateChanges).toBeLessThan(5);
      expect(analysis.hasRapidFlickering).toBe(false);
      expect(analysis.changeFrequency).toBeLessThan(5); // Changes per second

      // Analysis results (will show actual values that fail)
      // stateChanges: ~15-20 instead of <5
      // hasRapidFlickering: true instead of false
      // changeFrequency: ~15-20 instead of <5
    });

    it('SHOULD FAIL: handles confidence values at exact thresholds without flickering', () => {
      const flickerDetector = new UIFlickerDetector();
      const thresholdStream = ConfidenceStreamGenerator.generateThresholdBoundaryStream(SQUAT_DETECTION_CONFIG);

      const { rerender } = render(<ActiveAnalysisScreen onBack={mockOnBack} />);

      for (const { confidence } of thresholdStream) {
        const mockData = createMockWithConfidence(confidence);

        act(() => {
          vi.mocked(useSquatAnalysis).mockReturnValue(mockData);
          rerender(<ActiveAnalysisScreen onBack={mockOnBack} />);
        });

        flickerDetector.recordState(captureUIState());
      }

      // Should not flicker at threshold boundaries (currently FAILS)
      expect(flickerDetector.getDetectionStateChanges()).toBeLessThanOrEqual(2);
      expect(flickerDetector.getHeadingTextChanges()).toBeLessThanOrEqual(2);
    });

    it('SHOULD FAIL: maintains stability during rapid confidence oscillation', async () => {
      const flickerDetector = new UIFlickerDetector();
      const oscillationStream = ConfidenceStreamGenerator.generateRapidOscillationStream(
        500,
        30,
        SQUAT_DETECTION_CONFIG,
      );

      const { rerender } = render(<ActiveAnalysisScreen onBack={mockOnBack} />);

      for (const { confidence } of oscillationStream) {
        const mockData = createMockWithConfidence(confidence);

        await act(async () => {
          vi.mocked(useSquatAnalysis).mockReturnValue(mockData);
          rerender(<ActiveAnalysisScreen onBack={mockOnBack} />);
          await new Promise((resolve) => setTimeout(resolve, 16)); // Simulate ~60 FPS render
        });

        flickerDetector.recordState(captureUIState());
      }

      // Should stabilize rapid oscillations (currently FAILS)
      expect(flickerDetector.hasRapidFlickering(200)).toBe(false); // No changes faster than 200ms
      expect(flickerDetector.getStateChangeFrequency()).toBeLessThan(3); // Max 3 changes per second
    });
  });

  describe('Unnecessary Re-renders', () => {
    it('SHOULD FAIL: avoids unnecessary re-renders with stable confidence', () => {
      const flickerDetector = new UIFlickerDetector();
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

      for (const { confidence } of stableStream) {
        const mockData = createMockWithConfidence(confidence);

        act(() => {
          vi.mocked(useSquatAnalysis).mockReturnValue(mockData);
          rerender(<ActiveAnalysisScreen onBack={mockOnBack} />);
        });

        flickerDetector.recordState(captureUIState());
      }

      // With stable confidence, there should be minimal state changes
      const analysis = flickerDetector.getFlickerAnalysis();
      expect(analysis.stateChanges).toBe(0); // No state changes
      expect(analysis.headingChanges).toBe(0); // No heading text changes
    });
  });

  describe('Visual Feedback Stability', () => {
    it('SHOULD FAIL: provides stable guidance messages during borderline detection', async () => {
      const flickerDetector = new UIFlickerDetector();

      // Simulate user adjusting position with borderline confidence
      const adjustmentSequence = [0.45, 0.48, 0.51, 0.49, 0.52, 0.55, 0.58, 0.62, 0.65, 0.68, 0.71];

      const { rerender } = render(<ActiveAnalysisScreen onBack={mockOnBack} />);

      for (const confidence of adjustmentSequence) {
        const mockData = createMockWithConfidence(confidence);

        await act(async () => {
          vi.mocked(useSquatAnalysis).mockReturnValue(mockData);
          rerender(<ActiveAnalysisScreen onBack={mockOnBack} />);
          await new Promise((resolve) => setTimeout(resolve, 33)); // 30 FPS timing
        });

        flickerDetector.recordState(captureUIState());
      }

      // Guidance should transition smoothly (currently FAILS with rapid changes)
      expect(flickerDetector.getHeadingTextChanges()).toBeLessThan(3); // Max 3 message changes
      expect(flickerDetector.hasRapidFlickering(300)).toBe(false); // No rapid visual changes
    });

    it('SHOULD FAIL: maintains consistent progress bar updates', () => {
      const confidenceValues: number[] = [];
      const confidenceStream = ConfidenceStreamGenerator.generateFlickeringStream(500, 30, SQUAT_DETECTION_CONFIG);

      const { rerender } = render(<ActiveAnalysisScreen onBack={mockOnBack} />);

      for (const { confidence } of confidenceStream) {
        const mockData = createMockWithConfidence(confidence);

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

      // Progress bar should update smoothly (currently FAILS with jumpy updates)
      expect(rapidChanges).toBeLessThan(3); // Max 3 large jumps
    });
  });

  describe('State Transition Patterns', () => {
    it('SHOULD FAIL: handles recovery from invalid to valid state smoothly', () => {
      const flickerDetector = new UIFlickerDetector();
      const scenarios = ConfidenceStreamGenerator.generateTestScenarios(SQUAT_DETECTION_CONFIG);

      const { rerender } = render(<ActiveAnalysisScreen onBack={mockOnBack} />);

      // Test recovery pattern
      for (const { confidence } of scenarios.recovery) {
        const mockData = createMockWithConfidence(confidence);

        act(() => {
          vi.mocked(useSquatAnalysis).mockReturnValue(mockData);
          rerender(<ActiveAnalysisScreen onBack={mockOnBack} />);
        });

        flickerDetector.recordState(captureUIState());
      }

      // Should have smooth transition from invalid to valid (currently may flicker)
      const analysis = flickerDetector.getFlickerAnalysis();
      expect(analysis.stateChanges).toBeLessThanOrEqual(1); // One transition
      expect(analysis.headingChanges).toBeLessThanOrEqual(1); // One message change
    });

    it('SHOULD FAIL: handles degradation from valid to invalid state smoothly', () => {
      const flickerDetector = new UIFlickerDetector();
      const scenarios = ConfidenceStreamGenerator.generateTestScenarios(SQUAT_DETECTION_CONFIG);

      const { rerender } = render(<ActiveAnalysisScreen onBack={mockOnBack} />);

      // Test degradation pattern
      for (const { confidence } of scenarios.degradation) {
        const mockData = createMockWithConfidence(confidence);

        act(() => {
          vi.mocked(useSquatAnalysis).mockReturnValue(mockData);
          rerender(<ActiveAnalysisScreen onBack={mockOnBack} />);
        });

        flickerDetector.recordState(captureUIState());
      }

      // Should have smooth transition from valid to invalid (currently may flicker)
      const analysis = flickerDetector.getFlickerAnalysis();
      expect(analysis.stateChanges).toBeLessThanOrEqual(1); // One transition
      expect(analysis.headingChanges).toBeLessThanOrEqual(1); // One message change
    });
  });
});
