import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { errorMonitor } from './error-monitor.service';
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
    vi.clearAllMocks();
    monitor = new PerformanceMonitor();
    currentTime = 0;
    mockNow.mockImplementation(() => currentTime);
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

  describe('operation tracking', () => {
    it('should track processing time for named operations', () => {
      const operationName = 'poseDetection';
      const processingTime = 15.5;

      monitor.recordOperation({
        name: operationName,
        processingTime,
        timestamp: currentTime,
        success: true,
      });

      const stats = monitor.getOperationMetrics(operationName);
      expect(stats).toBeDefined();
      expect(stats.count).toBe(1);
      expect(stats.averageTime).toBe(processingTime);
      expect(stats.successRate).toBe(1);
    });

    it('should maintain separate history for each operation type', () => {
      // Record pose detection operations
      for (let i = 0; i < 5; i++) {
        monitor.recordOperation({
          name: 'poseDetection',
          processingTime: 10 + i,
          timestamp: currentTime + i * 100,
          success: true,
        });
      }

      // Record squat analysis operations
      for (let i = 0; i < 3; i++) {
        monitor.recordOperation({
          name: 'squatAnalysis',
          processingTime: 20 + i,
          timestamp: currentTime + i * 100,
          success: true,
        });
      }

      const poseStats = monitor.getOperationMetrics('poseDetection');
      const squatStats = monitor.getOperationMetrics('squatAnalysis');

      expect(poseStats.count).toBe(5);
      expect(squatStats.count).toBe(3);
      expect(poseStats.averageTime).toBe(12); // (10+11+12+13+14)/5
      expect(squatStats.averageTime).toBe(21); // (20+21+22)/3
    });

    it('should calculate operation-specific statistics', () => {
      const operations = [
        { time: 10, success: true },
        { time: 15, success: true },
        { time: 20, success: false },
        { time: 12, success: true },
        { time: 18, success: true },
      ];

      operations.forEach((op, i) => {
        monitor.recordOperation({
          name: 'testOperation',
          processingTime: op.time,
          timestamp: currentTime + i * 100,
          success: op.success,
        });
      });

      const stats = monitor.getOperationMetrics('testOperation');
      expect(stats.count).toBe(5);
      expect(stats.averageTime).toBe(15); // (10+15+20+12+18)/5
      expect(stats.minTime).toBe(10);
      expect(stats.maxTime).toBe(20);
      expect(stats.successRate).toBe(0.8); // 4/5
    });

    it('should handle operations that do not exist', () => {
      const stats = monitor.getOperationMetrics('nonExistentOperation');
      expect(stats).toBeDefined();
      expect(stats.count).toBe(0);
      expect(stats.averageTime).toBe(0);
      expect(stats.successRate).toBe(0);
    });

    it('should limit operation history size', () => {
      // Record more operations than the history limit
      for (let i = 0; i < 150; i++) {
        monitor.recordOperation({
          name: 'bulkOperation',
          processingTime: i,
          timestamp: currentTime + i * 10,
          success: true,
        });
      }

      const stats = monitor.getOperationMetrics('bulkOperation');
      // Should keep only the most recent operations (default limit: 100)
      expect(stats.count).toBeLessThanOrEqual(100);
    });

    it('should calculate percentiles for operation times', () => {
      // Create a predictable distribution
      const times = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50];
      times.forEach((time, i) => {
        monitor.recordOperation({
          name: 'percentileTest',
          processingTime: time,
          timestamp: currentTime + i * 100,
          success: true,
        });
      });

      const stats = monitor.getOperationMetrics('percentileTest');
      expect(stats.p50).toBe(27.5); // median
      expect(stats.p95).toBeCloseTo(47.5, 0); // 95th percentile - within 0.5
      expect(stats.p99).toBeCloseTo(49.5, 0); // 99th percentile - within 0.5
    });
  });

  describe('threshold detection', () => {
    it('should detect when operations exceed time thresholds', () => {
      const violationCallback = vi.fn();

      monitor.setOperationThreshold('poseDetection', 20); // 20ms threshold
      monitor.onOperationThresholdViolation(violationCallback);

      // Record operation under threshold
      monitor.recordOperation({
        name: 'poseDetection',
        processingTime: 15,
        timestamp: 1000,
        success: true,
      });

      expect(violationCallback).not.toHaveBeenCalled();

      // Record operation over threshold
      monitor.recordOperation({
        name: 'poseDetection',
        processingTime: 25,
        timestamp: 2000,
        success: true,
      });

      expect(violationCallback).toHaveBeenCalledWith({
        type: 'operation',
        operation: 'poseDetection',
        processingTime: 25,
        threshold: 20,
        timestamp: 2000,
      });
    });

    it('should support multiple threshold listeners', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      monitor.setOperationThreshold('testOp', 10);
      monitor.onOperationThresholdViolation(callback1);
      monitor.onOperationThresholdViolation(callback2);

      monitor.recordOperation({
        name: 'testOp',
        processingTime: 15,
        timestamp: 1000,
        success: true,
      });

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });

    it('should allow updating thresholds', () => {
      const callback = vi.fn();
      monitor.onOperationThresholdViolation(callback);

      // Set initial threshold
      monitor.setOperationThreshold('dynamicOp', 20);

      // Operation at 15ms should not trigger
      monitor.recordOperation({
        name: 'dynamicOp',
        processingTime: 15,
        timestamp: 1000,
        success: true,
      });
      expect(callback).not.toHaveBeenCalled();

      // Lower threshold to 10ms
      monitor.setOperationThreshold('dynamicOp', 10);

      // Same 15ms operation should now trigger
      monitor.recordOperation({
        name: 'dynamicOp',
        processingTime: 15,
        timestamp: 2000,
        success: true,
      });
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should detect FPS threshold violations', () => {
      const callback = vi.fn();
      monitor.onFPSThresholdViolation(callback, 25); // Alert when FPS < 25

      monitor.start();

      // Simulate frames that result in low FPS
      currentTime = 0;
      (monitor as unknown as { measureFrame: () => void }).measureFrame();

      // 100ms frame time = 10 FPS (below threshold)
      currentTime = 100;
      (monitor as unknown as { measureFrame: () => void }).measureFrame();

      // Should wait for enough frames before triggering
      for (let i = 2; i < 12; i++) {
        currentTime = i * 100;
        (monitor as unknown as { measureFrame: () => void }).measureFrame();
      }

      expect(callback).toHaveBeenCalled();
      const violation = callback.mock.calls[0][0] as { type: string; currentFPS?: number; threshold: number };
      expect(violation.type).toBe('fps');
      expect(violation.currentFPS).toBeLessThan(25);
      expect(violation.threshold).toBe(25);
    });

    it('should implement hysteresis to prevent threshold flapping', () => {
      const callback = vi.fn();
      monitor.setOperationThreshold('flappingOp', 20);
      monitor.onOperationThresholdViolation(callback);

      // First violation
      monitor.recordOperation({
        name: 'flappingOp',
        processingTime: 25,
        timestamp: 1000,
        success: true,
      });
      expect(callback).toHaveBeenCalledTimes(1);

      // Subsequent violations within cooldown period should not trigger
      for (let i = 1; i < 5; i++) {
        monitor.recordOperation({
          name: 'flappingOp',
          processingTime: 25,
          timestamp: 1000 + i * 10, // Within cooldown (1010, 1020, etc)
          success: true,
        });
      }
      expect(callback).toHaveBeenCalledTimes(1); // Still just 1

      // After cooldown period, should trigger again
      monitor.recordOperation({
        name: 'flappingOp',
        processingTime: 25,
        timestamp: 6000, // After cooldown (5 seconds later)
        success: true,
      });
      expect(callback).toHaveBeenCalledTimes(2);
    });

    it('should allow unsubscribing from threshold violations', () => {
      const callback = vi.fn();
      monitor.setOperationThreshold('unsubOp', 10);

      const unsubscribe = monitor.onOperationThresholdViolation(callback);

      // Should trigger callback
      monitor.recordOperation({
        name: 'unsubOp',
        processingTime: 15,
        timestamp: 1000,
        success: true,
      });
      expect(callback).toHaveBeenCalledTimes(1);

      // Unsubscribe
      unsubscribe();

      // Should not trigger callback anymore
      monitor.recordOperation({
        name: 'unsubOp',
        processingTime: 20,
        timestamp: 2000,
        success: true,
      });
      expect(callback).toHaveBeenCalledTimes(1); // Still 1
    });
  });

  describe.skip('ErrorMonitor integration - TODO: Fix mocking issue', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      // Spy on the actual errorMonitor methods
      vi.spyOn(errorMonitor, 'reportError').mockImplementation(() => 'mocked-error-id');
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should report critical FPS drops to ErrorMonitor', () => {
      monitor.enableErrorMonitorIntegration(true);
      monitor.setFPSCriticalThreshold(20); // Critical when FPS < 20

      // Reset the last error report time to avoid rate limiting
      (monitor as unknown as { lastErrorReportTime: number }).lastErrorReportTime = 0;

      monitor.start();

      // Simulate very low FPS (5 FPS = 200ms frame time)
      currentTime = 0;
      (monitor as unknown as { measureFrame: () => void }).measureFrame();

      // Create sustained low FPS - need to reach frameCount % 10 === 0
      // The monitor needs 10+ frames in history and frameCount % 10 === 0
      for (let i = 1; i <= 20; i++) {
        currentTime = i * 200;
        (monitor as unknown as { measureFrame: () => void }).measureFrame();
      }

      // Force a check by directly calling the private method
      (monitor as unknown as { checkFPSThresholds: () => void }).checkFPSThresholds();

      // Verify ErrorMonitor was called
      expect(errorMonitor.reportError).toHaveBeenCalledWith(
        expect.stringContaining('Critical FPS drop detected'),
        'custom',
        'high',
        expect.objectContaining({
          currentFPS: expect.any(Number) as number,
          threshold: 20,
        }),
      );
    });

    it('should report operation performance degradation to ErrorMonitor', () => {
      monitor.enableErrorMonitorIntegration(true);
      monitor.setOperationThreshold('poseDetection', 30);

      // Reset the last error report time to avoid rate limiting
      (monitor as unknown as { lastErrorReportTime: number }).lastErrorReportTime = 0;

      // Multiple violations should trigger error reporting
      for (let i = 0; i < 5; i++) {
        monitor.recordOperation({
          name: 'poseDetection',
          processingTime: 50, // Well over threshold
          timestamp: 1000 + i * 100,
          success: true,
        });
      }

      expect(errorMonitor.reportError).toHaveBeenCalledWith(
        expect.stringContaining('Operation performance degraded'),
        'custom',
        'medium',
        expect.objectContaining({
          operation: 'poseDetection',
          averageTime: expect.any(Number) as number,
          threshold: 30,
          violationCount: expect.any(Number) as number,
        }),
      );
    });

    it('should not spam ErrorMonitor with repeated violations', () => {
      monitor.enableErrorMonitorIntegration(true);
      monitor.setOperationThreshold('spamTest', 10);

      // Reset the last error report time to avoid rate limiting
      (monitor as unknown as { lastErrorReportTime: number }).lastErrorReportTime = 0;

      // Many violations in quick succession
      for (let i = 0; i < 20; i++) {
        monitor.recordOperation({
          name: 'spamTest',
          processingTime: 20,
          timestamp: 1000 + i * 10,
          success: true,
        });
      }

      // Should be rate-limited
      expect(errorMonitor.reportError).toHaveBeenCalledTimes(1);
    });

    it('should include performance context in error reports', () => {
      monitor.enableErrorMonitorIntegration(true);
      monitor.setOperationThreshold('contextTest', 15);

      // Reset the last error report time and violation times
      (monitor as unknown as { lastErrorReportTime: number }).lastErrorReportTime = 0;
      (monitor as unknown as { lastViolationTime: Map<string, number> }).lastViolationTime.clear();

      // Create some history
      for (let i = 0; i < 10; i++) {
        monitor.recordOperation({
          name: 'contextTest',
          processingTime: i < 5 ? 10 : 25, // Half good, half bad
          timestamp: 1000 + i * 100,
          success: i % 2 === 0,
        });
      }

      expect(errorMonitor.reportError).toHaveBeenCalledWith(
        expect.any(String),
        'custom',
        expect.any(String),
        expect.objectContaining({
          operation: 'contextTest',
          successRate: 0.5,
          p95: expect.any(Number) as number,
          recentViolations: expect.any(Number) as number,
        }),
      );
    });

    it('should respect ErrorMonitor integration toggle', () => {
      monitor.enableErrorMonitorIntegration(false);
      monitor.setOperationThreshold('disabledTest', 10);

      monitor.recordOperation({
        name: 'disabledTest',
        processingTime: 50,
        timestamp: 1000,
        success: true,
      });

      expect(errorMonitor.reportError).not.toHaveBeenCalled();
    });

    it('should report memory pressure issues', () => {
      vi.clearAllMocks();
      monitor.enableErrorMonitorIntegration(true);

      // Reset the last error report time to avoid rate limiting
      (monitor as unknown as { lastErrorReportTime: number }).lastErrorReportTime = 0;

      // Mock high memory usage
      (
        monitor as unknown as { cachedMemoryUsage: { used: number; total: number; percentage: number } }
      ).cachedMemoryUsage = { used: 900, total: 1000, percentage: 90 };

      // Trigger memory check multiple times to ensure it's called
      monitor.checkMemoryPressure();

      // Trigger memory check again
      monitor.checkMemoryPressure();

      expect(errorMonitor.reportError).toHaveBeenCalledWith(
        expect.stringContaining('High memory usage detected'),
        'custom',
        'high',
        expect.objectContaining({
          memoryUsage: expect.objectContaining({
            used: 900,
            total: 1000,
            percentage: 90,
          }) as Record<string, unknown>,
        }),
      );
    });
  });
});
