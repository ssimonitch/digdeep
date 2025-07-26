# MediaPipe Testing Mocks

This directory contains mocks for MediaPipe pose detection to enable isolated testing without loading actual MediaPipe resources.

## Overview

The MediaPipe mocks provide a complete testing infrastructure that:

- Simulates MediaPipe's PoseLandmarker behavior
- Allows control over detection results and failures
- Enables performance testing with configurable delays
- Tracks method calls for verification

## Core Components

### MockPoseLandmarker

A drop-in replacement for MediaPipe's PoseLandmarker that simulates pose detection.

### MockFilesetResolver

Simulates MediaPipe's resource loading without actual WASM files.

## Usage

### Basic Setup

```typescript
import { vi } from 'vitest';
import { MockPoseLandmarker, MockFilesetResolver, resetMockMediaPipeConfig } from './mediapipe-mocks';

beforeEach(() => {
  // Reset mock configuration
  resetMockMediaPipeConfig();
  MockPoseLandmarker.closeAll();

  // Mock the MediaPipe module
  vi.doMock('@mediapipe/tasks-vision', () => ({
    FilesetResolver: MockFilesetResolver,
    PoseLandmarker: MockPoseLandmarker,
  }));
});
```

### Configuring Mock Behavior

```typescript
import { setMockMediaPipeConfig } from './mediapipe-mocks';

// Simulate initialization failure
setMockMediaPipeConfig({
  shouldFailInit: true,
  initFailureMessage: 'Failed to load model',
});

// Simulate detection failure
setMockMediaPipeConfig({
  shouldFail: true,
  failureMessage: 'Camera disconnected',
});

// Simulate processing delay
setMockMediaPipeConfig({
  processingDelay: 30, // 30ms delay
});

// Use custom pose results
import { SQUAT_FIXTURES } from '../fixtures/landmark-fixtures';
setMockMediaPipeConfig({
  customResult: SQUAT_FIXTURES.properDepth,
});
```

### Testing Service Integration

```typescript
// Example service that uses MediaPipe
class PoseService {
  private landmarker: PoseLandmarker | null = null;

  async initialize(): Promise<void> {
    const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision');
    const vision = await FilesetResolver.forVisionTasks('...');
    this.landmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: 'pose_landmarker_lite.task' },
      runningMode: 'VIDEO',
    });
  }

  detectPose(video: HTMLVideoElement) {
    return this.landmarker?.detectForVideo(video, performance.now());
  }
}

// Test the service
it('should detect pose successfully', async () => {
  const service = new PoseService();
  await service.initialize();

  const video = createMockVideoElement();
  const result = service.detectPose(video);

  expect(result).toBeDefined();
  expect(MockPoseLandmarker.getDetectForVideoCallCount()).toBe(1);
});
```

### Verifying Mock Interactions

```typescript
// Check initialization calls
expect(MockPoseLandmarker.getCreateFromOptionsCallCount()).toBe(1);

// Check detection calls
expect(MockPoseLandmarker.getDetectForVideoCallCount()).toBe(30);

// Check active instances
expect(MockPoseLandmarker.getInstances()).toHaveLength(1);

// Verify cleanup
service.dispose();
expect(MockPoseLandmarker.getInstances()).toHaveLength(0);
```

### Performance Testing

```typescript
// Simulate slow initialization
setMockMediaPipeConfig({ initializationDelay: 100 });

// Simulate frame processing time
setMockMediaPipeConfig({ processingDelay: 30 });

// Test performance characteristics
const start = performance.now();
await service.initialize();
const duration = performance.now() - start;
expect(duration).toBeGreaterThanOrEqual(90);
```

## Configuration Options

| Option                | Type                 | Description                         |
| --------------------- | -------------------- | ----------------------------------- |
| `shouldFail`          | boolean              | Make detectForVideo throw an error  |
| `failureMessage`      | string               | Custom error message for failures   |
| `processingDelay`     | number               | Delay in ms for detectForVideo      |
| `customResult`        | PoseLandmarkerResult | Custom detection result to return   |
| `initializationDelay` | number               | Delay in ms for initialization      |
| `shouldFailInit`      | boolean              | Make initialization fail            |
| `initFailureMessage`  | string               | Custom initialization error message |

## Helper Functions

### createMockVideoElement()

Creates a mock HTMLVideoElement for testing:

```typescript
const video = createMockVideoElement({
  width: 1920,
  height: 1080,
  currentTime: 1000,
});
```

### createMockPoseResult()

Creates a valid PoseLandmarkerResult with default landmarks:

```typescript
const result = createMockPoseResult();
// All 33 landmarks with high confidence
```

## Best Practices

1. **Always reset mocks** between tests to avoid state pollution
2. **Use fixtures** for realistic test data (see `landmark-fixtures.ts`)
3. **Test both success and failure paths** using mock configuration
4. **Verify cleanup** to prevent memory leaks in tests
5. **Use appropriate delays** when testing performance characteristics

## Integration with Other Test Utilities

These mocks work seamlessly with:

- Performance benchmarking tools (see `../performance/`)
- Landmark fixtures for realistic test data
- Component testing utilities

For complete examples of testing pose detection services, refer to the actual service tests in the codebase.
