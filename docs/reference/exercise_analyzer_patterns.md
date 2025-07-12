# Exercise Analyzer Implementation Patterns

## Overview

This document establishes the proven patterns for implementing exercise-specific analyzers in DigDeep, based on the successful refactoring of `SquatPoseAnalyzer` in Phase 1.6. These patterns ensure consistency, maintainability, and performance across all exercise types.

## Core Architecture Pattern

### Base Class: `BasePoseDetector`

The `BasePoseDetector` provides the foundation for all exercise analyzers:

```typescript
export abstract class BasePoseDetector {
  // Common MediaPipe initialization and management
  // Frame processing and throttling (30 FPS)
  // Error handling and resource cleanup
  // Performance monitoring integration

  protected abstract calculateConfidence(result: PoseLandmarkerResult): number;
}
```

**Responsibilities:**

- MediaPipe instance management (singleton pattern)
- GPU/CPU fallback logic
- Frame rate throttling (33ms intervals)
- Performance metrics collection
- Resource cleanup and error handling

### Exercise-Specific Analyzer Pattern

Each exercise analyzer extends `BasePoseDetector` and follows this proven pattern:

```typescript
export class ExercisePoseAnalyzer extends BasePoseDetector {
  private static instance: ExercisePoseAnalyzer | null = null;
  private exerciseSpecificMetrics: ExerciseMetrics[] = [];

  constructor(config: ExerciseAnalyzerConfig = {}) {
    super({
      ...config,
      // Override with exercise-specific defaults
      minPoseDetectionConfidence: config.minPoseDetectionConfidence ?? 0.7,
      // ... other exercise-specific settings
    });
  }

  public static getInstance(config?: ExerciseAnalyzerConfig): ExercisePoseAnalyzer {
    // Singleton pattern implementation
  }

  public async initialize(): Promise<void> {
    // Call parent with exercise-specific logging
    await super.initialize();
  }

  public analyzeExercisePose(videoElement: HTMLVideoElement): ExerciseAnalysis {
    // 1. Use base class detection
    const baseResult = this.detectPose(videoElement);

    // 2. Add exercise-specific analysis
    const exerciseMetrics = this.analyzeExerciseMetrics(baseResult.landmarks);

    // 3. Combine and return results
    return { ...baseResult, exerciseMetrics };
  }

  protected calculateConfidence(result: PoseLandmarkerResult): number {
    // Exercise-specific confidence calculation
    // Focus on relevant landmarks for this exercise
  }

  public cleanup(): void {
    // Exercise-specific cleanup
    super.cleanup(); // Always call parent cleanup
  }
}
```

## Implementation Guidelines

### 1. Constructor Pattern

**✅ DO:**

```typescript
constructor(config: SquatPoseAnalyzerConfig = {}) {
  super({
    ...config,
    // Override only exercise-specific defaults
    minPoseDetectionConfidence: config.minPoseDetectionConfidence ?? 0.7,
    minPosePresenceConfidence: config.minPosePresenceConfidence ?? 0.7,
    minTrackingConfidence: config.minTrackingConfidence ?? 0.7,
  });
}
```

**❌ DON'T:**

- Duplicate base configuration logic
- Initialize MediaPipe directly
- Skip calling `super()`

### 2. Configuration Interface Pattern

**✅ DO:**

```typescript
interface SquatPoseAnalyzerConfig extends PoseDetectorConfig {
  // Exercise-specific config properties can be added here
  // All base properties are inherited automatically
}
```

**Benefits:**

- Type safety with inheritance
- Easy extension for exercise-specific settings
- Consistent configuration across analyzers

### 3. Analysis Method Pattern

**✅ DO:**

