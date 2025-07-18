# Testing Best Practices for DigDeep

This document defines testing standards and best practices for the DigDeep project using Vitest and React Testing Library. It serves as the primary reference for maintaining consistent, high-quality tests across the codebase.

## Core Testing Philosophy

### Test-Driven Development (TDD) Cycle

1. Red: Write a failing test for the next small piece of functionality
2. Green: Write the minimum code to make the test pass
3. Refactor: Clean up the code while keeping tests green

### Testing Principles

1. **Test User Behavior, Not Implementation**: Focus on what the code does, not how.
2. **No Implementation Details**: Never test hooks in isolation, internal state, or component methods.
3. **Performance-Critical Testing**: What part of our untested codebase would lead to poor UX if broke? Focus on testing that.
4. **One assertion per test**: Keep tests focused and easy to debug.
5. **Type Safety First**: Zero tolerance for `any` types in tests.

### Important References

Use context7 to browse documentation as needed.

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Testing Library Queries](https://testing-library.com/docs/queries/about)
- [React Testing Library Philosophy](https://testing-library.com/docs/guiding-principles/)


## Project Structure & Organization

### Test File Naming

```typescript
// Unit/Component tests
src / features / [feature] / __tests__ / [component].test.ts;
src / features / [feature] / __tests__ / [component].test.tsx;

// Integration tests
src / test / [workflow] / [workflow - name].integration.test.ts;

// Performance tests
src / features / [feature] / __tests__ / [component].performance.test.ts;

// Benchmark tests
src / features / [feature] / __tests__ / [component].benchmark.test.ts;
```

### Test Organization Pattern

```typescript
describe('ComponentName', () => {
  // Setup shared test data
  const mockData = createMockData();

  describe('Initialization', () => {
    it('should initialize with default state', () => {});
  });

  describe('User Interactions', () => {
    it('should handle user click on button', () => {});
  });

  describe('Error Handling', () => {
    it('should display error message on failure', () => {});
  });

  describe('Performance', () => {
    it('should process frame within 33ms', () => {});
  });
});
```

## Vitest Configuration & Best Practices

### Mock Management

```typescript
// NEVER use any types - use proper Vitest typing
import { vi, type MockInstance } from 'vitest';

// Store spy references for type safety
let createElementSpy: MockInstance<typeof document.createElement>;

beforeEach(() => {
  createElementSpy = vi.spyOn(document, 'createElement');
});

// Access mock calls with type safety
const videoCalls = createElementSpy.mock.calls.filter(([tagName]) => tagName === 'video');
```

### Mock Creation Patterns

```typescript
// Use factory functions for complex mocks
const createMockStream = (): MediaStream =>
  ({
    getTracks: vi.fn(() => [mockTrack]),
    id: 'test-stream-id',
    active: true,
  }) as unknown as MediaStream;

// Type partial mocks properly
const mockTrack: Partial<MediaStreamTrack> = {
  stop: vi.fn(),
  kind: 'video',
  id: 'test-track-id',
};
```

### Cleanup & Resource Management

```typescript
beforeEach(() => {
  vi.clearAllMocks();
  // Setup fresh test state
});

afterEach(() => {
  vi.restoreAllMocks();
  // Clean up DOM modifications
  // Stop any running timers
});
```

## React Testing Library Patterns

### Component Testing

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

it('should update depth indicator on squat descent', async () => {
  const user = userEvent.setup();

  render(<DepthIndicator depth={0} />);

  // Simulate user action that triggers depth change
  await user.click(screen.getByRole('button', { name: /start analysis/i }));

  await waitFor(() => {
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '95'
    );
  });
});
```

### Hook Testing

```typescript
import { renderHook, act } from '@testing-library/react';

// Test hooks through their public API
it('should initialize video element on stream ready', async () => {
  const { result } = renderHook(() => useVideoElement());

  const mockStream = createMockStream();

  await act(async () => {
    const video = await result.current.initializeVideo(mockStream);
    expect(video).toBeInstanceOf(HTMLVideoElement);
  });
});
```

### Async Testing

```typescript
// Handle floating promises properly
act(() => {
  void someAsyncOperation().then(() => {
    // Handle completion
  });
});

// Remove unnecessary async from act callbacks
act(() => {
  // Not: async () =>
  mockVideoElement.onloadedmetadata?.call(mockVideoElement, new Event('loadedmetadata'));
});
```

## Performance Testing

### Real-Time Processing Tests

```typescript
describe('Performance Requirements', () => {
  it('should process pose detection within 33ms (30 FPS)', async () => {
    const startTime = performance.now();

    await analyzer.analyzePose(mockLandmarks);

    const processingTime = performance.now() - startTime;
    expect(processingTime).toBeLessThan(33);
  });

  it('should maintain consistent FPS over time', async () => {
    const frameTimings: number[] = [];

    for (let i = 0; i < 100; i++) {
      const start = performance.now();
      await analyzer.analyzePose(mockLandmarks);
      frameTimings.push(performance.now() - start);
    }

    const avgTime = frameTimings.reduce((a, b) => a + b) / frameTimings.length;
    const maxTime = Math.max(...frameTimings);

    expect(avgTime).toBeLessThan(20); // Target: 50 FPS average
    expect(maxTime).toBeLessThan(33); // Never drop below 30 FPS
  });
});
```

### Memory Management Tests

```typescript
it('should not leak memory during extended sessions', () => {
  const initialHeap = performance.memory.usedJSHeapSize;

  // Run 1000 analysis cycles
  for (let i = 0; i < 1000; i++) {
    analyzer.analyzePose(mockLandmarks);
  }

  // Force garbage collection if available
  if (global.gc) global.gc();

  const finalHeap = performance.memory.usedJSHeapSize;
  const heapGrowth = finalHeap - initialHeap;

  // Allow for some growth but not unbounded
  expect(heapGrowth).toBeLessThan(10 * 1024 * 1024); // 10MB max
});
```

## ML/Pose Detection Testing

### Mock Landmark Data

```typescript
// Create consistent test fixtures
export const SQUAT_LANDMARKS = {
  standing: {
    landmarks: [
      { x: 0.5, y: 0.3, z: 0, visibility: 0.9 }, // nose
      // ... all 33 landmarks
    ],
    worldLandmarks: [...],
    timestamp: Date.now(),
  },
  atDepth: {
    // Hip below knee position
    landmarks: [...],
  },
  withLateralShift: {
    // Imbalanced position
    landmarks: [...],
  },
};
```

### Confidence Testing

```typescript
it('should calculate exercise-specific confidence correctly', () => {
  const confidence = analyzer.calculateConfidence(SQUAT_LANDMARKS.standing);

  expect(confidence).toBeGreaterThan(0.7); // Squat-specific threshold
  expect(confidence).toBeLessThanOrEqual(1.0);
});
```

## Error Handling in Tests

### Error Monitoring Integration

```typescript
import { errorMonitor } from '@/shared/services/error-monitor.service';

// Mock error monitor
vi.mock('@/shared/services/error-monitor.service', () => ({
  errorMonitor: {
    reportError: vi.fn(),
  },
}));

it('should report performance degradation', async () => {
  // Simulate slow processing
  mockAnalyzer.analyzePose.mockImplementation(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
    return mockResults;
  });

  await performAnalysis();

  expect(errorMonitor.reportError).toHaveBeenCalledWith(
    expect.stringContaining('Frame processing exceeded 33ms'),
    'performance',
    'high',
    expect.objectContaining({ processingTime: expect.any(Number) }),
  );
});
```

## Integration Testing

### Camera to Analysis Pipeline

```typescript
describe('Complete Analysis Workflow', () => {
  it('should analyze squat form from camera input', async () => {
    const { result } = renderHook(() => useExerciseAnalysis(squatAnalyzer));

    // Start camera
    await act(async () => {
      await result.current.startAnalysis();
    });

    // Simulate frame processing
    await act(async () => {
      // Mock camera frame with pose data
      mockCameraFrame(SQUAT_LANDMARKS.atDepth);
      await waitForNextFrame();
    });

    // Verify analysis results
    expect(result.current.currentMetrics).toMatchObject({
      depthAchieved: true,
      depth: expect.any(Number),
      balance: expect.any(Number),
    });
  });
});
```

## Common Patterns

### Singleton Testing

```typescript
describe('Singleton Services', () => {
  beforeEach(() => {
    // Reset singleton instance
    (SquatPoseAnalyzer as any).instance = undefined;
  });

  it('should return same instance', () => {
    const instance1 = SquatPoseAnalyzer.getInstance();
    const instance2 = SquatPoseAnalyzer.getInstance();

    expect(instance1).toBe(instance2);
  });
});
```

### Worker Testing

```typescript
// Mock Web Worker
class MockWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;

  postMessage(data: any) {
    // Simulate worker processing
    setTimeout(() => {
      this.onmessage?.({
        data: { type: 'result', payload: processedData },
      } as MessageEvent);
    }, 0);
  }
}

