import { act, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useSquatAnalysis } from '@/features/pose-detection/hooks/useSquatAnalysis';
import { findLandmarkByPosition } from '@/test-utils/helpers/dom-queries';
import { MinimalMediaStream, mockResizeObserver } from '@/test-utils/mocks';

import { ActiveAnalysisScreen } from '../ActiveAnalysisScreen';
import { createMockWithKnownCoordinates } from './mocks/coordinate-transform.mocks';

// Mock the hook before importing component
vi.mock('@/features/pose-detection/hooks/useSquatAnalysis');

// Helper function to trigger ResizeObserver callback
function triggerResizeObserver(videoElement: HTMLVideoElement, dimensions: { width: number; height: number }): void {
  act(() => {
    const resizeObserverInstance = global.ResizeObserver as unknown as {
      mock: { calls: [ResizeObserverCallback][] };
    };
    const resizeObserverCalls = resizeObserverInstance.mock.calls;

    if (resizeObserverCalls.length > 0) {
      const observeCallback = resizeObserverCalls[0][0];
      observeCallback(
        [
          {
            target: videoElement,
            contentRect: {
              width: dimensions.width,
              height: dimensions.height,
              top: 0,
              left: 0,
              right: dimensions.width,
              bottom: dimensions.height,
              x: 0,
              y: 0,
              toJSON: () => ({}),
            },
            borderBoxSize: [],
            contentBoxSize: [],
            devicePixelContentBoxSize: [],
          },
        ],
        {} as ResizeObserver,
      );
    }
  });
}

