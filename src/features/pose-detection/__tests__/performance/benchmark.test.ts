/* eslint-disable no-console */
import { beforeEach, describe, expect, it } from 'vitest';

import {
  areLandmarksReliable,
  calculateAngleDegrees,
  calculateDistance,
  calculateMidpoint,
  calculateVerticalDeviation,
} from '../utils/test-utilities';
import {
  benchmarkAsyncFunction,
  benchmarkFunction,
  type BenchmarkResult,
  createPerformanceTestData,
  FrameRateMonitor,
  MemoryMonitor,
  PerformanceBenchmark,
  validatePerformanceResults,
} from './benchmark';

describe('Performance Benchmarking Infrastructure', () => {
  describe('PerformanceBenchmark Class', () => {
    let benchmark: PerformanceBenchmark;

    beforeEach(() => {
      benchmark = new PerformanceBenchmark();
    });

    it('should measure time correctly', () => {
      benchmark.start();

      // Simulate some work
      let result = 0;
      for (let i = 0; i < 1000; i++) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        result += Math.sqrt(i);
      }

      const duration = benchmark.stop();
      expect(duration).toBeGreaterThan(0);
      expect(duration).toBeLessThan(10); // Should be very fast
    });

    it('should accumulate samples correctly', () => {
      // Record multiple samples
      for (let i = 0; i < 5; i++) {
        benchmark.start();
        // Small amount of work
        Math.sqrt(100);
        benchmark.stop();
      }

      expect(benchmark.getSampleCount()).toBe(5);

      const results = benchmark.getResults('test operation', 10);
      expect(results.iterations).toBe(5);
      expect(results.averageTime).toBeGreaterThan(0);
      expect(results.minTime).toBeGreaterThanOrEqual(0);
      expect(results.maxTime).toBeGreaterThanOrEqual(results.minTime);
      expect(results.samples).toHaveLength(5);
    });

    it('should validate threshold correctly', () => {
      benchmark.start();
      benchmark.stop(); // Very fast operation

      const fastResults = benchmark.getResults('fast op', 10);
      expect(fastResults.passedThreshold).toBe(true);

      benchmark.reset();
      benchmark.start();
      // Simulate slow operation
      for (let i = 0; i < 100000; i++) {
        Math.sqrt(i);
      }
      benchmark.stop();

      const slowResults = benchmark.getResults('slow op', 0.1); // Very strict threshold
      expect(slowResults.passedThreshold).toBe(false);
    });

    it('should reset correctly', () => {
      benchmark.start();
      benchmark.stop();
      expect(benchmark.getSampleCount()).toBe(1);

      benchmark.reset();
      expect(benchmark.getSampleCount()).toBe(0);
    });

    it('should throw error when stopping without starting', () => {
      expect(() => benchmark.stop()).toThrow('Benchmark not started');
    });

    it('should throw error when getting results without samples', () => {
      expect(() => benchmark.getResults('test')).toThrow('No samples recorded');
    });
  });

  describe('benchmarkFunction', () => {
    it('should benchmark simple mathematical operations under 1ms', () => {
      const testData = createPerformanceTestData('simple');

      const result = benchmarkFunction(
        calculateDistance,
        [testData.landmarks[0], testData.landmarks[1]],
        100,
        'distance calculation',
        1, // 1ms threshold for simple math
      );

      expect(result.operationName).toBe('distance calculation');
      expect(result.iterations).toBe(100);
      expect(result.averageTime).toBeLessThan(1);
      expect(result.passedThreshold).toBe(true);
    });

    it('should benchmark angle calculations under 2ms', () => {
      const testData = createPerformanceTestData('realistic');

      const result = benchmarkFunction(
        calculateAngleDegrees,
        [testData.landmarks[0], testData.landmarks[1], testData.landmarks[2]],
        100,
        'angle calculation',
        2,
      );

      expect(result.averageTime).toBeLessThan(2);
      expect(result.passedThreshold).toBe(true);
    });

    it('should benchmark complex operations under 5ms', () => {
      const testData = createPerformanceTestData('stress');

      const result = benchmarkFunction(
        calculateVerticalDeviation,
        [testData.landmarks],
        50,
        'vertical deviation calculation',
        5,
      );

      expect(result.averageTime).toBeLessThan(5);
      expect(result.passedThreshold).toBe(true);
    });
  });

  describe('benchmarkAsyncFunction', () => {
    it('should benchmark async operations', async () => {
      const asyncOperation = async (value: number): Promise<number> => {
        // Simulate async work
        await new Promise((resolve) => setTimeout(resolve, 1));
        return Math.sqrt(value);
      };

      const result = await benchmarkAsyncFunction(
        asyncOperation,
        [100],
        10, // Fewer iterations for async test
        'async math operation',
        10, // More lenient threshold for async
      );

      expect(result.operationName).toBe('async math operation');
      expect(result.iterations).toBe(10);
      expect(result.averageTime).toBeGreaterThan(0);
    });
  });

  describe('createPerformanceTestData', () => {
    it('should create simple test data', () => {
      const data = createPerformanceTestData('simple');

      expect(data.landmarks).toHaveLength(33);
      expect(data.poseResult.landmarks[0]).toHaveLength(33);
      expect(data.landmarkHistory).toHaveLength(10);

      // All landmarks should be at center with high confidence
      data.landmarks.forEach((landmark) => {
        expect(landmark.x).toBe(0.5);
        expect(landmark.y).toBe(0.5);
        expect(landmark.visibility).toBe(1.0);
      });
    });

    it('should create realistic test data with variation', () => {
      const data = createPerformanceTestData('realistic');

      expect(data.landmarks).toHaveLength(33);
      expect(data.landmarkHistory).toHaveLength(50);

      // Landmarks should have varied positions and reasonable confidence
      const positions = data.landmarks.map((l) => ({ x: l.x, y: l.y }));
      const uniquePositions = new Set(positions.map((p) => `${p.x},${p.y}`));
      expect(uniquePositions.size).toBeGreaterThan(20); // Should have variation

      data.landmarks.forEach((landmark) => {
        expect(landmark.x).toBeGreaterThanOrEqual(0.3);
        expect(landmark.x).toBeLessThanOrEqual(0.7);
        expect(landmark.visibility).toBeGreaterThanOrEqual(0.5);
      });
    });

    it('should create stress test data with maximum variation', () => {
      const data = createPerformanceTestData('stress');

      expect(data.landmarks).toHaveLength(33);
      expect(data.landmarkHistory).toHaveLength(100);

      // Should have full range variation
      const xValues = data.landmarks.map((l) => l.x);
      const yValues = data.landmarks.map((l) => l.y);
      const visibilityValues = data.landmarks.map((l) => l.visibility);

      expect(Math.max(...xValues)).toBeGreaterThan(0.8);
      expect(Math.min(...xValues)).toBeLessThan(0.2);
      expect(Math.max(...yValues)).toBeGreaterThan(0.8);
      expect(Math.min(...yValues)).toBeLessThan(0.2);
      expect(Math.min(...visibilityValues)).toBeLessThan(0.3);
    });
  });

  describe('validatePerformanceResults', () => {
    it('should validate passing results in strict mode', () => {
      const results: BenchmarkResult[] = [
        {
          operationName: 'fast op 1',
          averageTime: 1.5,
          minTime: 1.0,
          maxTime: 2.0,
          iterations: 100,
          passedThreshold: true,
          threshold: 5,
          samples: [1.5, 1.6, 1.4],
        },
        {
          operationName: 'fast op 2',
          averageTime: 2.3,
          minTime: 2.0,
          maxTime: 3.0,
          iterations: 100,
          passedThreshold: true,
          threshold: 5,
          samples: [2.3, 2.4, 2.2],
        },
      ];

      const validation = validatePerformanceResults(results, true);

      expect(validation.passed).toBe(true);
      expect(validation.failedOperations).toHaveLength(0);
      expect(validation.totalOperations).toBe(2);
      expect(validation.report).toContain('PASSED');
      expect(validation.report).toContain('All operations passed');
    });

    it('should validate failing results in strict mode', () => {
      const results: BenchmarkResult[] = [
        {
          operationName: 'fast op',
          averageTime: 1.5,
          minTime: 1.0,
          maxTime: 2.0,
          iterations: 100,
          passedThreshold: true,
          threshold: 5,
          samples: [1.5],
        },
        {
          operationName: 'slow op',
          averageTime: 50.0,
          minTime: 45.0,
          maxTime: 55.0,
          iterations: 100,
          passedThreshold: false,
          threshold: 33,
          samples: [50.0],
        },
      ];

      const validation = validatePerformanceResults(results, true);

      expect(validation.passed).toBe(false);
      expect(validation.failedOperations).toHaveLength(1);
      expect(validation.failedOperations[0]).toContain('slow op');
      expect(validation.report).toContain('FAILED');
    });

    it('should allow some failures in flexible mode', () => {
      const results: BenchmarkResult[] = Array(10)
        .fill(null)
        .map((_, i) => ({
          operationName: `op ${i}`,
          averageTime: i === 9 ? 50.0 : 1.5, // Only last one fails
          minTime: 1.0,
          maxTime: 2.0,
          iterations: 100,
          passedThreshold: i !== 9, // Only last one fails
          threshold: 33,
          samples: [1.5],
        }));

      const validation = validatePerformanceResults(results, false);

      expect(validation.passed).toBe(true); // 90% pass rate is acceptable
      expect(validation.failedOperations).toHaveLength(1);
      expect(validation.report).toContain('Flexible (90% pass rate)');
    });
  });

  describe('MemoryMonitor', () => {
    it('should track memory usage', () => {
      const monitor = new MemoryMonitor();

      // Create some objects to use memory
      const data = Array(1000)
        .fill(null)
        .map(() => ({
          value: Math.random(),
          nested: { more: 'data' },
        }));

      // Memory delta might be 0 in test environment, but should not error
      const delta = monitor.getMemoryDelta();
      expect(typeof delta).toBe('number');
      expect(delta).toBeGreaterThanOrEqual(0);

      // Should not crash when checking limits
      const withinLimits = monitor.isWithinLimits(100);
      expect(typeof withinLimits).toBe('boolean');

      // Keep reference to prevent GC
      expect(data).toBeDefined();
    });
  });

  describe('FrameRateMonitor', () => {
    it('should monitor frame rates', async () => {
      const monitor = new FrameRateMonitor(10);

      // Simulate frames at ~60 FPS (16.67ms intervals)
      for (let i = 0; i < 5; i++) {
        monitor.recordFrame();
        await new Promise((resolve) => setTimeout(resolve, 16));
      }

      const fps = monitor.getAverageFPS();
      expect(fps).toBeGreaterThan(0);
      expect(fps).toBeLessThan(100); // Sanity check

      // Should meet 30 FPS target easily
      expect(monitor.meetsTarget(30)).toBe(true);

      // Reset should work
      monitor.reset();
      expect(monitor.getAverageFPS()).toBe(0);
    });
  });

  describe('Real-World Performance Tests', () => {
    it('should benchmark complete pose analysis pipeline under 33ms', () => {
      const testData = createPerformanceTestData('realistic');

      // Simulate a complete analysis pipeline
      const completeAnalysis = (landmarks: typeof testData.landmarks) => {
        // 1. Validate landmarks
        const reliable = areLandmarksReliable(landmarks, 0.7);

        // 2. Calculate key angles (knee angles)
        const leftKneeAngle = calculateAngleDegrees(
          landmarks[23], // left hip
          landmarks[25], // left knee
          landmarks[27], // left ankle
        );

        const rightKneeAngle = calculateAngleDegrees(
          landmarks[24], // right hip
          landmarks[26], // right knee
          landmarks[28], // right ankle
        );

        // 3. Calculate shoulder midpoint
        const shoulderMidpoint = calculateMidpoint(landmarks[11], landmarks[12]);

        // 4. Calculate distances
        const hipWidth = calculateDistance(landmarks[23], landmarks[24]);

        return {
          reliable,
          leftKneeAngle,
          rightKneeAngle,
          shoulderMidpoint,
          hipWidth,
        };
      };

      const result = benchmarkFunction(
        completeAnalysis,
        [testData.landmarks],
        50,
        'complete pose analysis',
        33, // 30 FPS requirement
      );

      expect(result.passedThreshold).toBe(true);
      expect(result.averageTime).toBeLessThan(33);

      // Log results for visibility
      console.log(
        `Complete analysis: ${result.averageTime.toFixed(2)}ms avg (${result.minTime.toFixed(2)}-${result.maxTime.toFixed(2)}ms)`,
      );
    });

    it('should handle stress test data efficiently', () => {
      const testData = createPerformanceTestData('stress');

      const stressAnalysis = (landmarks: typeof testData.landmarks) => {
        // More intensive calculations with all landmarks
        const results = [];

        // Calculate multiple angles
        for (let i = 0; i < 10; i++) {
          const angle = calculateAngleDegrees(landmarks[i], landmarks[i + 1], landmarks[i + 2]);
          results.push(angle);
        }

        // Calculate bar path deviation
        const shoulderHistory = testData.landmarkHistory.map((frame) => calculateMidpoint(frame[11], frame[12]));
        const deviation = calculateVerticalDeviation(shoulderHistory);

        // Validate all landmarks
        const allReliable = areLandmarksReliable(landmarks, 0.5);

        return { results, deviation, allReliable };
      };

      const result = benchmarkFunction(
        stressAnalysis,
        [testData.landmarks],
        25, // Fewer iterations for stress test
        'stress test analysis',
        50, // More lenient threshold for stress test
      );

      expect(result.averageTime).toBeLessThan(50);

      console.log(
        `Stress test: ${result.averageTime.toFixed(2)}ms avg (${result.minTime.toFixed(2)}-${result.maxTime.toFixed(2)}ms)`,
      );
    });
  });
});
