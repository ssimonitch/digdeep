/**
 * Performance testing examples and usage patterns
 * This file demonstrates how to use the benchmarking infrastructure
 * for testing pose detection performance requirements
 */

import {
  areLandmarksReliable,
  calculateAngleDegrees,
  calculateDistance,
  calculateMidpoint,
  calculateVerticalDeviation,
} from '../utils/test-utilities';
import {
  benchmarkFunction,
  type BenchmarkResult,
  createPerformanceTestData,
  FrameRateMonitor,
  MemoryMonitor,
  validatePerformanceResults,
} from './benchmark';

/**
 * Example: Performance test suite for a complete pose analyzer
 * This demonstrates how to structure performance tests for real components
 */
export function runPoseAnalyzerPerformanceTests(): Promise<{
  passed: boolean;
  report: string;
  results: BenchmarkResult[];
}> {
  return new Promise((resolve) => {
    const results: BenchmarkResult[] = [];
    const testData = createPerformanceTestData('realistic');

    // Test 1: Individual mathematical operations
    console.log('🧮 Testing individual mathematical operations...');

    // Distance calculation should be very fast (< 0.1ms)
    const distanceResult = benchmarkFunction(
      calculateDistance,
      [testData.landmarks[0], testData.landmarks[1]],
      1000,
      'distance calculation',
      0.1,
    );
    results.push(distanceResult);

    // Angle calculation should be fast (< 0.5ms)
    const angleResult = benchmarkFunction(
      calculateAngleDegrees,
      [testData.landmarks[23], testData.landmarks[25], testData.landmarks[27]],
      1000,
      'angle calculation',
      0.5,
    );
    results.push(angleResult);

    // Midpoint calculation should be very fast (< 0.1ms)
    const midpointResult = benchmarkFunction(
      calculateMidpoint,
      [testData.landmarks[11], testData.landmarks[12]],
      1000,
      'midpoint calculation',
      0.1,
    );
    results.push(midpointResult);

    // Test 2: Batch operations
    console.log('📊 Testing batch operations...');

    // Landmark validation for all 33 landmarks (< 1ms)
    const validationResult = benchmarkFunction(
      areLandmarksReliable,
      [testData.landmarks, 0.7],
      500,
      'landmark validation (33 landmarks)',
      1,
    );
    results.push(validationResult);

    // Bar path deviation calculation (< 2ms)
    const deviationResult = benchmarkFunction(
      calculateVerticalDeviation,
      [testData.landmarks],
      500,
      'bar path deviation calculation',
      2,
    );
    results.push(deviationResult);

    // Test 3: Complete analysis pipeline
    console.log('🏃‍♂️ Testing complete analysis pipeline...');

    const completeAnalysis = (landmarks: typeof testData.landmarks) => {
      // This simulates a realistic squat analysis

      // 1. Validate key landmarks for squat analysis
      const keyLandmarks = [
        landmarks[11],
        landmarks[12], // shoulders
        landmarks[23],
        landmarks[24], // hips
        landmarks[25],
        landmarks[26], // knees
        landmarks[27],
        landmarks[28], // ankles
      ];
      const reliable = areLandmarksReliable(keyLandmarks, 0.7);

      if (!reliable) {
        return { reliable: false, analysis: null };
      }

      // 2. Calculate joint angles
      const leftKneeAngle = calculateAngleDegrees(landmarks[23], landmarks[25], landmarks[27]);
      const rightKneeAngle = calculateAngleDegrees(landmarks[24], landmarks[26], landmarks[28]);
      const leftHipAngle = calculateAngleDegrees(landmarks[11], landmarks[23], landmarks[25]);
      const rightHipAngle = calculateAngleDegrees(landmarks[12], landmarks[24], landmarks[26]);

      // 3. Calculate bar position (shoulder midpoint)
      const barPosition = calculateMidpoint(landmarks[11], landmarks[12]);

      // 4. Calculate lateral balance
      const hipDistance = calculateDistance(landmarks[23], landmarks[24]);
      const kneeDistance = calculateDistance(landmarks[25], landmarks[26]);
      const lateralBalance = Math.abs(hipDistance - kneeDistance);

      // 5. Calculate squat depth
      const leftHipY = landmarks[23].y;
      const leftKneeY = landmarks[25].y;
      const rightHipY = landmarks[24].y;
      const rightKneeY = landmarks[26].y;
      const avgHipY = (leftHipY + rightHipY) / 2;
      const avgKneeY = (leftKneeY + rightKneeY) / 2;
      const hasProperDepth = avgHipY > avgKneeY; // In normalized coords, Y increases downward

      return {
        reliable: true,
        analysis: {
          angles: {
            leftKnee: leftKneeAngle,
            rightKnee: rightKneeAngle,
            leftHip: leftHipAngle,
            rightHip: rightHipAngle,
          },
          barPosition,
          lateralBalance,
          hasProperDepth,
          depth: avgHipY - avgKneeY,
        },
      };
    };

    // This must complete in under 33ms for 30 FPS
    const pipelineResult = benchmarkFunction(
      completeAnalysis,
      [testData.landmarks],
      100,
      'complete squat analysis pipeline',
      33,
    );
    results.push(pipelineResult);

    // Test 4: Stress test with multiple calculations
    console.log('🔥 Testing stress conditions...');

    const stressTestData = createPerformanceTestData('stress');
    const stressAnalysis = (landmarks: typeof stressTestData.landmarks) => {
      const analyses = [];

      // Run analysis 10 times (simulating rapid frame processing)
      for (let i = 0; i < 10; i++) {
        const result = completeAnalysis(landmarks);
        analyses.push(result);
      }

      // Calculate bar path over time
      const shoulderHistory = stressTestData.landmarkHistory.map((frame) => calculateMidpoint(frame[11], frame[12]));
      const barPathDeviation = calculateVerticalDeviation(shoulderHistory);

      return { analyses, barPathDeviation };
    };

    // Stress test should complete in under 100ms
    const stressResult = benchmarkFunction(
      stressAnalysis,
      [stressTestData.landmarks],
      20,
      'stress test (10x analysis + bar path)',
      100,
    );
    results.push(stressResult);

    // Validate all results
    const validation = validatePerformanceResults(results, false); // Use flexible mode

    // Log detailed results
    console.log('\n📋 Performance Test Results:');
    console.log('='.repeat(50));
    results.forEach((result) => {
      const status = result.passedThreshold ? '✅ PASS' : '❌ FAIL';
      console.log(
        `${status} ${result.operationName}: ${result.averageTime.toFixed(3)}ms avg (max: ${result.threshold}ms)`,
      );
    });
    console.log('='.repeat(50));
    console.log(validation.report);

    resolve({
      passed: validation.passed,
      report: validation.report,
      results,
    });
  });
}

