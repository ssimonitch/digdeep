import { useEffect, useRef } from 'react';

/**
 * Custom hook for managing requestAnimationFrame loops with FPS throttling
 *
 * This hook provides a clean abstraction for animation loops, handling:
 * - Automatic start/stop based on isActive flag
 * - FPS throttling to maintain target frame rate
 * - Proper cleanup on unmount
 * - Always-fresh callback access without dependency issues
 *
 * @param callback - Function to call on each frame (always gets fresh version)
 * @param isActive - Whether the animation loop should be running
 * @param targetFPS - Target frames per second (default: 30, 0 = no throttling)
 *
 * @example
 * ```typescript
 * const performAnalysis = useCallback(() => {
 *   // This can use fresh values without being in deps
 *   console.log(someValue);
 * }, [someValue]);
 *
 * useAnimationLoop(performAnalysis, isAnalyzing, 30);
 * ```
 *
 * @note When targetFPS is 0, the callback runs on every animation frame without throttling
 */
export function useAnimationLoop(callback: () => void, isActive: boolean, targetFPS = 30): void {
  // Store callback in ref to always have fresh version
  const callbackRef = useRef(callback);
  const frameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef(0);

  // Update callback ref when it changes (no useEffect needed)
  callbackRef.current = callback;

  useEffect(() => {
    if (!isActive) return;

    const frameInterval = targetFPS > 0 ? 1000 / targetFPS : 0;

    const loop = (currentTime: number) => {
      // Throttle to target FPS (0 means no throttling)
      if (targetFPS === 0 || currentTime - lastFrameTimeRef.current >= frameInterval) {
        // Call the fresh callback
        callbackRef.current();
        lastFrameTimeRef.current = currentTime;
      }

      // Schedule next frame
      frameRef.current = requestAnimationFrame(loop);
    };

    // Start the loop
    frameRef.current = requestAnimationFrame(loop);

    // Cleanup function
    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [isActive, targetFPS]);
}

/**
 * Extended version with performance monitoring
 */
export interface AnimationLoopOptions {
  /** Callback for when frame is dropped due to performance */
  onFrameDrop?: (droppedFrames: number) => void;
  /** Callback with actual FPS measurements */
  onFPSUpdate?: (fps: number) => void;
  /** Interval for FPS updates in ms (default: 1000) */
  fpsUpdateInterval?: number;
}

/**
 * Enhanced animation loop with performance monitoring
 *
 * @param callback - Function to call on each frame
 * @param isActive - Whether the animation loop should be running
 * @param targetFPS - Target frames per second (default: 30, 0 = no throttling)
 * @param options - Additional options for performance monitoring
 */
export function useAnimationLoopWithMetrics(
  callback: () => void,
  isActive: boolean,
  targetFPS = 30,
  options?: AnimationLoopOptions,
): void {
  const { onFrameDrop, onFPSUpdate, fpsUpdateInterval = 1000 } = options ?? {};

  const callbackRef = useRef(callback);
  const frameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef(0);
  const frameCountRef = useRef(0);

  // Update callback ref
  callbackRef.current = callback;

  useEffect(() => {
    if (!isActive) return;

    const frameInterval = targetFPS > 0 ? 1000 / targetFPS : 0;
    let lastFPSUpdate = performance.now();

    const loop = (currentTime: number) => {
      const deltaTime = currentTime - lastFrameTimeRef.current;

      // Check if we should process this frame (0 means no throttling)
      if (targetFPS === 0 || deltaTime >= frameInterval) {
        // Calculate exactly how many frames we should have processed
        const expectedFrames = targetFPS > 0 ? Math.floor(deltaTime / frameInterval) : 1;

        // If more than 1, we dropped frames
        if (expectedFrames > 1 && lastFrameTimeRef.current > 0) {
          const droppedFrames = expectedFrames - 1;
          onFrameDrop?.(droppedFrames);
        }

        // Process the current frame
        callbackRef.current();

        // Update timing to account for processing
        lastFrameTimeRef.current = currentTime;
        frameCountRef.current++;
      }

      // Update FPS if needed
      if (onFPSUpdate && currentTime - lastFPSUpdate >= fpsUpdateInterval) {
        const fps = (frameCountRef.current * 1000) / (currentTime - lastFPSUpdate);
        onFPSUpdate(Math.round(fps));
        frameCountRef.current = 0;
        lastFPSUpdate = currentTime;
      }

      // Schedule next frame
      frameRef.current = requestAnimationFrame(loop);
    };

    // Start the loop
    frameRef.current = requestAnimationFrame(loop);

    // Start FPS monitoring if needed
    if (onFPSUpdate) {
      frameCountRef.current = 0;
    }

    // Cleanup function
    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [isActive, targetFPS, fpsUpdateInterval, onFrameDrop, onFPSUpdate]);
}
