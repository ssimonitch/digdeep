/**
 * Video Stream Optimizer for Real-time Pose Detection
 *
 * Optimizes camera stream performance to maintain 30 FPS target for pose detection
 * by dynamically adjusting video constraints based on real-time performance metrics.
 */

import { errorMonitor } from '@/shared/services/error-monitor.service';
import { type PerformanceMetrics, performanceMonitor } from '@/shared/services/performance-monitor.service';

import type { CameraConfig } from '../types';

export interface StreamOptimizationSettings {
  /** Target FPS for pose detection */
  targetFPS: number;
  /** Minimum acceptable FPS before optimization triggers */
  minFPS: number;
  /** Maximum acceptable memory usage percentage */
  maxMemoryUsage: number;
  /** How often to check performance metrics (ms) */
  checkInterval: number;
  /** Number of consecutive poor performance samples before optimization */
  optimizationThreshold: number;
  /** Enable automatic quality adjustment */
  enableAutoOptimization: boolean;
}

export interface StreamQualityLevel {
  /** Quality level identifier */
  level: 'ultra' | 'high' | 'medium' | 'low' | 'minimal';
  /** Display name for UI */
  label: string;
  /** Video resolution */
  resolution: { width: number; height: number };
  /** Target frame rate */
  frameRate: number;
  /** Expected performance impact */
  performanceImpact: 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
  /** Minimum device capability required */
  minDeviceGrade: 'basic' | 'mid' | 'high' | 'flagship';
}

export interface OptimizationResult {
  /** Whether optimization was applied */
  applied: boolean;
  /** Previous quality level */
  previousLevel: StreamQualityLevel;
  /** New quality level */
  newLevel: StreamQualityLevel;
  /** Reason for optimization */
  reason: string;
  /** Performance metrics that triggered optimization */
  triggerMetrics: PerformanceMetrics;
  /** Timestamp of optimization */
  timestamp: number;
}

export interface StreamPerformanceMetrics {
  /** Current FPS */
  fps: number;
  /** Average FPS over time window */
  avgFPS: number;
  /** Memory usage percentage */
  memoryUsage: number;
  /** Number of frame drops */
  frameDrops: number;
  /** Processing time per frame (ms) */
  processingTime: number;
  /** Stream resolution */
  resolution: { width: number; height: number };
  /** Current quality level */
  qualityLevel: StreamQualityLevel;
  /** Performance grade */
  grade: 'excellent' | 'good' | 'fair' | 'poor';
}

export type OptimizationCallback = (result: OptimizationResult) => void;
export type PerformanceCallback = (metrics: StreamPerformanceMetrics) => void;

export class VideoStreamOptimizer {
  private settings: StreamOptimizationSettings;
  private currentQualityLevel: StreamQualityLevel;
  private performanceHistory: PerformanceMetrics[] = [];
  private optimizationCallbacks: OptimizationCallback[] = [];
  private performanceCallbacks: PerformanceCallback[] = [];
  private monitoringInterval: number | null = null;
  private isMonitoring = false;
  private consecutivePoorPerformance = 0;
  private lastOptimizationTime = 0;
  private readonly minOptimizationInterval = 5000; // 5 seconds between optimizations

  private readonly qualityLevels: StreamQualityLevel[] = [
    {
      level: 'ultra',
      label: 'Ultra Quality',
      resolution: { width: 1920, height: 1080 },
      frameRate: 60,
      performanceImpact: 'very_high',
      minDeviceGrade: 'flagship',
    },
    {
      level: 'high',
      label: 'High Quality',
      resolution: { width: 1280, height: 720 },
      frameRate: 30,
      performanceImpact: 'high',
      minDeviceGrade: 'high',
    },
    {
      level: 'medium',
      label: 'Medium Quality',
      resolution: { width: 960, height: 540 },
      frameRate: 30,
      performanceImpact: 'medium',
      minDeviceGrade: 'mid',
    },
    {
      level: 'low',
      label: 'Low Quality',
      resolution: { width: 640, height: 360 },
      frameRate: 30,
      performanceImpact: 'low',
      minDeviceGrade: 'basic',
    },
    {
      level: 'minimal',
      label: 'Minimal Quality',
      resolution: { width: 480, height: 270 },
      frameRate: 24,
      performanceImpact: 'very_low',
      minDeviceGrade: 'basic',
    },
  ];

  constructor(initialSettings?: Partial<StreamOptimizationSettings>) {
    this.settings = {
      targetFPS: 30,
      minFPS: 24,
      maxMemoryUsage: 80,
      checkInterval: 1000,
      optimizationThreshold: 3,
      enableAutoOptimization: true,
      ...initialSettings,
    };

    // Start with medium quality as default
    this.currentQualityLevel = this.qualityLevels.find((q) => q.level === 'medium')!;
  }