```typescript
public analyzeSquatPose(videoElement: HTMLVideoElement): SquatPoseAnalysis {
  // Step 1: Use base class for common detection
  const baseResult = this.detectPose(videoElement);

  // Step 2: Handle base detection failures early
  if (!baseResult.landmarks) {
    return this.createEmptyAnalysis(baseResult.timestamp, baseResult.processingTime);
  }

  // Step 3: Perform exercise-specific analysis
  const startAnalysisTime = performance.now();
  const squatMetrics = this.analyzeSquatMetrics(baseResult.landmarks);

  // Step 4: Combine timing and results
  const totalProcessingTime = baseResult.processingTime + (performance.now() - startAnalysisTime);

  // Step 5: Return comprehensive analysis
  return {
    landmarks: baseResult.landmarks,
    timestamp: baseResult.timestamp,
    confidence: baseResult.confidence,
    processingTime: totalProcessingTime,
    isValid: baseResult.confidence > 0.5 && squatMetrics.hasValidPose,
    exerciseMetrics: squatMetrics,
  };
}
```

### 4. Confidence Calculation Override

**✅ DO:**

```typescript
protected calculateConfidence(result: PoseLandmarkerResult): number {
  if (!result.landmarks?.[0]) return 0;

  const landmarks = result.landmarks[0];

  // Focus on exercise-specific landmarks with appropriate weights
  const criticalLandmarks = [
    { index: 23, weight: 2.0 }, // LEFT_HIP (critical for squats)
    { index: 24, weight: 2.0 }, // RIGHT_HIP
    { index: 25, weight: 1.5 }, // LEFT_KNEE
    { index: 26, weight: 1.5 }, // RIGHT_KNEE
    { index: 11, weight: 1.0 }, // LEFT_SHOULDER (for bar tracking)
    { index: 12, weight: 1.0 }, // RIGHT_SHOULDER
  ];

  // Calculate weighted confidence
  let totalWeight = 0;
  let weightedSum = 0;

  for (const { index, weight } of criticalLandmarks) {
    const landmark = landmarks[index];
    if (landmark?.visibility && landmark.visibility > 0.5) {
      weightedSum += landmark.visibility * weight;
      totalWeight += weight;
    }
  }

  return totalWeight > 0 ? Math.min(1.0, weightedSum / totalWeight) : 0;
}
```

### 5. Singleton Pattern Implementation

**✅ DO:**

```typescript
private static instance: SquatPoseAnalyzer | null = null;

public static getInstance(config?: SquatPoseAnalyzerConfig): SquatPoseAnalyzer {
  if (!SquatPoseAnalyzer.instance) {
    SquatPoseAnalyzer.instance = new SquatPoseAnalyzer(config);
  }
  return SquatPoseAnalyzer.instance;
}

public static resetInstance(): void {
  if (SquatPoseAnalyzer.instance) {
    SquatPoseAnalyzer.instance.cleanup();
    SquatPoseAnalyzer.instance = null;
  }
}
```

## Testing Patterns

### 1. Test Structure Pattern

```typescript
describe('ExercisePoseAnalyzer', () => {
  let analyzer: ExercisePoseAnalyzer;
  let mockVideoElement: HTMLVideoElement;

  beforeEach(() => {
    // Reset all mocks and instances
    vi.clearAllMocks();
    resetMockMediaPipeConfig();
    ExercisePoseAnalyzer.resetInstance();

    // Create fresh analyzer instance
    analyzer = ExercisePoseAnalyzer.getInstance();

    // Create mock video element
    mockVideoElement = { readyState: 4 } as HTMLVideoElement;
  });

  afterEach(() => {
    analyzer.cleanup();
  });

  describe('Initialization', () => {
    // Test initialization patterns
  });

  describe('Exercise-specific Analysis', () => {
    // Test exercise metrics calculations
  });

  describe('Performance', () => {
    // Test frame processing performance
  });
});
```

### 2. Performance Test Pattern

```typescript
describe('Performance Verification', () => {
  it('should process frames efficiently within 30 FPS target', () => {
    const maxFrameTime = 33.33;
    const testFrames = 60;
    const processingTimes: number[] = [];

    for (let i = 0; i < testFrames; i++) {
      const start = performance.now();
      analyzer.analyzeExercisePose(mockVideoElement);
      const end = performance.now();
      processingTimes.push(end - start);
    }

    const avgTime = processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length;
    expect(avgTime).toBeLessThan(maxFrameTime);
  });
});
```

