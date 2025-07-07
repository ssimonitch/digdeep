import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PerformanceMonitor } from './performance-monitor.service';

// Mock requestAnimationFrame and cancelAnimationFrame
const mockRequestAnimationFrame = vi.fn((cb: FrameRequestCallback) => {
  setTimeout(cb, 16); // ~60fps
  return 1;
});

const mockCancelAnimationFrame = vi.fn();
const mockNow = vi.fn();

vi.stubGlobal('requestAnimationFrame', mockRequestAnimationFrame);
vi.stubGlobal('cancelAnimationFrame', mockCancelAnimationFrame);
vi.stubGlobal('performance', {
  ...global.performance,
  now: mockNow,
});

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor;
  let currentTime = 0;

  beforeEach(() => {
    monitor = new PerformanceMonitor();
    currentTime = 0;
    mockNow.mockImplementation(() => currentTime);
    vi.clearAllMocks();
  });

  afterEach(() => {
    monitor.stop();
  });

  describe('initialization', () => {
    it('should create monitor with default values', () => {
      const metrics = monitor.getCurrentMetrics();
      expect(metrics.fps).toBe(0);
      expect(metrics.avgFps).toBe(0);
      expect(metrics.frameDrops).toBe(0);
    });

    it('should have correct performance grade thresholds', () => {
      expect(monitor.getPerformanceGrade()).toBe('poor'); // No FPS data initially
    });
  });

  describe('frame measurement', () => {
    it('should start and stop monitoring', () => {
      expect((monitor as unknown as { isRunning: boolean }).isRunning).toBe(false);

      monitor.start();
      expect((monitor as unknown as { isRunning: boolean }).isRunning).toBe(true);
      expect(mockRequestAnimationFrame).toHaveBeenCalled();

      monitor.stop();
      expect((monitor as unknown as { isRunning: boolean }).isRunning).toBe(false);
      expect(mockCancelAnimationFrame).toHaveBeenCalled();
    });

    it('should not start multiple times', () => {
      monitor.start();
      const firstCallCount = mockRequestAnimationFrame.mock.calls.length;

      monitor.start(); // Should not start again
      expect(mockRequestAnimationFrame.mock.calls.length).toBe(firstCallCount);
    });

    it('should calculate FPS correctly', () => {
      monitor.start();

      // Simulate first frame
      currentTime = 0;
      (monitor as unknown as { measureFrame: () => void }).measureFrame();

      // Simulate second frame after 16ms (60 FPS)
      currentTime = 16;
      (monitor as unknown as { measureFrame: () => void }).measureFrame();

      const metrics = monitor.getCurrentMetrics();
      expect(metrics.fps).toBeCloseTo(62.5, 1); // 1000/16 = 62.5 FPS
    });

    it('should track frame history', () => {
      monitor.start();

      // Simulate multiple frames
      for (let i = 0; i < 5; i++) {
        currentTime = i * 16;
        (monitor as unknown as { measureFrame: () => void }).measureFrame();
      }

      const metrics = monitor.getCurrentMetrics();
      expect(metrics.avgFps).toBeGreaterThan(0);
    });

    it('should limit history size', () => {
      monitor.start();

      // Simulate more frames than max history size
      for (let i = 0; i < 70; i++) {
        currentTime = i * 16;
        (monitor as unknown as { measureFrame: () => void }).measureFrame();
      }

      expect((monitor as unknown as { fpsHistory: number[] }).fpsHistory.length).toBeLessThanOrEqual(60);
    });
  });

  describe('performance grading', () => {
    it('should grade performance as excellent for high FPS and low memory', () => {
      // Mock high performance metrics
      (monitor as unknown as { fpsHistory: number[] }).fpsHistory = [30, 30, 30];

      // Mock memory (need to set it on performance object)
      vi.stubGlobal('performance', {
        ...global.performance,
        memory: {
          usedJSHeapSize: 50 * 1024 * 1024, // 50MB
          totalJSHeapSize: 100 * 1024 * 1024, // 100MB
          jsHeapSizeLimit: 200 * 1024 * 1024, // 200MB
        },
      });

      const grade = monitor.getPerformanceGrade();
      expect(grade).toBe('excellent');
    });

    it('should grade performance as poor for low FPS', () => {
      (monitor as unknown as { fpsHistory: number[] }).fpsHistory = [15, 15, 15]; // Below fair threshold

      const grade = monitor.getPerformanceGrade();
      expect(grade).toBe('poor');
    });
  });

  describe('frame drop detection', () => {
    it('should count frame drops when FPS falls below threshold', () => {
      monitor.start();

      // Simulate slow frame (125ms = 8 FPS, well below 30 FPS target)
      currentTime = 0;
      (monitor as unknown as { measureFrame: () => void }).measureFrame();
      currentTime = 125;
      (monitor as unknown as { measureFrame: () => void }).measureFrame();

      const metrics = monitor.getCurrentMetrics();
      expect(metrics.frameDrops).toBeGreaterThan(0);
    });

    it('should not count frame drops for good performance', () => {
      monitor.start();

      // Simulate good frame (16ms = ~60 FPS)
      currentTime = 0;
      (monitor as unknown as { measureFrame: () => void }).measureFrame();
      currentTime = 16;
      (monitor as unknown as { measureFrame: () => void }).measureFrame();

      const metrics = monitor.getCurrentMetrics();
      expect(metrics.frameDrops).toBe(0);
    });
  });

  describe('observers', () => {
    it('should notify observers of metrics updates', () => {
      const observer = vi.fn();
      const unsubscribe = monitor.subscribe(observer);

      monitor.start();

      // Simulate frames to trigger observer
      for (let i = 0; i < 15; i++) {
        // Needs 10+ frames to trigger notification
        currentTime = i * 16;
        (monitor as unknown as { measureFrame: () => void }).measureFrame();
      }

      expect(observer).toHaveBeenCalled();

      unsubscribe();
    });

    it('should allow unsubscribing observers', () => {
      const observer = vi.fn();
      const unsubscribe = monitor.subscribe(observer);

      unsubscribe();

      monitor.start();

      // Simulate frames
      for (let i = 0; i < 15; i++) {
        currentTime = i * 16;
        (monitor as unknown as { measureFrame: () => void }).measureFrame();
      }

      expect(observer).not.toHaveBeenCalled();
    });
  });

  describe('reset functionality', () => {
    it('should reset all metrics', () => {
      monitor.start();

      // Generate some data
      for (let i = 0; i < 5; i++) {
        currentTime = i * 100; // Slow frames to create drops
        (monitor as unknown as { measureFrame: () => void }).measureFrame();
      }

      const beforeReset = monitor.getCurrentMetrics();
      expect(beforeReset.frameDrops).toBeGreaterThan(0);

      monitor.reset();

      const afterReset = monitor.getCurrentMetrics();
      expect(afterReset.frameDrops).toBe(0);
      expect(afterReset.avgFps).toBe(0);
    });
  });

  describe('memory usage', () => {
    it('should return zero values when memory API is not available', () => {
      // Remove memory from performance
      vi.stubGlobal('performance', {
        ...global.performance,
        memory: undefined,
      });

      const metrics = monitor.getCurrentMetrics();
      expect(metrics.memoryUsage.used).toBe(0);
      expect(metrics.memoryUsage.total).toBe(0);
      expect(metrics.memoryUsage.percentage).toBe(0);
    });

    it('should calculate memory usage correctly when legacy API is available', () => {
      // Mock the modern API as unavailable (force fallback to legacy)
      vi.stubGlobal('performance', {
        ...global.performance,
        measureUserAgentSpecificMemory: undefined,
        memory: {
          usedJSHeapSize: 50 * 1024 * 1024, // 50MB
          totalJSHeapSize: 100 * 1024 * 1024, // 100MB
          jsHeapSizeLimit: 200 * 1024 * 1024, // 200MB
        },
      });

      // Also ensure crossOriginIsolated is false to disable modern API
      vi.stubGlobal('crossOriginIsolated', false);

      // Test that legacy memory API is detected correctly
      expect((monitor as unknown as { isLegacyMemoryAPIAvailable: () => boolean }).isLegacyMemoryAPIAvailable()).toBe(
        true,
      );

      // Directly test the legacy memory usage calculation
      const legacyMemoryUsage = (
        monitor as unknown as { getLegacyMemoryUsage: () => { used: number; total: number; percentage: number } }
      ).getLegacyMemoryUsage();
      expect(legacyMemoryUsage.used).toBe(50); // 50MB
      expect(legacyMemoryUsage.total).toBe(100); // 100MB
      expect(legacyMemoryUsage.percentage).toBe(25); // 50/200 * 100

      // Now set it as cached memory and test via getCurrentMetrics
      (
        monitor as unknown as { cachedMemoryUsage: { used: number; total: number; percentage: number } }
      ).cachedMemoryUsage = legacyMemoryUsage;

      const metrics = monitor.getCurrentMetrics();
      expect(metrics.memoryUsage.used).toBe(50); // 50MB
      expect(metrics.memoryUsage.total).toBe(100); // 100MB
      expect(metrics.memoryUsage.percentage).toBe(25); // 50/200 * 100
    });
  });
});