  /**
   * Start monitoring stream performance
   */
  startMonitoring(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    performanceMonitor.start();

    this.monitoringInterval = window.setInterval(() => {
      this.checkPerformance();
    }, this.settings.checkInterval);
  }

  /**
   * Stop monitoring stream performance
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    performanceMonitor.stop();
  }

  /**
   * Get current stream performance metrics
   */
  getCurrentMetrics(): StreamPerformanceMetrics {
    const perfMetrics = performanceMonitor.getCurrentMetrics();
    const grade = performanceMonitor.getPerformanceGrade();

    return {
      fps: perfMetrics.fps,
      avgFPS: perfMetrics.avgFps,
      memoryUsage: perfMetrics.memoryUsage.percentage,
      frameDrops: perfMetrics.frameDrops,
      processingTime: this.calculateProcessingTime(),
      resolution: this.currentQualityLevel.resolution,
      qualityLevel: this.currentQualityLevel,
      grade,
    };
  }

  /**
   * Get optimal camera configuration based on current performance
   */
  getOptimalCameraConfig(baseConfig: CameraConfig): CameraConfig {
    const qualityLevel = this.currentQualityLevel;

    return {
      ...baseConfig,
      width: qualityLevel.resolution.width,
      height: qualityLevel.resolution.height,
      frameRate: qualityLevel.frameRate,
    };
  }

  /**
   * Manually set quality level
   */
  setQualityLevel(level: StreamQualityLevel['level']): boolean {
    const qualityLevel = this.qualityLevels.find((q) => q.level === level);
    if (!qualityLevel) return false;

    const previousLevel = this.currentQualityLevel;
    this.currentQualityLevel = qualityLevel;

    // Notify callbacks about manual optimization
    const result: OptimizationResult = {
      applied: true,
      previousLevel,
      newLevel: qualityLevel,
      reason: 'Manual quality adjustment',
      triggerMetrics: performanceMonitor.getCurrentMetrics(),
      timestamp: Date.now(),
    };

    this.notifyOptimizationCallbacks(result);
    return true;
  }

  /**
   * Get available quality levels
   */
  getAvailableQualityLevels(): StreamQualityLevel[] {
    return [...this.qualityLevels];
  }

  /**
   * Get current quality level
   */
  getCurrentQualityLevel(): StreamQualityLevel {
    return this.currentQualityLevel;
  }

  /**
   * Update optimization settings
   */
  updateSettings(newSettings: Partial<StreamOptimizationSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
  }

  /**
   * Get current optimization settings
   */
  getSettings(): StreamOptimizationSettings {
    return { ...this.settings };
  }