## Exercise-Specific Implementation Examples

### Squat Analyzer (Reference Implementation)

```typescript
// Confidence focuses on lower body landmarks
protected calculateConfidence(result: PoseLandmarkerResult): number {
  // Weight hips and knees heavily, shoulders moderately
  const weights = { hips: 2.0, knees: 1.5, shoulders: 1.0 };
}

// Metrics focus on depth, balance, and bar path
private analyzeSquatMetrics(result: PoseLandmarkerResult): SquatMetrics {
  return {
    depth: this.calculateDepthMetrics(result),
    balance: this.calculateBalanceMetrics(result),
    barPosition: this.calculateBarPathMetrics(result),
    jointAngles: this.calculateJointAngles(result),
  };
}
```

### Future: Bench Press Analyzer

```typescript
// Confidence would focus on upper body landmarks
protected calculateConfidence(result: PoseLandmarkerResult): number {
  // Weight shoulders, elbows, and wrists heavily
  const weights = { shoulders: 2.0, elbows: 2.0, wrists: 1.5 };
}

// Metrics would focus on press path and chest contact
private analyzeBenchMetrics(result: PoseLandmarkerResult): BenchMetrics {
  return {
    pressPath: this.calculatePressPath(result),
    chestContact: this.calculateChestContact(result),
    elbowTracking: this.calculateElbowTracking(result),
  };
}
```

### Future: Deadlift Analyzer

```typescript
// Confidence would focus on full-body tracking
protected calculateConfidence(result: PoseLandmarkerResult): number {
  // Weight back, hips, and knees for hip hinge movement
  const weights = { back: 2.0, hips: 2.0, knees: 1.0 };
}

// Metrics would focus on hip hinge and bar path
private analyzeDeadliftMetrics(result: PoseLandmarkerResult): DeadliftMetrics {
  return {
    hipHinge: this.calculateHipHingeMetrics(result),
    barPath: this.calculateVerticalBarPath(result),
    backAngle: this.calculateBackAngle(result),
  };
}
```

## Performance Considerations

### Memory Management

- Maintain bounded history arrays (max 30 entries)
- Clean up resources in `cleanup()` method
- Reset metrics on instance cleanup

### Processing Efficiency

- Exercise-specific analysis should add < 5ms per frame
- Use object pooling for frequent calculations
- Cache expensive computations between frames

### Error Handling

- Always call `super.cleanup()` in cleanup methods
- Handle missing landmarks gracefully
- Provide meaningful error messages with context

## Migration Guide

When implementing new exercise analyzers:

1. **Start with the SquatPoseAnalyzer** as a reference
2. **Copy the basic structure** and modify for your exercise
3. **Focus on exercise-specific landmarks** in confidence calculation
4. **Define relevant metrics** for form analysis
5. **Implement comprehensive tests** following the established patterns
6. **Verify performance** meets 30 FPS requirements

## Benefits of This Pattern

### Code Quality

- **DRY Principle**: No duplicated MediaPipe logic
- **Single Responsibility**: Clear separation of concerns
- **Type Safety**: Strong TypeScript interfaces
- **Testability**: Isolated, mockable components

### Performance

- **Shared Resources**: Single MediaPipe instance
- **Optimized Processing**: Common throttling and error handling
- **Memory Efficiency**: Bounded history and proper cleanup

### Maintainability

- **Consistent APIs**: All analyzers follow same pattern
- **Easy Extension**: Add new exercises with minimal code
- **Clear Architecture**: Inheritance relationships are explicit
- **Future-Proof**: Ready for strategy pattern in Phase 2

This pattern establishes a solid foundation for the multi-exercise architecture planned in future phases while maintaining the performance and reliability requirements for real-time pose analysis.
