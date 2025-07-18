import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

import type { SquatMetrics } from '@/features/pose-detection';
import {
  createMockLandmark,
  createMockPoseResult,
} from '@/features/pose-detection/__tests__/pose-detection/fixtures/landmark-fixtures';
import type { UseSquatAnalysisReturn } from '@/features/pose-detection/hooks/useSquatAnalysis';

import { createMockUseSquatAnalysis } from './analysis-screen.mocks';

/**
 * Coordinate Transformation Mock Utilities
 * These mocks are specifically designed to test coordinate transformation
 * between camera space and display space in pose analysis components
 */

/**
 * Creates mock analysis data with known coordinate positions
 * Used to test coordinate transformation between camera and display dimensions
 */
export const createMockWithKnownCoordinates = (params: {
  shoulderX: number;
  shoulderY: number;
  cameraDimensions?: { width: number; height: number };
  displayDimensions?: { width: number; height: number };
}): UseSquatAnalysisReturn => {
  const landmarks: NormalizedLandmark[] = Array(33)
    .fill(null)
    .map((_, index) =>
      createMockLandmark(
        index === 11 || index === 12 ? params.shoulderX : 0.5,
        index === 11 || index === 12 ? params.shoulderY : 0.5,
        0,
        0.9,
      ),
    );

  return createMockUseSquatAnalysis({
    isAnalyzing: true,
    isInitialized: true,
    analysis: {
      landmarks: createMockPoseResult(landmarks),
      confidence: 0.9,
      isValid: true,
      timestamp: Date.now(),
      processingTime: 25,
      squatMetrics: {} as SquatMetrics, // Not relevant for coordinate tests
    },
    metrics: {
      depthPercentage: 45,
      depthAchieved: false,
      lateralShift: 0.5,
      isBalanced: true,
      barPathDeviation: 2.1,
      currentRep: 1,
      repPhase: 'descending',
      confidence: 0.9,
      isValidPose: true, // This is important for rendering
    },
    camera: {
      stream: null,
      isActive: true,
      permission: { granted: true, pending: false },
      error: undefined,
      config: {
        width: params.cameraDimensions?.width ?? 1280,
        height: params.cameraDimensions?.height ?? 720,
        frameRate: 30,
        facingMode: 'environment',
      },
    },
  });
};

/**
 * Creates landmarks with specific hip positions
 * Used to reproduce extreme depth calculation bug
 */
export const createLandmarksWithHipPosition = (hipYPosition: number): NormalizedLandmark[] => {
  return Array(33)
    .fill(null)
    .map((_, index) => {
      // Set hip positions (23, 24)
      if (index === 23 || index === 24) {
        return createMockLandmark(0.5, hipYPosition, 0, 0.9);
      }
      // Set knee positions (25, 26) below hips - slightly forward for realistic angle
      if (index === 25 || index === 26) {
        return createMockLandmark(0.55, hipYPosition + 0.2, 0, 0.9); // Moved forward to create angle
      }
      // Set ankle positions (27, 28) below knees - vertical from knees
      if (index === 27 || index === 28) {
        return createMockLandmark(0.55, hipYPosition + 0.4, 0, 0.9); // Keep aligned with knees
      }
      // Set shoulder positions (11, 12) above hips
      if (index === 11 || index === 12) {
        return createMockLandmark(0.5, hipYPosition - 0.2, 0, 0.9);
      }
      // Default positions for other landmarks
      return createMockLandmark(0.5, 0.5, 0, 0.9);
    });
};

/**
 * Creates mock analysis with invalid pose but metrics still calculated
 * Used to reproduce valid pose gating bug
 */
export const createMockAnalysisWithInvalidPose = (params: {
  isValidPose: boolean;
  landmarks: NormalizedLandmark[] | null;
  depthPercentage: number;
  confidence?: number;
}): UseSquatAnalysisReturn => {
  return createMockUseSquatAnalysis({
    isAnalyzing: true,
    isInitialized: true,
    analysis: params.landmarks
      ? {
          landmarks: createMockPoseResult(params.landmarks),
          confidence: params.confidence ?? 0.3,
          isValid: params.isValidPose,
          timestamp: Date.now(),
          processingTime: 25,
          squatMetrics: {
            hasValidSquatPose: params.isValidPose,
            depth: {
              depthPercentage: params.depthPercentage, // Bug: This gets calculated even when pose is invalid
              hipKneeRatio: 0,
              hasAchievedDepth: false,
              depthThreshold: 90,
            },
          } as SquatMetrics,
        }
      : null,
    metrics: {
      depthPercentage: params.depthPercentage, // Bug: Shows extreme values
      depthAchieved: false,
      lateralShift: 0,
      isBalanced: true,
      barPathDeviation: 0,
      currentRep: 0,
      repPhase: 'standing',
      confidence: params.confidence ?? 0.3,
      isValidPose: params.isValidPose,
    },
    fps: 30,
    processingTime: 25,
  });
};

/**
 * Mock video element with ResizeObserver support
 */
export const createMockVideoElementWithResize = () => {
  const mockVideoElement = document.createElement('video');
  Object.defineProperty(mockVideoElement, 'videoWidth', {
    writable: true,
    value: 1280,
  });
  Object.defineProperty(mockVideoElement, 'videoHeight', {
    writable: true,
    value: 720,
  });

  // Mock offsetWidth/offsetHeight for display dimensions
  Object.defineProperty(mockVideoElement, 'offsetWidth', {
    writable: true,
    value: 640,
  });
  Object.defineProperty(mockVideoElement, 'offsetHeight', {
    writable: true,
    value: 360,
  });

  return mockVideoElement;
};
