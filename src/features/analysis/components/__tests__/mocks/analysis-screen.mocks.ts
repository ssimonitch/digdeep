import { vi } from 'vitest';

import {
  createDefaultLandmarks,
  createMockLandmark,
  createMockPoseResult,
  LANDMARK_INDICES,
  SQUAT_FIXTURES,
} from '@/features/pose-detection/__tests__/pose-detection/fixtures/landmark-fixtures';
// Import mocks we need
import { createMockVideoElement } from '@/features/pose-detection/__tests__/pose-detection/mocks/mediapipe-mocks';
import type { UseSquatAnalysisReturn } from '@/features/pose-detection/hooks/useSquatAnalysis';
// Removed MockMediaStream import - using null for jsdom compatibility

// Re-export for convenience
export {
  createDefaultLandmarks,
  createMockLandmark,
  createMockPoseResult,
  createMockVideoElement,
  LANDMARK_INDICES,
  SQUAT_FIXTURES,
};

// Create mock SquatMetrics
const createMockSquatMetrics = () => ({
  hasValidSquatPose: true,
  keyLandmarkVisibility: {
    hips: 0.9,
    knees: 0.9,
    ankles: 0.85,
    shoulders: 0.95,
  },
  jointAngles: {
    leftKneeAngle: 90,
    rightKneeAngle: 90,
    leftHipAngle: 90,
    rightHipAngle: 90,
    averageKneeAngle: 90,
  },
  barPosition: {
    shoulderMidpoint: { x: 0.5, y: 0.25, z: 0 },
    isValidBarPosition: true,
  },
  balance: {
    lateralDeviation: 0.5,
    isBalanced: true,
    shiftHistory: [0.5, 0.4, 0.5],
    maxLateralShift: 0.5,
    maxShiftDepth: 45,
  },
  depth: {
    hipKneeRatio: 0.45,
    hasAchievedDepth: false,
    depthPercentage: 45,
    depthThreshold: 90,
  },
  barPath: {
    currentPosition: { x: 0.5, y: 0.4, z: 0 },
    history: [],
    verticalDeviation: 2.1,
    maxDeviation: 2.1,
    startingPosition: { x: 0.5, y: 0.25, z: 0 },
  },
  repCounting: {
    currentRep: {
      phase: 'descending' as const,
      startTime: Date.now() - 2000,
      maxDepth: 45,
      maxLateralShift: 0.5,
      barPathDeviation: 2.1,
      isValid: true,
    },
    completedReps: [],
    phase: 'descending' as const,
    repCount: 1,
  },
});

// Mock useSquatAnalysis hook factory
export const createMockUseSquatAnalysis = (
  overrides: Partial<UseSquatAnalysisReturn> = {},
): UseSquatAnalysisReturn => ({
  analysis: null,
  metrics: {
    depthPercentage: 0,
    depthAchieved: false,
    lateralShift: 0,
    isBalanced: true,
    barPathDeviation: 0,
    currentRep: 0,
    repPhase: 'standing',
    confidence: 0,
    isValidPose: false,
  },
  isAnalyzing: false,
  isInitialized: false,
  startAnalysis: vi.fn().mockResolvedValue(undefined),
  stopAnalysis: vi.fn(),
  resetSession: vi.fn(),
  fps: 0,
  processingTime: 0,
  camera: {
    stream: null,
    isActive: false,
    permission: { granted: false, pending: false },
    error: undefined,
    config: {
      width: 640,
      height: 480,
      frameRate: 30,
      facingMode: 'environment',
    },
  },
  error: undefined,
  ...overrides,
});

// Preset: Analysis with valid landmarks (direct array structure)
export const mockAnalysisWithDirectLandmarks = () => {
  const landmarks = createDefaultLandmarks();
  // Create a mock MediaStream for testing
  const mockStream = new MediaStream();

  return createMockUseSquatAnalysis({
    isAnalyzing: true,
    isInitialized: true,
    analysis: {
      landmarks: createMockPoseResult(landmarks), // Proper PoseLandmarkerResult
      confidence: 0.9,
      isValid: true,
      timestamp: Date.now(),
      processingTime: 25,
      squatMetrics: createMockSquatMetrics(),
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
      isValidPose: true,
    },
    fps: 30,
    processingTime: 25,
    camera: {
      stream: mockStream,
      isActive: true,
      permission: { granted: true, pending: false },
      error: undefined,
      config: {
        width: 640,
        height: 480,
        frameRate: 30,
        facingMode: 'environment',
      },
    },
  });
};

