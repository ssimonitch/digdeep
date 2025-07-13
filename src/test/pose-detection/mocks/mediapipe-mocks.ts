/**
 * Mock MediaPipe classes for isolated testing
 * These mocks enable testing without loading actual MediaPipe resources
 */

import type { NormalizedLandmark, PoseLandmarkerOptions, PoseLandmarkerResult } from '@mediapipe/tasks-vision';

import { createMockPoseResult } from '../fixtures/landmark-fixtures';

/**
 * Configuration for controlling mock behavior
 */
export interface MockMediaPipeConfig {
  shouldFail?: boolean;
  failureMessage?: string;
  processingDelay?: number;
  customResult?: PoseLandmarkerResult;
  detectForVideoCallCount?: number;
  initializationDelay?: number;
  shouldFailInit?: boolean;
  initFailureMessage?: string;
}

/**
 * Global configuration for all mock instances
 */
let globalMockConfig: MockMediaPipeConfig = {};

/**
 * Set global mock configuration
 */
export function setMockMediaPipeConfig(config: MockMediaPipeConfig): void {
  globalMockConfig = { ...config };
}

/**
 * Reset mock configuration to defaults
 */
export function resetMockMediaPipeConfig(): void {
  globalMockConfig = {};
  MockPoseLandmarker.resetCallCounts();
}

/**
 * Mock vision module returned by FilesetResolver
 */
export interface MockVisionModule {
  wasmLoaderPath: string;
  wasmBinaryPath: string;
  assetLoaderPath: string;
}

/**
 * Mock FilesetResolver for loading MediaPipe resources
 */
export class MockFilesetResolver {
  static async forVisionTasks(wasmPath: string): Promise<MockVisionModule> {
    if (globalMockConfig.shouldFailInit) {
      throw new Error(globalMockConfig.initFailureMessage ?? 'Failed to load WASM resources');
    }

    // Simulate initialization delay
    if (globalMockConfig.initializationDelay) {
      await new Promise((resolve) => setTimeout(resolve, globalMockConfig.initializationDelay));
    }

    return {
      wasmLoaderPath: `${wasmPath}/vision_wasm_internal.js`,
      wasmBinaryPath: `${wasmPath}/vision_wasm_internal.wasm`,
      assetLoaderPath: `${wasmPath}/vision_wasm_internal.data`,
    };
  }
}

/**
 * Mock PoseLandmarker for pose detection
 */
export class MockPoseLandmarker {
  private static instances: MockPoseLandmarker[] = [];
  private static detectForVideoCallCount = 0;
  private static createFromOptionsCallCount = 0;

  private isClosed = false;
  private options: PoseLandmarkerOptions;

  constructor(options: PoseLandmarkerOptions) {
    this.options = options;
    MockPoseLandmarker.instances.push(this);
  }

  /**
   * Mock createFromOptions factory method
   */
  static async createFromOptions(
    vision: MockVisionModule,
    options: PoseLandmarkerOptions,
  ): Promise<MockPoseLandmarker> {
    MockPoseLandmarker.createFromOptionsCallCount++;

    if (globalMockConfig.shouldFailInit) {
      throw new Error(globalMockConfig.initFailureMessage ?? 'Failed to create PoseLandmarker');
    }

    // Simulate initialization delay
    if (globalMockConfig.initializationDelay) {
      await new Promise((resolve) => setTimeout(resolve, globalMockConfig.initializationDelay));
    }

    return new MockPoseLandmarker(options);
  }

  /**
   * Mock detectForVideo method
   */
  detectForVideo(videoElement: HTMLVideoElement, timestamp: number): PoseLandmarkerResult {
    MockPoseLandmarker.detectForVideoCallCount++;

    if (this.isClosed) {
      throw new Error('PoseLandmarker is closed');
    }

    if (globalMockConfig.shouldFail) {
      throw new Error(globalMockConfig.failureMessage ?? 'Detection failed');
    }

    // Simulate processing delay
    if (globalMockConfig.processingDelay) {
      const start = performance.now();
      while (performance.now() - start < globalMockConfig.processingDelay) {
        // Busy wait to simulate processing
      }
    }

    // Return custom result if provided
    if (globalMockConfig.customResult) {
      return globalMockConfig.customResult;
    }

    // Generate default mock result
    const landmarks = this.generateMockLandmarks(timestamp);
    return createMockPoseResult(landmarks);
  }

  /**
   * Mock close method
   */
  close(): void {
    if (this.isClosed) {
      throw new Error('PoseLandmarker already closed');
    }
    this.isClosed = true;

    // Remove from instances
    const index = MockPoseLandmarker.instances.indexOf(this);
    if (index > -1) {
      MockPoseLandmarker.instances.splice(index, 1);
    }
  }