/**
 * Example: Frame rate monitoring for continuous performance tracking
 */
export function demonstrateFrameRateMonitoring(): void {
  console.log('\n🎥 Frame Rate Monitoring Demo:');

  const monitor = new FrameRateMonitor(30); // Track last 30 frames
  const testData = createPerformanceTestData('realistic');

  // Simulate processing frames
  const processFrame = () => {
    // Simulate a frame analysis
    const landmarks = testData.landmarks;
    calculateAngleDegrees(landmarks[23], landmarks[25], landmarks[27]);
    calculateMidpoint(landmarks[11], landmarks[12]);
    areLandmarksReliable(landmarks, 0.7);
  };

  // Simulate real-time frame processing
  let frameCount = 0;
  const frameInterval = setInterval(() => {
    monitor.recordFrame();
    processFrame();
    frameCount++;

    if (frameCount % 10 === 0) {
      const fps = monitor.getAverageFPS();
      const meetsTarget = monitor.meetsTarget(30);
      console.log(`Frame ${frameCount}: ${fps.toFixed(1)} FPS ${meetsTarget ? '✅' : '❌'}`);
    }

    if (frameCount >= 30) {
      clearInterval(frameInterval);
      const finalFPS = monitor.getAverageFPS();
      console.log(`\nFinal average: ${finalFPS.toFixed(1)} FPS`);
      console.log(`Meets 30 FPS target: ${monitor.meetsTarget(30) ? '✅ Yes' : '❌ No'}`);
    }
  }, 16.67); // ~60 FPS interval
}