// Preset: Analysis with nested landmarks structure
export const mockAnalysisWithNestedLandmarks = () => {
  const landmarks = createDefaultLandmarks();
  // Create a mock MediaStream for testing
  const mockStream = new MediaStream();

  return createMockUseSquatAnalysis({
    isAnalyzing: true,
    isInitialized: true,
    analysis: {
      landmarks: createMockPoseResult(landmarks), // Same structure, properly typed
      confidence: 0.9,
      isValid: true,
      timestamp: Date.now(),
      processingTime: 25,
      squatMetrics: createMockSquatMetrics(),
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
      isValidPose: true,
    },
    fps: 30,
    processingTime: 25,
    camera: {
      stream: mockStream,
      isActive: true,
      permission: { granted: true, pending: false },
      error: undefined,
      config: {
        width: 640,
        height: 480,
        frameRate: 30,
        facingMode: 'environment',
      },
    },
  });
};

// Preset: Camera ready but not analyzing
export const mockCameraReadyNotAnalyzing = () => {
  // Create a mock MediaStream for testing
  const mockStream = new MediaStream();

  return createMockUseSquatAnalysis({
    isAnalyzing: false,
    isInitialized: true,
    camera: {
      stream: mockStream,
      isActive: true,
      permission: { granted: true, pending: false },
      error: undefined,
      config: {
        width: 640,
        height: 480,
        frameRate: 30,
        facingMode: 'environment',
      },
    },
  });
};

// Preset: Error state
export const mockAnalysisError = (errorMessage = 'Failed to initialize pose detection') =>
  createMockUseSquatAnalysis({
    isAnalyzing: false,
    isInitialized: false,
    error: errorMessage,
    camera: {
      stream: null,
      isActive: false,
      permission: { granted: false, pending: false },
      error: errorMessage,
      config: {
        width: 640,
        height: 480,
        frameRate: 30,
        facingMode: 'environment',
      },
    },
  });

// Preset: Permission pending
export const mockPermissionPending = () =>
  createMockUseSquatAnalysis({
    isAnalyzing: false,
    isInitialized: false,
    camera: {
      stream: null,
      isActive: false,
      permission: { granted: false, pending: true },
      error: undefined,
      config: {
        width: 640,
        height: 480,
        frameRate: 30,
        facingMode: 'environment',
      },
    },
  });

// Preset: Low confidence pose
export const mockLowConfidencePose = () => {
  const landmarks = createDefaultLandmarks();
  // Set some landmarks to low visibility
  landmarks[LANDMARK_INDICES.LEFT_HIP].visibility = 0.3;
  landmarks[LANDMARK_INDICES.RIGHT_HIP].visibility = 0.4;
  landmarks[LANDMARK_INDICES.LEFT_KNEE].visibility = 0.2;

  // Create a mock MediaStream for testing
  const mockStream = new MediaStream();

  return createMockUseSquatAnalysis({
    isAnalyzing: true,
    isInitialized: true,
    analysis: {
      landmarks: createMockPoseResult(landmarks), // Proper PoseLandmarkerResult
      confidence: 0.4,
      isValid: false,
      timestamp: Date.now(),
      processingTime: 30,
      squatMetrics: {
        ...createMockSquatMetrics(),
        hasValidSquatPose: false,
        keyLandmarkVisibility: {
          hips: 0.35,
          knees: 0.2,
          ankles: 0.85,
          shoulders: 0.95,
        },
      },
    },
    metrics: {
      depthPercentage: 0,
      depthAchieved: false,
      lateralShift: 0,
      isBalanced: true,
      barPathDeviation: 0,
      currentRep: 0,
      repPhase: 'standing',
      confidence: 0.4,
      isValidPose: false,
    },
    fps: 28,
    processingTime: 30,
    camera: {
      stream: mockStream,
      isActive: true,
      permission: { granted: true, pending: false },
      error: undefined,
      config: {
        width: 640,
        height: 480,
        frameRate: 30,
        facingMode: 'environment',
      },
    },
  });
};
