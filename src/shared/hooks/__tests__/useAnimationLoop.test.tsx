import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAnimationLoopWithMetrics } from '../useAnimationLoop';

describe('FPS Calculation - TDD Failing Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Helper hook to track FPS using the built-in metrics
  function useAnimationLoopWithFPSTracking(callback: () => void, isActive: boolean, targetFPS = 30) {
    let currentFPS = 0;
    const fpsHistory: number[] = [];
    const droppedFramesHistory: number[] = [];

    const onFPSUpdate = (fps: number) => {
      currentFPS = fps;
      fpsHistory.push(fps);
    };

    const onFrameDrop = (droppedFrames: number) => {
      droppedFramesHistory.push(droppedFrames);
    };

    useAnimationLoopWithMetrics(callback, isActive, targetFPS, {
      onFPSUpdate,
      onFrameDrop,
      fpsUpdateInterval: 1000, // Update FPS every second
    });

    return {
      get fps() {
        return currentFPS;
      },
      fpsHistory,
      droppedFramesHistory,
    };
  }

  it('should maintain consistent FPS display during frame counter reset', () => {
    // Test that FPS calculation remains stable when internal counters reset

    const callback = vi.fn();

    const { result } = renderHook(() => useAnimationLoopWithFPSTracking(callback, true, 30));

    // Initial FPS should be 0 (no data yet)
    expect(result.current.fps).toBe(0);

    // Simulate frames for 1 second using requestAnimationFrame
    // With 30 FPS target, we expect ~30 frames in 1 second
    act(() => {
      // Advance frames for roughly 1 second
      for (let i = 0; i < 30; i++) {
        vi.advanceTimersToNextFrame();
        vi.advanceTimersByTime(33); // ~30 FPS timing
      }

      // Complete the first second to trigger FPS calculation
      vi.advanceTimersByTime(10);
    });

    // Now we should have our first FPS reading
    // The FPS might be slightly lower due to throttling overhead
    expect(result.current.fps).toBeGreaterThan(18);
    expect(result.current.fps).toBeLessThan(35);

    // Continue for another second to test counter reset
    act(() => {
      for (let i = 0; i < 30; i++) {
        vi.advanceTimersByTime(33);
      }
    });

    // FPS should remain stable after counter reset
    expect(result.current.fps).toBeGreaterThan(18);
    expect(result.current.fps).toBeLessThan(35);

    // Check FPS history - should have 2 readings
    expect(result.current.fpsHistory).toHaveLength(2);
    result.current.fpsHistory.forEach((fps) => {
      expect(fps).toBeGreaterThan(18);
      expect(fps).toBeLessThan(35);
    });
  });

  it('should calculate FPS correctly across multiple seconds', () => {
    // Test that FPS remains stable over time

    const callback = vi.fn();
    const { result } = renderHook(() => useAnimationLoopWithFPSTracking(callback, true, 30));

    // Simulate 3 seconds of animation at 30 FPS
    act(() => {
      for (let second = 0; second < 3; second++) {
        // Each second: advance frames and time
        for (let frame = 0; frame < 30; frame++) {
          vi.advanceTimersToNextFrame();
          vi.advanceTimersByTime(33);
        }
        // Make sure we complete each second (30 * 33 = 990ms, need 10ms more)
        vi.advanceTimersByTime(10);
      }
    });

    const fpsHistory = result.current.fpsHistory;

    // Should have at least 3 FPS readings (one per second minimum)
    expect(fpsHistory.length).toBeGreaterThanOrEqual(3);
    expect(fpsHistory.length).toBeLessThanOrEqual(4); // Allow for timing variations

    // All readings should be reasonable (not 0, not extreme)
    fpsHistory.forEach((fps: number) => {
      expect(fps).toBeGreaterThan(0);
      expect(fps).toBeLessThan(100); // Reasonable upper bound

      // FPS should be relatively stable (allow for throttling overhead)
      expect(fps).toBeGreaterThan(18);
      expect(fps).toBeLessThan(35);
    });

    // Verify callbacks were called as expected
    expect(callback.mock.calls.length).toBeGreaterThanOrEqual(85); // At least 85% of expected 90 frames
    expect(callback.mock.calls.length).toBeLessThanOrEqual(95); // At most a few extra frames
  });

  it('should handle irregular frame timing gracefully', () => {
    // Test with irregular frame timing (common in real scenarios)

    const callback = vi.fn();
    const { result } = renderHook(() => useAnimationLoopWithFPSTracking(callback, true, 30));

    // Simulate irregular frame timing over 2 seconds
    const frameTimes = [
      // First second - mix of fast and slow frames
      16, 33, 50, 16, 33, 100, 16, 33, 50, 16, 33, 50, 16, 33, 50, 16, 33, 50, 16, 33, 50, 16, 33, 50, 16, 33, 100,
      // Padding to complete first second
      145,
      // Second second - more irregular timing
      100, 16, 16, 50, 33, 33, 33, 100, 16, 50, 33, 16, 100, 50, 33, 16, 16, 50, 33, 100,
      // Padding to complete second second
      234,
    ];

    act(() => {
      frameTimes.forEach((time) => {
        vi.advanceTimersByTime(time);
      });
    });

    // Should have 2 FPS readings
    expect(result.current.fpsHistory).toHaveLength(2);

    // Even with irregular timing, FPS should be reasonable
    result.current.fpsHistory.forEach((fps) => {
      expect(fps).toBeGreaterThan(0);
      expect(fps).toBeLessThan(120); // Reasonable max for displays
      // With throttling at 30 FPS, we shouldn't exceed target by much
      expect(fps).toBeLessThanOrEqual(35);
    });

    // Check for dropped frames
    if (result.current.droppedFramesHistory.length > 0) {
      // Some frames might be dropped with irregular timing
      const totalDropped = result.current.droppedFramesHistory.reduce((sum, dropped) => sum + dropped, 0);
      expect(totalDropped).toBeLessThan(10); // Should not drop too many frames
    }
  });

  it('should provide stable FPS readings for UI display', () => {
    // Test that FPS values are stable enough for UI display

    const callback = vi.fn();
    const { result } = renderHook(() => useAnimationLoopWithFPSTracking(callback, true, 30));

    // Simulate 5 seconds of mostly stable animation with occasional hitches
    act(() => {
      for (let second = 0; second < 5; second++) {
        // Most frames at target rate
        for (let frame = 0; frame < 28; frame++) {
          vi.advanceTimersToNextFrame();
          vi.advanceTimersByTime(33);
        }

        // Occasional hitch (simulate real-world conditions)
        if (second === 2) {
          vi.advanceTimersByTime(100); // One slow frame
        } else {
          vi.advanceTimersByTime(76); // Normal completion (28 * 33 = 924, need 76ms more)
        }
      }
    });

    const fpsHistory = result.current.fpsHistory;

    // Should have at least 5 FPS readings (one per second)
    expect(fpsHistory.length).toBeGreaterThanOrEqual(5);
    expect(fpsHistory.length).toBeLessThanOrEqual(7); // Allow for timing variations

    // Check for stability
    for (let i = 1; i < fpsHistory.length; i++) {
      const fpsDiff = Math.abs(fpsHistory[i] - fpsHistory[i - 1]);

      // FPS shouldn't jump by more than 10 FPS between readings
      expect(fpsDiff).toBeLessThan(10);

      // All readings should be reasonable
      expect(fpsHistory[i]).toBeGreaterThan(20); // Allow for some variation
      expect(fpsHistory[i]).toBeLessThan(35);
    }

    // Average FPS should be reasonable (allow for throttling overhead)
    const avgFPS = fpsHistory.reduce((sum, fps) => sum + fps, 0) / fpsHistory.length;
    expect(avgFPS).toBeGreaterThan(18);
    expect(avgFPS).toBeLessThan(35);
  });
});