  /**
   * Subscribe to optimization events
   */
  onOptimization(callback: OptimizationCallback): () => void {
    this.optimizationCallbacks.push(callback);
    return () => {
      const index = this.optimizationCallbacks.indexOf(callback);
      if (index > -1) {
        this.optimizationCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Subscribe to performance updates
   */
  onPerformanceUpdate(callback: PerformanceCallback): () => void {
    this.performanceCallbacks.push(callback);
    return () => {
      const index = this.performanceCallbacks.indexOf(callback);
      if (index > -1) {
        this.performanceCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Get optimization history
   */
  getPerformanceHistory(): PerformanceMetrics[] {
    return [...this.performanceHistory];
  }

  /**
   * Reset performance history and optimization state
   */
  reset(): void {
    this.performanceHistory = [];
    this.consecutivePoorPerformance = 0;
    this.lastOptimizationTime = 0;
    performanceMonitor.reset();
  }

  private checkPerformance(): void {
    const metrics = performanceMonitor.getCurrentMetrics();

    // Store metrics in history
    this.performanceHistory.push(metrics);
    if (this.performanceHistory.length > 60) {
      // Keep last 60 samples
      this.performanceHistory.shift();
    }

    // Check if performance is poor
    const isPoorPerformance = this.isPoorPerformance(metrics);

    if (isPoorPerformance) {
      this.consecutivePoorPerformance++;
    } else {
      this.consecutivePoorPerformance = 0;
    }

    // Trigger optimization if needed
    if (this.shouldOptimize()) {
      this.optimizeStream(metrics);
    }

    // Notify performance callbacks
    const streamMetrics = this.getCurrentMetrics();
    this.notifyPerformanceCallbacks(streamMetrics);
  }

  private isPoorPerformance(metrics: PerformanceMetrics): boolean {
    return (
      metrics.fps < this.settings.minFPS ||
      metrics.avgFps < this.settings.minFPS ||
      metrics.memoryUsage.percentage > this.settings.maxMemoryUsage
    );
  }

  private shouldOptimize(): boolean {
    if (!this.settings.enableAutoOptimization) return false;

    const timeSinceLastOptimization = Date.now() - this.lastOptimizationTime;
    const hasConsecutivePoorPerformance = this.consecutivePoorPerformance >= this.settings.optimizationThreshold;
    const hasWaitedEnough = timeSinceLastOptimization >= this.minOptimizationInterval;

    return hasConsecutivePoorPerformance && hasWaitedEnough;
  }

  private optimizeStream(triggerMetrics: PerformanceMetrics): void {
    const currentLevelIndex = this.qualityLevels.findIndex((q) => q.level === this.currentQualityLevel.level);

    // Try to downgrade quality if not already at minimum
    if (currentLevelIndex < this.qualityLevels.length - 1) {
      const previousLevel = this.currentQualityLevel;
      const newLevel = this.qualityLevels[currentLevelIndex + 1];

      this.currentQualityLevel = newLevel;
      this.lastOptimizationTime = Date.now();
      this.consecutivePoorPerformance = 0;

      const result: OptimizationResult = {
        applied: true,
        previousLevel,
        newLevel,
        reason: this.getOptimizationReason(triggerMetrics),
        triggerMetrics,
        timestamp: Date.now(),
      };

      this.notifyOptimizationCallbacks(result);
    }
  }

  private getOptimizationReason(metrics: PerformanceMetrics): string {
    const reasons: string[] = [];

    if (metrics.fps < this.settings.minFPS) {
      reasons.push(`Low FPS: ${metrics.fps.toFixed(1)} (target: ${this.settings.targetFPS})`);
    }

    if (metrics.avgFps < this.settings.minFPS) {
      reasons.push(`Low average FPS: ${metrics.avgFps.toFixed(1)} (target: ${this.settings.targetFPS})`);
    }

    if (metrics.memoryUsage.percentage > this.settings.maxMemoryUsage) {
      reasons.push(`High memory usage: ${metrics.memoryUsage.percentage}% (max: ${this.settings.maxMemoryUsage}%)`);
    }

    return reasons.length > 0 ? reasons.join(', ') : 'Performance optimization';
  }

  private calculateProcessingTime(): number {
    // Estimate processing time based on recent FPS history
    if (this.performanceHistory.length < 2) return 0;

    const recentMetrics = this.performanceHistory.slice(-10);
    const avgFps = recentMetrics.reduce((sum, m) => sum + m.fps, 0) / recentMetrics.length;

    return avgFps > 0 ? 1000 / avgFps : 0;
  }

  private notifyOptimizationCallbacks(result: OptimizationResult): void {
    this.optimizationCallbacks.forEach((callback) => {
      try {
        callback(result);
      } catch (error) {
        errorMonitor.reportError(
          `Error in optimization callback: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'custom',
          'medium',
          { error: error instanceof Error ? error.message : String(error) },
        );
      }
    });
  }

  private notifyPerformanceCallbacks(metrics: StreamPerformanceMetrics): void {
    this.performanceCallbacks.forEach((callback) => {
      try {
        callback(metrics);
      } catch (error) {
        errorMonitor.reportError(
          `Error in performance callback: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'custom',
          'medium',
          { error: error instanceof Error ? error.message : String(error) },
        );
      }
    });
  }
}

/**
 * Get recommended quality level based on device capabilities
 */
export function getRecommendedQualityLevel(): StreamQualityLevel['level'] {
  const capabilities = performanceMonitor.getMemoryCapabilities();

  // Use simple heuristics based on available APIs and estimated device capability
  if (capabilities.hasModernAPI && capabilities.isCrossOriginIsolated) {
    return 'high'; // Modern devices with good security setup
  }

  if (capabilities.hasLegacyAPI) {
    return 'medium'; // Older devices with basic memory monitoring
  }

  // No memory monitoring available, be conservative
  return 'low';
}

/**
 * Calculate optimal resolution based on screen size and device pixel ratio
 */
export function calculateOptimalResolution(maxWidth = 1920, maxHeight = 1080): { width: number; height: number } {
  const dpr = window.devicePixelRatio || 1;
  const screenWidth = window.screen.width;
  const screenHeight = window.screen.height;

  // Calculate optimal resolution considering DPR but capped at max values
  const optimalWidth = Math.min(Math.floor(screenWidth / dpr), maxWidth);
  const optimalHeight = Math.min(Math.floor(screenHeight / dpr), maxHeight);

  // Ensure 16:9 aspect ratio for consistent experience
  const aspectRatio = 16 / 9;
  const widthFromHeight = Math.floor(optimalHeight * aspectRatio);
  const heightFromWidth = Math.floor(optimalWidth / aspectRatio);

  if (widthFromHeight <= optimalWidth) {
    return { width: widthFromHeight, height: optimalHeight };
  } else {
    return { width: optimalWidth, height: heightFromWidth };
  }
}
