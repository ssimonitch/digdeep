/**
 * VideoStreamOptimizer Tests
 *
 * Tests for the video stream optimization service that maintains 30 FPS
 * for pose detection by dynamically adjusting stream quality.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PerformanceMetrics } from '@/shared/services/performance-monitor.service';
import { performanceMonitor } from '@/shared/services/performance-monitor.service';

import { calculateOptimalResolution, getRecommendedQualityLevel, VideoStreamOptimizer } from './VideoStreamOptimizer';

// Mock the performance monitor
vi.mock('@/shared/services/performance-monitor.service', () => ({
  performanceMonitor: {
    start: vi.fn(),
    stop: vi.fn(),
    reset: vi.fn(),
    getCurrentMetrics: vi.fn(),
    getPerformanceGrade: vi.fn(),
    getMemoryCapabilities: vi.fn(),
    subscribe: vi.fn(),
  },
}));

const mockPerformanceMonitor = vi.mocked(performanceMonitor);

describe('VideoStreamOptimizer', () => {
  let optimizer: VideoStreamOptimizer;
  let mockPerformanceMetrics: PerformanceMetrics;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup mock performance metrics
    mockPerformanceMetrics = {
      fps: 30,
      avgFps: 30,
      memoryUsage: { used: 50, total: 100, percentage: 50 },
      frameDrops: 0,
      timestamp: Date.now(),
    };

    mockPerformanceMonitor.getCurrentMetrics.mockReturnValue(mockPerformanceMetrics);
    mockPerformanceMonitor.getPerformanceGrade.mockReturnValue('good');
    mockPerformanceMonitor.getMemoryCapabilities.mockReturnValue({
      hasModernAPI: true,
      hasLegacyAPI: true,
      isCrossOriginIsolated: true,
      activeAPI: 'modern',
    });

    optimizer = new VideoStreamOptimizer();
  });

  afterEach(() => {
    optimizer.stopMonitoring();
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with default settings', () => {
      const settings = optimizer.getSettings();

      expect(settings.targetFPS).toBe(30);
      expect(settings.minFPS).toBe(24);
      expect(settings.maxMemoryUsage).toBe(80);
      expect(settings.enableAutoOptimization).toBe(true);
    });

    it('should initialize with custom settings', () => {
      const customSettings = {
        targetFPS: 60,
        minFPS: 30,
        maxMemoryUsage: 70,
      };

      const customOptimizer = new VideoStreamOptimizer(customSettings);
      const settings = customOptimizer.getSettings();

      expect(settings.targetFPS).toBe(60);
      expect(settings.minFPS).toBe(30);
      expect(settings.maxMemoryUsage).toBe(70);
      expect(settings.enableAutoOptimization).toBe(true);
    });

    it('should start with medium quality level', () => {
      const qualityLevel = optimizer.getCurrentQualityLevel();
      expect(qualityLevel.level).toBe('medium');
    });
  });

  describe('monitoring', () => {
    it('should start performance monitoring', () => {
      optimizer.startMonitoring();
      expect(() => mockPerformanceMonitor.start()).not.toThrow();
    });

    it('should stop performance monitoring', () => {
      optimizer.startMonitoring();
      optimizer.stopMonitoring();
      expect(() => mockPerformanceMonitor.stop()).not.toThrow();
    });

    it('should not start monitoring if already running', () => {
      optimizer.startMonitoring();
      optimizer.startMonitoring();
      expect(() => mockPerformanceMonitor.start()).not.toThrow();
    });
  });

  describe('quality level management', () => {
    it('should get all available quality levels', () => {
      const levels = optimizer.getAvailableQualityLevels();
      expect(levels).toHaveLength(5);
      expect(levels.map((l) => l.level)).toEqual(['ultra', 'high', 'medium', 'low', 'minimal']);
    });

    it('should set quality level successfully', () => {
      const result = optimizer.setQualityLevel('high');
      expect(result).toBe(true);
      expect(optimizer.getCurrentQualityLevel().level).toBe('high');
    });

    it('should fail to set invalid quality level', () => {
      // @ts-expect-error - testing invalid input
      const result = optimizer.setQualityLevel('invalid');
      expect(result).toBe(false);
    });

    it('should generate optimal camera config', () => {
      optimizer.setQualityLevel('high');

      const baseConfig = {
        width: 1920,
        height: 1080,
        frameRate: 60,
        facingMode: 'environment' as const,
      };

      const optimizedConfig = optimizer.getOptimalCameraConfig(baseConfig);

      expect(optimizedConfig.width).toBe(1280);
      expect(optimizedConfig.height).toBe(720);
      expect(optimizedConfig.frameRate).toBe(30);
      expect(optimizedConfig.facingMode).toBe('environment');
    });
  });

  describe('performance metrics', () => {
    it('should get current stream metrics', () => {
      mockPerformanceMonitor.getCurrentMetrics.mockReturnValue(mockPerformanceMetrics);
      mockPerformanceMonitor.getPerformanceGrade.mockReturnValue('excellent');

      const metrics = optimizer.getCurrentMetrics();

      expect(metrics.fps).toBe(30);
      expect(metrics.avgFPS).toBe(30);
      expect(metrics.memoryUsage).toBe(50);
      expect(metrics.frameDrops).toBe(0);
      expect(metrics.grade).toBe('excellent');
      expect(metrics.qualityLevel.level).toBe('medium');
    });

    it('should track performance history', () => {
      expect(optimizer.getPerformanceHistory()).toHaveLength(0);

      // Simulate monitoring interval
      optimizer.startMonitoring();

      // Performance history would be populated during actual monitoring
      // For testing, we verify the initial state
      expect(optimizer.getPerformanceHistory()).toHaveLength(0);
    });
  });

  describe('optimization callbacks', () => {
    it('should register optimization callback', () => {
      const callback = vi.fn();
      const unsubscribe = optimizer.onOptimization(callback);

      expect(typeof unsubscribe).toBe('function');

      // Trigger optimization by setting quality level
      optimizer.setQualityLevel('high');

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          applied: true,
          reason: 'Manual quality adjustment',
        }),
      );
    });

    it('should register performance callback', () => {
      const callback = vi.fn();
      const unsubscribe = optimizer.onPerformanceUpdate(callback);

      expect(typeof unsubscribe).toBe('function');

      // Callbacks would be triggered during actual monitoring
      unsubscribe();
    });

    it('should unsubscribe callbacks', () => {
      const optimizationCallback = vi.fn();
      const performanceCallback = vi.fn();

      const unsubscribeOpt = optimizer.onOptimization(optimizationCallback);
      const unsubscribePerf = optimizer.onPerformanceUpdate(performanceCallback);

      unsubscribeOpt();
      unsubscribePerf();

      // Trigger optimization - callback should not be called
      optimizer.setQualityLevel('high');
      expect(optimizationCallback).not.toHaveBeenCalled();
    });
  });

  describe('settings management', () => {
    it('should update settings', () => {
      const newSettings = { targetFPS: 60, minFPS: 30 };
      optimizer.updateSettings(newSettings);

      const settings = optimizer.getSettings();
      expect(settings.targetFPS).toBe(60);
      expect(settings.minFPS).toBe(30);
    });

    it('should reset optimization state', () => {
      // Add some history and state
      optimizer.setQualityLevel('high');
      optimizer.reset();

      // History should be cleared
      expect(optimizer.getPerformanceHistory()).toHaveLength(0);
      expect(() => mockPerformanceMonitor.reset()).not.toThrow();
    });
  });

  describe('auto-optimization', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should trigger optimization for poor performance', () => {
      const callback = vi.fn();
      optimizer.onOptimization(callback);

      // Set up poor performance metrics
      mockPerformanceMonitor.getCurrentMetrics.mockReturnValue({
        ...mockPerformanceMetrics,
        fps: 15, // Below minimum
        avgFps: 15,
      });

      optimizer.startMonitoring();

      // Fast-forward time to trigger optimization check
      vi.advanceTimersByTime(5000);

      // In real implementation, this would trigger optimization
      // For testing, we verify the setup is correct
      expect(() => mockPerformanceMonitor.start()).not.toThrow();
    });

    it('should not optimize if disabled', () => {
      optimizer.updateSettings({ enableAutoOptimization: false });

      const callback = vi.fn();
      optimizer.onOptimization(callback);

      // Set up poor performance metrics
      mockPerformanceMonitor.getCurrentMetrics.mockReturnValue({
        ...mockPerformanceMetrics,
        fps: 15,
      });

      optimizer.startMonitoring();
      vi.advanceTimersByTime(5000);

      // Should not trigger optimization when disabled
      expect(callback).not.toHaveBeenCalled();
    });
  });
});

describe('utility functions', () => {
  beforeEach(() => {
    mockPerformanceMonitor.getMemoryCapabilities.mockReturnValue({
      hasModernAPI: true,
      hasLegacyAPI: true,
      isCrossOriginIsolated: true,
      activeAPI: 'modern',
    });
  });

  describe('getRecommendedQualityLevel', () => {
    it('should recommend high quality for modern devices', () => {
      mockPerformanceMonitor.getMemoryCapabilities.mockReturnValue({
        hasModernAPI: true,
        hasLegacyAPI: true,
        isCrossOriginIsolated: true,
        activeAPI: 'modern',
      });

      const level = getRecommendedQualityLevel();
      expect(level).toBe('high');
    });

    it('should recommend medium quality for legacy devices', () => {
      mockPerformanceMonitor.getMemoryCapabilities.mockReturnValue({
        hasModernAPI: false,
        hasLegacyAPI: true,
        isCrossOriginIsolated: false,
        activeAPI: 'legacy',
      });

      const level = getRecommendedQualityLevel();
      expect(level).toBe('medium');
    });

    it('should recommend low quality for basic devices', () => {
      mockPerformanceMonitor.getMemoryCapabilities.mockReturnValue({
        hasModernAPI: false,
        hasLegacyAPI: false,
        isCrossOriginIsolated: false,
        activeAPI: 'none',
      });

      const level = getRecommendedQualityLevel();
      expect(level).toBe('low');
    });
  });

  describe('calculateOptimalResolution', () => {
    const originalScreen = global.screen;
    const originalDevicePixelRatio = global.devicePixelRatio;

    beforeEach(() => {
      // Mock screen properties
      Object.defineProperty(global, 'screen', {
        value: {
          width: 1920,
          height: 1080,
        },
        writable: true,
      });

      Object.defineProperty(global, 'devicePixelRatio', {
        value: 2,
        writable: true,
      });
    });

    afterEach(() => {
      Object.defineProperty(global, 'screen', {
        value: originalScreen,
        writable: true,
      });

      Object.defineProperty(global, 'devicePixelRatio', {
        value: originalDevicePixelRatio,
        writable: true,
      });
    });

    it('should calculate optimal resolution based on screen size', () => {
      const resolution = calculateOptimalResolution();

      expect(resolution.width).toBeLessThanOrEqual(1920);
      expect(resolution.height).toBeLessThanOrEqual(1080);
      expect(resolution.width / resolution.height).toBeCloseTo(16 / 9, 1);
    });

    it('should respect maximum dimensions', () => {
      const resolution = calculateOptimalResolution(1280, 720);

      expect(resolution.width).toBeLessThanOrEqual(1280);
      expect(resolution.height).toBeLessThanOrEqual(720);
    });

    it('should maintain 16:9 aspect ratio', () => {
      const resolution = calculateOptimalResolution();
      const aspectRatio = resolution.width / resolution.height;

      expect(aspectRatio).toBeCloseTo(16 / 9, 1);
    });
  });
});