describe('Pose Landmark Coordinate System Integration', () => {
  beforeEach(() => {
    // Mock ResizeObserver with proper typing
    global.ResizeObserver = mockResizeObserver as unknown as typeof ResizeObserver;

    // Reset mocks
    vi.clearAllMocks();
  });

  it('should position landmarks correctly when display dimensions differ from camera resolution', async () => {
    // This test verifies coordinate transformation between camera and display dimensions
    // Camera resolution: 1280x720, Display dimensions: 640x360 (50% scaling)

    const mockStream = new MinimalMediaStream();
    const mockAnalysis = createMockWithKnownCoordinates({
      shoulderX: 0.5, // Should appear at display center (320px)
      shoulderY: 0.5, // Should appear at display center (180px)
      cameraDimensions: { width: 1280, height: 720 },
      displayDimensions: { width: 640, height: 360 },
    });

    // Override the camera stream to make video element render
    mockAnalysis.camera.stream = mockStream;

    // Mock the hook to return our test data
    vi.mocked(useSquatAnalysis).mockReturnValue(mockAnalysis);

    const { container } = render(<ActiveAnalysisScreen />);

    // Get the video element
    const videoElement = container.querySelector('video');
    expect(videoElement).toBeInTheDocument();

    // Mock the video element's dimensions
    if (videoElement) {
      // Set up getBoundingClientRect to return our display dimensions
      vi.spyOn(videoElement, 'getBoundingClientRect').mockReturnValue({
        width: 640,
        height: 360,
        top: 0,
        left: 0,
        right: 640,
        bottom: 360,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect);

      // Trigger ResizeObserver callback to update display dimensions
      triggerResizeObserver(videoElement, { width: 640, height: 360 });
    }

    // Wait for the overlay to render
    await waitFor(() => {
      const poseOverlay = container.querySelector('svg.pointer-events-none.absolute.inset-0');
      expect(poseOverlay).toBeInTheDocument();
    });

    // Find the pose overlay SVG
    const poseOverlay = container.querySelector('svg.pointer-events-none.absolute.inset-0');
    expect(poseOverlay).toBeInTheDocument();

    // Verify the SVG has the correct dimensions
    await waitFor(() => {
      expect(poseOverlay).toHaveAttribute('width', '640');
      expect(poseOverlay).toHaveAttribute('height', '360');
    });

    // Check that landmarks are positioned correctly at display coordinates
    const shoulderLandmark = findLandmarkByPosition(poseOverlay as HTMLElement, 320, 180);
    expect(shoulderLandmark).toBeInTheDocument();
  });

  it('should update overlay when video element dimensions change', async () => {
    // This test verifies the overlay updates when video element is resized

    const mockStream = new MinimalMediaStream();
    const mockAnalysis = createMockWithKnownCoordinates({
      shoulderX: 0.5,
      shoulderY: 0.5,
    });

    // Add stream to enable video rendering
    mockAnalysis.camera.stream = mockStream;

    // Mock the hook
    vi.mocked(useSquatAnalysis).mockReturnValue(mockAnalysis);

    const { container } = render(<ActiveAnalysisScreen />);

    // Get the actual video element from the rendered component
    const videoElement = container.querySelector('video');
    expect(videoElement).toBeInTheDocument();

    if (videoElement) {
      // Set initial dimensions
      vi.spyOn(videoElement, 'getBoundingClientRect').mockReturnValue({
        width: 640,
        height: 360,
        top: 0,
        left: 0,
        right: 640,
        bottom: 360,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect);

      // Trigger initial ResizeObserver
      triggerResizeObserver(videoElement, { width: 640, height: 360 });

      // Wait for initial overlay render
      await waitFor(() => {
        const poseOverlay = container.querySelector('svg.pointer-events-none.absolute.inset-0');
        expect(poseOverlay).toBeInTheDocument();
        expect(poseOverlay).toHaveAttribute('width', '640');
        expect(poseOverlay).toHaveAttribute('height', '360');
      });

      // Now simulate resize - update the mock
      vi.spyOn(videoElement, 'getBoundingClientRect').mockReturnValue({
        width: 1920,
        height: 1080,
        top: 0,
        left: 0,
        right: 1920,
        bottom: 1080,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect);

      // Trigger resize observer callback again
      triggerResizeObserver(videoElement, { width: 1920, height: 1080 });

      // Wait for overlay to update
      await waitFor(() => {
        const updatedOverlay = container.querySelector('svg.pointer-events-none.absolute.inset-0');
        expect(updatedOverlay).toHaveAttribute('width', '1920');
        expect(updatedOverlay).toHaveAttribute('height', '1080');
      });
    }
  });

  it('should scale landmark positions based on display/camera ratio', async () => {
    // This test verifies the scaling calculation is correct

    const mockStream = new MinimalMediaStream();
    const mockAnalysis = createMockWithKnownCoordinates({
      shoulderX: 0.25, // 25% from left
      shoulderY: 0.75, // 75% from top
      cameraDimensions: { width: 1920, height: 1080 },
      displayDimensions: { width: 960, height: 540 }, // 50% scale
    });

    // Add stream to enable video rendering
    mockAnalysis.camera.stream = mockStream;

    vi.mocked(useSquatAnalysis).mockReturnValue(mockAnalysis);

    const { container } = render(<ActiveAnalysisScreen />);

    // Get the video element
    const videoElement = container.querySelector('video');
    expect(videoElement).toBeInTheDocument();

    if (videoElement) {
      // Mock the video element's dimensions
      vi.spyOn(videoElement, 'getBoundingClientRect').mockReturnValue({
        width: 960,
        height: 540,
        top: 0,
        left: 0,
        right: 960,
        bottom: 540,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect);

      // Trigger ResizeObserver callback
      triggerResizeObserver(videoElement, { width: 960, height: 540 });
    }

    // Wait for the overlay to render
    await waitFor(() => {
      const poseOverlay = container.querySelector('svg.pointer-events-none.absolute.inset-0');
      expect(poseOverlay).toBeInTheDocument();
    });

    const poseOverlay = container.querySelector('svg.pointer-events-none.absolute.inset-0')!;

    // Expected positions after scaling:
    // X: 0.25 * 960 = 240px
    // Y: 0.75 * 540 = 405px
    const shoulderLandmark = findLandmarkByPosition(poseOverlay as HTMLElement, 240, 405);

    expect(shoulderLandmark).toBeInTheDocument();
  });
});
