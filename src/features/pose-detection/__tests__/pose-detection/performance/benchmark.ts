import type { NormalizedLandmark, PoseLandmarkerResult } from '@mediapipe/tasks-vision';

/**
 * Performance benchmarking utilities for pose detection
 * Ensures real-time performance requirements are met (30 FPS = 33ms max per frame)
 */

export interface BenchmarkResult {
  operationName: string;
  averageTime: number;
  minTime: number;
  maxTime: number;
  iterations: number;
  passedThreshold: boolean;
  threshold: number;
  samples: number[];
}

export interface PerformanceMetrics {
  frameProcessingTime: number;
  calculationTime: number;
  validationTime: number;
  totalTime: number;
  memoryUsage?: number;
}

/**
 * High-precision performance timer for benchmarking
 */
export class PerformanceBenchmark {
  private startTime = 0;
  private samples: number[] = [];

  /**
   * Start timing an operation
   */
  start(): void {
    this.startTime = performance.now();
  }

  /**
   * Stop timing and record the duration
   * @returns Duration in milliseconds
   */
  stop(): number {
    if (this.startTime === 0) {
      throw new Error('Benchmark not started. Call start() first.');
    }

    const duration = performance.now() - this.startTime;
    this.samples.push(duration);
    this.startTime = 0;
    return duration;
  }

  /**
   * Get performance statistics from recorded samples
   * @param threshold Maximum acceptable time in milliseconds
   * @returns Benchmark results
   */
  getResults(operationName: string, threshold = 33): BenchmarkResult {
    if (this.samples.length === 0) {
      throw new Error('No samples recorded. Run some benchmarks first.');
    }

    const averageTime = this.samples.reduce((sum, time) => sum + time, 0) / this.samples.length;
    const minTime = Math.min(...this.samples);
    const maxTime = Math.max(...this.samples);
    const passedThreshold = averageTime <= threshold;

    return {
      operationName,
      averageTime,
      minTime,
      maxTime,
      iterations: this.samples.length,
      passedThreshold,
      threshold,
      samples: [...this.samples],
    };
  }

  /**
   * Clear all recorded samples
   */
  reset(): void {
    this.samples = [];
    this.startTime = 0;
  }

  /**
   * Get current sample count
   */
  getSampleCount(): number {
    return this.samples.length;
  }
}

/**
 * Benchmark a function multiple times and return statistics
 * @param fn Function to benchmark
 * @param iterations Number of iterations to run
 * @param operationName Name for the operation being benchmarked
 * @param threshold Maximum acceptable time in milliseconds (default: 33ms for 30 FPS)
 * @returns Benchmark results
 */
export function benchmarkFunction<T extends unknown[], R>(
  fn: (...args: T) => R,
  args: T,
  iterations = 100,
  operationName = 'function',
  threshold = 33,
): BenchmarkResult {
  const benchmark = new PerformanceBenchmark();

  // Warm up (don't record these)
  for (let i = 0; i < 10; i++) {
    fn(...args);
  }

  // Record actual benchmarks
  for (let i = 0; i < iterations; i++) {
    benchmark.start();
    fn(...args);
    benchmark.stop();
  }

  return benchmark.getResults(operationName, threshold);
}

/**
 * Benchmark an async function multiple times
 * @param fn Async function to benchmark
 * @param iterations Number of iterations to run
 * @param operationName Name for the operation being benchmarked
 * @param threshold Maximum acceptable time in milliseconds
 * @returns Benchmark results
 */
export async function benchmarkAsyncFunction<T extends unknown[], R>(
  fn: (...args: T) => Promise<R>,
  args: T,
  iterations = 100,
  operationName = 'async function',
  threshold = 33,
): Promise<BenchmarkResult> {
  const benchmark = new PerformanceBenchmark();

  // Warm up
  for (let i = 0; i < 10; i++) {
    await fn(...args);
  }

  // Record benchmarks
  for (let i = 0; i < iterations; i++) {
    benchmark.start();
    await fn(...args);
    benchmark.stop();
  }

  return benchmark.getResults(operationName, threshold);
}

/**
 * Create performance test data that simulates realistic pose detection workloads
 * @param complexity Level of complexity ('simple' | 'realistic' | 'stress')
 * @returns Mock pose data for benchmarking
 */
