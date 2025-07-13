# Performance Benchmarking Infrastructure

This directory contains comprehensive performance testing tools for pose detection components, ensuring they meet the 30 FPS requirement (33ms per frame).

## Overview

The performance testing infrastructure provides:

- **High-precision benchmarking** with `performance.now()` timing
- **Realistic test data generation** for different complexity levels
- **Comprehensive reporting** with pass/fail validation
- **Memory usage monitoring** to prevent memory leaks
- **Frame rate monitoring** for real-time performance tracking

## Core Components

### 1. `benchmark.ts` - Core Benchmarking Tools

#### `PerformanceBenchmark` Class

```typescript
const benchmark = new PerformanceBenchmark();
benchmark.start();
// ... operation to test ...
const duration = benchmark.stop();
const results = benchmark.getResults('operation name', 33);
```

#### `benchmarkFunction()` - Function Benchmarking

```typescript
const result = benchmarkFunction(
  calculateAngleDegrees,
  [landmark1, landmark2, landmark3],
  100, // iterations
  'angle calculation',
  1, // 1ms threshold
);
```

#### `createPerformanceTestData()` - Test Data Generation

```typescript
// Simple data - all landmarks at center with high confidence
const simpleData = createPerformanceTestData('simple');

// Realistic data - varied positions and confidence levels
const realisticData = createPerformanceTestData('realistic');

// Stress data - maximum variation, some low confidence landmarks
const stressData = createPerformanceTestData('stress');
```

### 2. Monitoring Classes

#### `FrameRateMonitor` - Real-time FPS tracking

```typescript
const monitor = new FrameRateMonitor(60); // Track last 60 frames

// In your render loop:
monitor.recordFrame();
if (monitor.meetsTarget(30)) {
  console.log(`Running at ${monitor.getAverageFPS().toFixed(1)} FPS`);
}
```

#### `MemoryMonitor` - Memory usage tracking

```typescript
const monitor = new MemoryMonitor();
// ... run operations ...
const deltaBytes = monitor.getMemoryDelta();
const withinLimits = monitor.isWithinLimits(50); // 50MB limit
```

## Performance Requirements

### Target Thresholds

| Operation Type                 | Threshold  | Rationale                              |
| ------------------------------ | ---------- | -------------------------------------- |
| Individual math operations     | < 0.1ms    | Building blocks must be extremely fast |
| Angle calculations             | < 0.5ms    | Core pose analysis operations          |
| Batch validations              | < 1ms      | Processing all 33 landmarks            |
| Complex calculations           | < 2ms      | Bar path tracking, etc.                |
| **Complete analysis pipeline** | **< 33ms** | **30 FPS requirement**                 |
| Stress test scenarios          | < 50ms     | Graceful degradation under load        |

### Key Performance Tests

1. **Individual Operations** - Ensure mathematical primitives are extremely fast
2. **Batch Operations** - Test processing multiple landmarks efficiently
3. **Complete Pipeline** - Full pose analysis must meet 33ms requirement
4. **Stress Testing** - Performance under challenging conditions

## Usage Examples

### Basic Performance Test

```typescript
import { benchmarkFunction, createPerformanceTestData } from './benchmark';
import { calculateAngleDegrees } from '../utils/test-utilities';

const testData = createPerformanceTestData('realistic');

const result = benchmarkFunction(
  calculateAngleDegrees,
  [testData.landmarks[23], testData.landmarks[25], testData.landmarks[27]],
  1000,
  'knee angle calculation',
  0.5, // 0.5ms threshold
);

console.log(`${result.operationName}: ${result.averageTime.toFixed(3)}ms avg`);
console.log(`Passed: ${result.passedThreshold ? '✅' : '❌'}`);
```

### Component Performance Test

```typescript
describe('SquatPoseAnalyzer Performance', () => {
  it('should analyze frame within 33ms requirement', () => {
    const analyzer = new SquatPoseAnalyzer();
    const testData = createPerformanceTestData('realistic');

    const result = benchmarkFunction(
      (poseResult) => analyzer.analyzeFrame(poseResult),
      [testData.poseResult],
      50,
      'SquatPoseAnalyzer.analyzeFrame',
      33, // 30 FPS requirement
    );

    expect(result.passedThreshold).toBe(true);
    expect(result.averageTime).toBeLessThan(33);
  });
});
```

### Continuous Monitoring

```typescript
const frameMonitor = new FrameRateMonitor();
const memoryMonitor = new MemoryMonitor();

// In your analysis loop:
frameMonitor.recordFrame();
const fps = frameMonitor.getAverageFPS();
const memoryDelta = memoryMonitor.getMemoryDelta();

if (!frameMonitor.meetsTarget(30)) {
  console.warn(`Frame rate dropped to ${fps.toFixed(1)} FPS`);
}
```

## Test Data Complexity Levels

### Simple

- All 33 landmarks at center (0.5, 0.5)
- High confidence (1.0) for all landmarks
- 10 frames of history
- **Use for**: Basic functionality and baseline performance

### Realistic

- Landmarks distributed in realistic ranges (0.3-0.7 for X/Y)
- Confidence levels between 0.5-1.0
- 50 frames of history with small variations
- **Use for**: Standard performance testing

### Stress

- Full coordinate range (0-1) with maximum variation
- Full confidence range (0-1) including very low confidence
- 100 frames of history with noise
- **Use for**: Worst-case scenario testing

## Performance Validation

The `validatePerformanceResults()` function provides comprehensive reporting:

```typescript
const validation = validatePerformanceResults(results, false); // flexible mode

console.log(validation.report);
// Outputs:
// Performance Test Report:
// ------------------------
// Total Operations: 5
// Passed: 5
// Failed: 0
// Mode: Flexible (90% pass rate)
// Result: PASSED
```

## Best Practices

1. **Always warm up** - Run operations 10 times before benchmarking to eliminate JIT compilation effects

2. **Use appropriate iteration counts**:

   - Simple operations: 1000+ iterations
   - Complex operations: 100+ iterations
   - Stress tests: 25+ iterations

3. **Set realistic thresholds**:

   - Individual operations: < 1ms
   - Complete pipelines: < 33ms (30 FPS)
   - Stress tests: < 50ms (graceful degradation)

4. **Monitor continuously**:

   - Use `FrameRateMonitor` in development
   - Use `MemoryMonitor` to detect leaks
   - Log performance metrics in production

5. **Test different complexity levels**:
   - Start with simple data for baseline
   - Use realistic data for standard testing
   - Use stress data for edge case validation

## Integration with CI/CD

Performance tests can be integrated into your CI pipeline:

```bash
# Run performance tests
npm test src/test/pose-detection/performance/

# With custom thresholds for CI
PERFORMANCE_STRICT_MODE=true npm test
```

This ensures performance regressions are caught early in development.