  /**
   * Generate mock landmarks based on timestamp for variation
   */
  private generateMockLandmarks(timestamp: number): NormalizedLandmark[] {
    const landmarks: NormalizedLandmark[] = [];
    const baseX = 0.5;
    const baseY = 0.5;

    // Generate 33 landmarks with slight variations based on timestamp
    for (let i = 0; i < 33; i++) {
      const phase = timestamp / 1000 + (i * Math.PI) / 16;
      const variation = Math.sin(phase) * 0.1;
      const angle = i * 0.5 + timestamp / 5000; // Add timestamp to angle for variation
      landmarks.push({
        x: baseX + variation * Math.cos(angle),
        y: baseY + variation * Math.sin(angle),
        z: variation * 0.5,
        visibility: 0.8 + Math.random() * 0.2, // 0.8-1.0 visibility
      });
    }

    return landmarks;
  }

  /**
   * Get current options
   */
  getOptions(): PoseLandmarkerOptions {
    return { ...this.options };
  }

  /**
   * Check if landmarker is closed
   */
  getIsClosed(): boolean {
    return this.isClosed;
  }

  /**
   * Static methods for testing
   */
  static getInstances(): MockPoseLandmarker[] {
    return [...MockPoseLandmarker.instances];
  }

  static getDetectForVideoCallCount(): number {
    return MockPoseLandmarker.detectForVideoCallCount;
  }

  static getCreateFromOptionsCallCount(): number {
    return MockPoseLandmarker.createFromOptionsCallCount;
  }

  static resetCallCounts(): void {
    MockPoseLandmarker.detectForVideoCallCount = 0;
    MockPoseLandmarker.createFromOptionsCallCount = 0;
  }

  static closeAll(): void {
    // Create a copy of the array to avoid modification during iteration
    const instancesToClose = [...MockPoseLandmarker.instances];
    instancesToClose.forEach((instance) => {
      if (!instance.isClosed) {
        instance.close();
      }
    });
  }
}

/**
 * Mock HTMLVideoElement for testing
 */
export class MockHTMLVideoElement {
  public videoWidth: number;
  public videoHeight: number;
  public readyState: number;
  public currentTime: number;
  public paused: boolean;
  public ended: boolean;
  public src: string;
  public srcObject: MediaStream | null;

  constructor(
    width = 640,
    height = 480,
    readyState = 4, // HAVE_ENOUGH_DATA
  ) {
    this.videoWidth = width;
    this.videoHeight = height;
    this.readyState = readyState;
    this.currentTime = 0;
    this.paused = false;
    this.ended = false;
    this.src = '';
    this.srcObject = null;
  }

  play(): Promise<void> {
    this.paused = false;
    return Promise.resolve();
  }

  pause(): void {
    this.paused = true;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  addEventListener(_event: string, _handler: EventListener): void {
    // Mock implementation
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  removeEventListener(_event: string, _handler: EventListener): void {
    // Mock implementation
  }
}

/**
 * Create a mock video element with specific properties
 */
export function createMockVideoElement(width = 640, height = 480, readyState = 4): HTMLVideoElement {
  return new MockHTMLVideoElement(width, height, readyState) as unknown as HTMLVideoElement;
}

/**
 * Mock MediaPipe module for dynamic imports
 */
export const mockMediaPipeModule = {
  PoseLandmarker: MockPoseLandmarker,
  FilesetResolver: MockFilesetResolver,
};

/**
 * Helper to replace MediaPipe imports in tests
 */
export function setupMediaPipeMocks(): void {
  // This would be used with module mocking in the test framework
  // For example, with Vitest:
  // vi.mock('@mediapipe/tasks-vision', () => mockMediaPipeModule);
}

/**
 * Utility to create a failed detection result
 */
export function createFailedDetectionResult(): PoseLandmarkerResult {
  return {
    landmarks: [],
    worldLandmarks: [],
    segmentationMasks: undefined,
    close: () => {
      // Do nothing
    },
  };
}

/**
 * Utility to create a low confidence detection result
 */
export function createLowConfidenceResult(): PoseLandmarkerResult {
  const landmarks: NormalizedLandmark[] = [];

  // Create landmarks with very low visibility
  for (let i = 0; i < 33; i++) {
    landmarks.push({
      x: Math.random(),
      y: Math.random(),
      z: Math.random() - 0.5,
      visibility: Math.random() * 0.3, // 0-0.3 visibility
    });
  }

  return createMockPoseResult(landmarks);
}

/**
 * Utility to create a partial detection result (missing landmarks)
 */
export function createPartialDetectionResult(landmarkCount = 15): PoseLandmarkerResult {
  const landmarks: NormalizedLandmark[] = [];

  // Create only partial landmarks
  for (let i = 0; i < landmarkCount; i++) {
    landmarks.push({
      x: 0.5 + (Math.random() - 0.5) * 0.2,
      y: 0.5 + (Math.random() - 0.5) * 0.2,
      z: 0,
      visibility: 0.8 + Math.random() * 0.2,
    });
  }

  return createMockPoseResult(landmarks);
}