global.Worker = MockWorker as any;
```

## Anti-Patterns to Avoid

### ❌ Never Do This

```typescript
// Testing implementation details
it('should set internal state', () => {
  const { result } = renderHook(() => useVideoElement());
  expect(result.current.videoRef.current).toBeNull(); // Testing ref directly
});

// Using any types
const calls = (mockFn as any).mock.calls; // Never use any!

// Testing without act()
mockVideoElement.play(); // Should be wrapped in act()

// Async without proper handling
it('should work', async () => {
  renderHook(() => useHook());
  // Missing waitFor or proper async handling
});
```

### ✅ Do This Instead

```typescript
// Test behavior, not implementation
it('should initialize video when stream is ready', async () => {
  const { result } = renderHook(() => useVideoElement());

  await act(async () => {
    const video = await result.current.initializeVideo(mockStream);
    expect(video.srcObject).toBe(mockStream);
  });
});

// Use proper typing
const spy = vi.spyOn(document, 'createElement');
const calls = spy.mock.calls.filter(([tag]) => tag === 'video');

// Always use act() for state updates
act(() => {
  fireEvent.click(button);
});

// Handle async properly
await waitFor(() => {
  expect(screen.getByText('Analysis complete')).toBeInTheDocument();
});
```

## Continuous Improvement

1. **Run tests before committing**: `pnpm test`
2. **Check coverage**: `pnpm test:coverage`
3. **Fix linting issues**: `pnpm lint`
4. **Update fixtures**: Keep landmark data realistic
5. **Performance benchmarks**: Run regularly to catch regressions

## Common Pitfalls to Avoid

1. **Over-mocking**: Don't mock your own code, only external dependencies
2. **Testing too much**: Each test should verify one behavior
3. **Ignoring async behavior**: Always handle promises and timing properly
4. **Skipping error cases**: Test both success and failure paths
5. **Writing tests after code**: This defeats the purpose of TDD

### Test Checklist

- [ ] Test covers one specific behavior
- [ ] Test name clearly describes what and when
- [ ] External dependencies are mocked
- [ ] Async operations are properly handled
- [ ] Both success and error cases tested
- [ ] No implementation details tested
- [ ] Test fails before implementation
- [ ] Minimal code written to pass test

Remember: The goal is to build exactly what's needed, guided by tests. Each test should push the implementation forward incrementally.