/**
 * Example: Memory usage monitoring
 */
export function demonstrateMemoryMonitoring(): void {
  console.log('\n💾 Memory Monitoring Demo:');

  const monitor = new MemoryMonitor();
  console.log('Starting memory monitoring...');

  // Simulate creating and processing pose data
  const dataArrays = [];

  for (let i = 0; i < 100; i++) {
    const testData = createPerformanceTestData('realistic');
    dataArrays.push(testData);

    // Process the data
    testData.landmarks.forEach((landmark) => {
      calculateDistance(landmark, testData.landmarks[0]);
    });

    if (i % 20 === 0) {
      const deltaBytes = monitor.getMemoryDelta();
      const deltaMB = deltaBytes / (1024 * 1024);
      const withinLimits = monitor.isWithinLimits(50);
      console.log(`Iteration ${i}: +${deltaMB.toFixed(2)}MB ${withinLimits ? '✅' : '❌'}`);
    }
  }

  const finalDelta = monitor.getMemoryDelta();
  const finalMB = finalDelta / (1024 * 1024);
  console.log(`\nFinal memory increase: ${finalMB.toFixed(2)}MB`);
  console.log(`Within 50MB limit: ${monitor.isWithinLimits(50) ? '✅ Yes' : '❌ No'}`);

  // Keep reference to prevent premature garbage collection
  console.log(`Processed ${dataArrays.length} data sets`);
}

/**
 * Example: How to use benchmarking in actual component tests
 */
export function exampleComponentPerformanceTest() {
  console.log('\n🧪 Example Component Performance Test:');

  // This would be used in actual component tests
  const componentTestExample = `
  describe('SquatPoseAnalyzer Performance', () => {
    it('should analyze frame within 33ms requirement', () => {
      const analyzer = new SquatPoseAnalyzer();
      const testData = createPerformanceTestData('realistic');
      
      const result = benchmarkFunction(
        (poseResult) => analyzer.analyzeFrame(poseResult),
        [testData.poseResult],
        50,
        'SquatPoseAnalyzer.analyzeFrame',
        33 // 30 FPS requirement
      );
      
      expect(result.passedThreshold).toBe(true);
      expect(result.averageTime).toBeLessThan(33);
    });
    
    it('should handle stress conditions efficiently', () => {
      const analyzer = new SquatPoseAnalyzer();
      const stressData = createPerformanceTestData('stress');
      
      const result = benchmarkFunction(
        (poseResult) => analyzer.analyzeFrame(poseResult),
        [stressData.poseResult],
        25,
        'SquatPoseAnalyzer stress test',
        50 // More lenient for stress test
      );
      
      expect(result.averageTime).toBeLessThan(50);
    });
  });
  `;

  console.log(componentTestExample);
}

// Export a convenience function to run all examples
export async function runAllPerformanceExamples(): Promise<void> {
  console.log('🚀 Running Performance Benchmarking Examples');
  console.log('='.repeat(60));

  try {
    // Run the main performance test suite
    const results = await runPoseAnalyzerPerformanceTests();

    if (results.passed) {
      console.log('\n🎉 All performance tests passed!');
    } else {
      console.log('\n⚠️  Some performance tests failed - see details above');
    }

    // Run monitoring demos
    demonstrateFrameRateMonitoring();

    setTimeout(() => {
      demonstrateMemoryMonitoring();

      setTimeout(() => {
        exampleComponentPerformanceTest();
        console.log('\n✨ Performance benchmarking examples completed!');
      }, 1000);
    }, 2000);
  } catch (error) {
    console.error('❌ Error running performance examples:', error);
  }
}