export function createPerformanceTestData(complexity: 'simple' | 'realistic' | 'stress' = 'realistic'): {
  landmarks: NormalizedLandmark[];
  poseResult: PoseLandmarkerResult;
  landmarkHistory: NormalizedLandmark[][];
} {
  const createLandmark = (x: number, y: number, z = 0, visibility = 0.9): NormalizedLandmark => ({
    x,
    y,
    z,
    visibility,
  });

  // Generate 33 landmarks (standard MediaPipe pose)
  const landmarks: NormalizedLandmark[] = [];

  switch (complexity) {
    case 'simple':
      // Simple case - all landmarks at default positions
      for (let i = 0; i < 33; i++) {
        landmarks.push(createLandmark(0.5, 0.5, 0, 1.0));
      }
      break;

    case 'realistic':
      // Realistic case - varied positions and confidence levels
      for (let i = 0; i < 33; i++) {
        const x = 0.3 + Math.random() * 0.4; // Between 0.3 and 0.7
        const y = 0.2 + Math.random() * 0.6; // Between 0.2 and 0.8
        const z = (Math.random() - 0.5) * 0.2; // Between -0.1 and 0.1
        const visibility = 0.5 + Math.random() * 0.5; // Between 0.5 and 1.0
        landmarks.push(createLandmark(x, y, z, visibility));
      }
      break;

    case 'stress':
      // Stress test - maximum variation and some low-confidence landmarks
      for (let i = 0; i < 33; i++) {
        const x = Math.random(); // Full range 0-1
        const y = Math.random(); // Full range 0-1
        const z = (Math.random() - 0.5) * 0.5; // Between -0.25 and 0.25
        const visibility = Math.random(); // Full range 0-1 (including very low confidence)
        landmarks.push(createLandmark(x, y, z, visibility));
      }
      break;
  }

  const poseResult: PoseLandmarkerResult = {
    landmarks: [landmarks],
    worldLandmarks: [landmarks],
    segmentationMasks: undefined,
    close: () => {
      // Do nothing
    },
  };

  // Generate landmark history for bar path tracking tests
  const historyLength = complexity === 'stress' ? 100 : complexity === 'realistic' ? 50 : 10;
  const landmarkHistory: NormalizedLandmark[][] = [];

  for (let frame = 0; frame < historyLength; frame++) {
    const frameVariation = frame * 0.01; // Small progressive change
    const frameLandmarks = landmarks.map((landmark) => ({
      ...landmark,
      y: landmark.y + frameVariation,
      x: landmark.x + (Math.random() - 0.5) * 0.002, // Small random noise
    }));
    landmarkHistory.push(frameLandmarks);
  }

  return { landmarks, poseResult, landmarkHistory };
}

/**
 * Validate that benchmark results meet performance requirements
 * @param results Array of benchmark results to validate
 * @param strict If true, all operations must pass. If false, allows some flexibility
 * @returns Performance validation report
 */
export function validatePerformanceResults(
  results: BenchmarkResult[],
  strict = true,
): {
  passed: boolean;
  report: string;
  failedOperations: string[];
  totalOperations: number;
} {
  const failedOperations: string[] = [];
  const totalOperations = results.length;

  results.forEach((result) => {
    if (!result.passedThreshold) {
      failedOperations.push(`${result.operationName}: ${result.averageTime.toFixed(2)}ms (max: ${result.threshold}ms)`);
    }
  });

  const passed = strict ? failedOperations.length === 0 : failedOperations.length <= Math.ceil(totalOperations * 0.1);

  const report = `
Performance Test Report:
------------------------
Total Operations: ${totalOperations}
Passed: ${totalOperations - failedOperations.length}
Failed: ${failedOperations.length}
Mode: ${strict ? 'Strict' : 'Flexible (90% pass rate)'}
Result: ${passed ? 'PASSED' : 'FAILED'}

${failedOperations.length > 0 ? 'Failed Operations:\n' + failedOperations.map((op) => `  - ${op}`).join('\n') : 'All operations passed performance requirements.'}

Individual Results:
${results
  .map(
    (r) =>
      `  ${r.operationName}: ${r.averageTime.toFixed(2)}ms avg (${r.minTime.toFixed(2)}-${r.maxTime.toFixed(2)}ms) [${r.passedThreshold ? 'PASS' : 'FAIL'}]`,
  )
  .join('\n')}
  `.trim();

  return {
    passed,
    report,
    failedOperations,
    totalOperations,
  };
}

/**
 * Memory usage monitoring for performance tests
 */
export class MemoryMonitor {
  private initialMemory: number;

  constructor() {
    this.initialMemory = this.getCurrentMemoryUsage();
  }

  /**
   * Get current memory usage (if available in environment)
   */
  private getCurrentMemoryUsage(): number {
    if (typeof performance !== 'undefined' && 'memory' in performance) {
      return (performance.memory as { usedJSHeapSize: number }).usedJSHeapSize;
    }
    return 0;
  }

  /**
   * Get memory usage delta since monitor creation
   */
  getMemoryDelta(): number {
    return this.getCurrentMemoryUsage() - this.initialMemory;
  }

  /**
   * Check if memory usage is within acceptable limits
   * @param maxIncreaseMB Maximum acceptable memory increase in MB
   */
  isWithinLimits(maxIncreaseMB = 50): boolean {
    const deltaBytes = this.getMemoryDelta();
    const deltaMB = deltaBytes / (1024 * 1024);
    return deltaMB <= maxIncreaseMB;
  }
}

/**
 * Frame rate calculator for continuous performance monitoring
 */
export class FrameRateMonitor {
  private frameTimes: number[] = [];
  private lastFrameTime = 0;
  private maxSamples: number;

  constructor(maxSamples = 60) {
    this.maxSamples = maxSamples;
  }

  /**
   * Record a frame completion
   */
  recordFrame(): void {
    const now = performance.now();

    if (this.lastFrameTime > 0) {
      const frameTime = now - this.lastFrameTime;
      this.frameTimes.push(frameTime);

      // Keep only recent samples
      if (this.frameTimes.length > this.maxSamples) {
        this.frameTimes.shift();
      }
    }

    this.lastFrameTime = now;
  }

  /**
   * Get current average frame rate
   */
  getAverageFPS(): number {
    if (this.frameTimes.length === 0) return 0;

    const avgFrameTime = this.frameTimes.reduce((sum, time) => sum + time, 0) / this.frameTimes.length;
    return 1000 / avgFrameTime;
  }

  /**
   * Check if frame rate meets target (30 FPS minimum)
   */
  meetsTarget(targetFPS = 30): boolean {
    return this.getAverageFPS() >= targetFPS;
  }

  /**
   * Reset monitoring
   */
  reset(): void {
    this.frameTimes = [];
    this.lastFrameTime = 0;
  }
}
