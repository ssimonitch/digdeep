import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useSquatAnalysis } from '@/features/pose-detection/hooks/useSquatAnalysis';

import { ActiveAnalysisScreen } from '../ActiveAnalysisScreen';
import { createLandmarksWithHipPosition, createMockAnalysisWithInvalidPose } from './mocks/coordinate-transform.mocks';

// Mock the hook before importing component
vi.mock('@/features/pose-detection/hooks/useSquatAnalysis');

describe('Valid Pose Gating - TDD Failing Tests', () => {
  it('should hide metrics when pose is invalid', () => {
    // This test SHOULD FAIL because we currently show metrics even with invalid pose

    const mockInvalidPose = createMockAnalysisWithInvalidPose({
      isValidPose: false,
      landmarks: null,
      depthPercentage: 640, // Extreme value from invalid calculation
      confidence: 0.2,
    });

    // Mock the hook to return invalid pose data
    vi.mocked(useSquatAnalysis).mockReturnValue(mockInvalidPose);

    render(<ActiveAnalysisScreen />);

    // These assertions should FAIL initially
    // We should NOT see the extreme depth value
    expect(screen.queryByText('640%')).not.toBeInTheDocument();
    // Don't use a broad regex that could match camera resolution
    // Instead, check that the depth indicator doesn't show this value
    const depthIndicator = screen.queryByTestId('depth-indicator');
    expect(depthIndicator).not.toBeInTheDocument();

    // We SHOULD see a message about positioning
    expect(screen.getByText('Position yourself in frame')).toBeInTheDocument();
  });

  it('should show pose validity indicators for users', () => {
    // This test SHOULD FAIL because we don't have validity indicators

    const mockValidPose = createMockAnalysisWithInvalidPose({
      isValidPose: true,
      landmarks: createLandmarksWithHipPosition(0.5),
      depthPercentage: 45,
      confidence: 0.9,
    });

    vi.mocked(useSquatAnalysis).mockReturnValue(mockValidPose);

    render(<ActiveAnalysisScreen />);

    // These assertions should FAIL initially
    expect(screen.getByText('Pose Detected')).toBeInTheDocument();
    expect(screen.getByTestId('pose-validity-indicator')).toHaveClass('valid');
  });

  it('should not render depth indicator when pose confidence is low', () => {
    // Test that depth indicator is hidden with low confidence

    const mockLowConfidence = createMockAnalysisWithInvalidPose({
      isValidPose: false,
      landmarks: createLandmarksWithHipPosition(0.5),
      depthPercentage: 85, // Some calculated value
      confidence: 0.3, // Low confidence
    });

    vi.mocked(useSquatAnalysis).mockReturnValue(mockLowConfidence);

    render(<ActiveAnalysisScreen />);

    // Should not show depth metrics with low confidence
    expect(screen.queryByText('85%')).not.toBeInTheDocument(); // Should FAIL
    expect(screen.queryByTestId('depth-indicator')).not.toBeInTheDocument(); // Should FAIL
  });

  it('should show appropriate UI when pose is lost during analysis', async () => {
    // Test transition from valid to invalid pose

    const mockPoseLost = createMockAnalysisWithInvalidPose({
      isValidPose: false,
      landmarks: null,
      depthPercentage: 0,
      confidence: 0,
    });

    const useSquatAnalysis = vi.mocked(
      await import('@/features/pose-detection/hooks/useSquatAnalysis').then((m) => m.useSquatAnalysis),
    );

    // Start with valid pose
    const mockValidPose = createMockAnalysisWithInvalidPose({
      isValidPose: true,
      landmarks: createLandmarksWithHipPosition(0.5),
      depthPercentage: 45,
      confidence: 0.9,
    });

    useSquatAnalysis.mockReturnValue(mockValidPose);
    const { rerender } = render(<ActiveAnalysisScreen />);

    // Verify metrics are shown initially
    expect(screen.getByText(/45%/)).toBeInTheDocument();

    // Now lose the pose
    useSquatAnalysis.mockReturnValue(mockPoseLost);
    rerender(<ActiveAnalysisScreen />);

    // Metrics should be hidden and guidance shown
    expect(screen.queryByText(/45%/)).not.toBeInTheDocument(); // Should FAIL
    expect(screen.getByText(/Position yourself/)).toBeInTheDocument(); // Should FAIL
  });

  it('should only show balance meter when pose is valid', () => {
    // Test that balance meter respects pose validity

    const mockInvalidWithBalance = createMockAnalysisWithInvalidPose({
      isValidPose: false,
      landmarks: createLandmarksWithHipPosition(0.5),
      depthPercentage: 0,
      confidence: 0.4,
    });

    // Add lateral shift data even though pose is invalid
    mockInvalidWithBalance.metrics.lateralShift = 15; // 15% shift

    vi.mocked(useSquatAnalysis).mockReturnValue(mockInvalidWithBalance);

    render(<ActiveAnalysisScreen />);

    // Balance meter should not be shown with invalid pose
    expect(screen.queryByTestId('balance-meter')).not.toBeInTheDocument(); // Should FAIL
    expect(screen.queryByText(/15%/)).not.toBeInTheDocument(); // Should FAIL
  });

  it('should display clear feedback when essential landmarks are not visible', () => {
    // Test specific feedback for missing key landmarks

    const mockMissingLandmarks = createMockAnalysisWithInvalidPose({
      isValidPose: false,
      landmarks: createLandmarksWithHipPosition(0.5),
      depthPercentage: 0,
      confidence: 0.2,
    });

    // Simulate missing hip landmarks (critical for squat analysis)
    if (mockMissingLandmarks.analysis?.squatMetrics) {
      mockMissingLandmarks.analysis.squatMetrics.keyLandmarkVisibility = {
        hips: 0.2, // Very low visibility
        knees: 0.9,
        ankles: 0.9,
        shoulders: 0.9,
      };
    }

    vi.mocked(useSquatAnalysis).mockReturnValue(mockMissingLandmarks);

    render(<ActiveAnalysisScreen />);

    // Should show specific feedback about what's missing
    expect(screen.getByText(/hips not visible/i)).toBeInTheDocument(); // Should FAIL
  });
});
