import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';

export interface PoseDetectionResult {
  landmarks: { x: number; y: number; z: number; visibility?: number }[];
  worldLandmarks: { x: number; y: number; z: number; visibility?: number }[];
  timestamp: number;
  processingTime: number;
}

export interface PerformanceStats {
  fps: number;
  avgProcessingTime: number;
  frameCount: number;
  successRate: number;
  errorCount: number;
}

export interface TestCallbacks {
  onProgress?: (progress: number) => void;
  onStatsUpdate?: (stats: PerformanceStats) => void;
  onComplete?: (passed: boolean, stats: PerformanceStats) => void;
  onError?: (error: string) => void;
}

export class MediaPipePOC {
  private poseLandmarker: PoseLandmarker | null = null;
  private isInitialized = false;
  private isRunning = false;
  private lastFrameTime = 0;
  private frameCount = 0;
  private totalProcessingTime = 0;
  private errorCount = 0;
  private fpsHistory: number[] = [];
  private readonly maxFpsHistory = 30;

  // Test execution state
  private testStartTime = 0;
  private testDuration = 0;
  private testCallbacks: TestCallbacks = {};
  private currentVideoElement: HTMLVideoElement | null = null;
  private animationFrameId: number | null = null;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm',
    );

    this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
        delegate: 'GPU', // Use GPU acceleration
      },
      runningMode: 'VIDEO',
      numPoses: 1, // Only detect one person for performance
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
      outputSegmentationMasks: false, // Disable for better performance
    });

    this.isInitialized = true;
  }

  detectPose(videoElement: HTMLVideoElement, timestamp?: number): PoseDetectionResult | null {
    if (!this.poseLandmarker || !this.isInitialized) {
      throw new Error('MediaPipe not initialized. Call initialize() first.');
    }

    const startTime = performance.now();
    const frameTimestamp = timestamp ?? performance.now();

    try {
      const results = this.poseLandmarker.detectForVideo(videoElement, frameTimestamp);
      const processingTime = performance.now() - startTime;

      this.updatePerformanceStats(processingTime);

      if (results.landmarks && results.landmarks.length > 0) {
        return {
          landmarks: results.landmarks[0],
          worldLandmarks: results.worldLandmarks?.[0] ?? [],
          timestamp: frameTimestamp,
          processingTime,
        };
      }

      return null;
    } catch (error) {
      this.errorCount++;
      throw error;
    }
  }

  getPerformanceStats(): PerformanceStats {
    const avgProcessingTime = this.frameCount > 0 ? this.totalProcessingTime / this.frameCount : 0;
    const currentFps =
      this.fpsHistory.length > 0 ? this.fpsHistory.reduce((sum, fps) => sum + fps, 0) / this.fpsHistory.length : 0;
    const successRate = this.frameCount > 0 ? ((this.frameCount - this.errorCount) / this.frameCount) * 100 : 100;

    return {
      fps: currentFps,
      avgProcessingTime,
      frameCount: this.frameCount,
      successRate,
      errorCount: this.errorCount,
    };
  }

  reset(): void {
    this.frameCount = 0;
    this.totalProcessingTime = 0;
    this.errorCount = 0;
    this.fpsHistory = [];
    this.lastFrameTime = 0;
  }

  startTest(videoElement: HTMLVideoElement, durationSeconds: number, callbacks: TestCallbacks = {}): void {
    if (!this.isInitialized || !this.poseLandmarker) {
      callbacks.onError?.('MediaPipe not initialized. Call initialize() first.');
      return;
    }

    if (this.isRunning) {
      callbacks.onError?.('Test already running. Stop current test first.');
      return;
    }

    this.isRunning = true;
    this.testStartTime = Date.now();
    this.testDuration = durationSeconds * 1000;
    this.testCallbacks = callbacks;
    this.currentVideoElement = videoElement;

    this.reset();
    this.processFrame();
  }

  stopTest(): void {
    this.isRunning = false;
    this.currentVideoElement = null;

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private processFrame = (): void => {
    if (!this.isRunning || !this.currentVideoElement) {
      return;
    }

    const elapsed = Date.now() - this.testStartTime;
    const progress = Math.min((elapsed / this.testDuration) * 100, 100);

    // Report progress for smooth UI updates
    this.testCallbacks.onProgress?.(progress);

    try {
      // Process MediaPipe at maximum speed to measure true performance
      this.detectPose(this.currentVideoElement, performance.now());
      const currentStats = this.getPerformanceStats();
      this.testCallbacks.onStatsUpdate?.(currentStats);
    } catch {
      // Continue processing even if one frame fails
    }

    // Check if test should continue
    if (elapsed < this.testDuration && this.isRunning) {
      this.animationFrameId = requestAnimationFrame(this.processFrame);
    } else {
      // Test complete
      this.completeTest();
    }
  };

  private completeTest(): void {
    const finalStats = this.getPerformanceStats();
    const testPassed = finalStats.fps >= 30 && finalStats.successRate >= 90;

    this.isRunning = false;
    this.currentVideoElement = null;

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    this.testCallbacks.onComplete?.(testPassed, finalStats);
  }

  destroy(): void {
    this.stopTest();

    if (this.poseLandmarker) {
      this.poseLandmarker.close();
      this.poseLandmarker = null;
    }
    this.isInitialized = false;
    this.isRunning = false;
  }

  isReady(): boolean {
    return this.isInitialized && this.poseLandmarker !== null;
  }

  isTestRunning(): boolean {
    return this.isRunning;
  }

  private updatePerformanceStats(processingTime: number): void {
    this.frameCount++;
    this.totalProcessingTime += processingTime;

    const currentTime = performance.now();
    if (this.lastFrameTime > 0) {
      const deltaTime = currentTime - this.lastFrameTime;
      if (deltaTime > 0) {
        const fps = 1000 / deltaTime;
        this.fpsHistory.push(fps);

        if (this.fpsHistory.length > this.maxFpsHistory) {
          this.fpsHistory.shift();
        }
      }
    }
    this.lastFrameTime = currentTime;
  }
}

// Helper function to check if MediaPipe is supported
export function isMediaPipeSupported(): boolean {
  // Check for essential browser features
  const hasWebGL = (() => {
    try {
      const canvas = document.createElement('canvas');
      return !!(canvas.getContext('webgl') ?? canvas.getContext('experimental-webgl'));
    } catch {
      return false;
    }
  })();

  const hasWebAssembly = 'WebAssembly' in window;
  const hasGetUserMedia = !!navigator?.mediaDevices?.getUserMedia;

  return hasWebGL && hasWebAssembly && hasGetUserMedia;
}

// Create singleton instance for testing
export const mediaPipePOC = new MediaPipePOC();
