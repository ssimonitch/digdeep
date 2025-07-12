import { errorMonitor as defaultErrorMonitor } from './error-monitor.service';

export interface MemoryUsage {
  used: number;
  total: number;
  percentage: number;
}

export interface PerformanceMetrics {
  fps: number;
  avgFps: number;
  memoryUsage: MemoryUsage;
  frameDrops: number;
  timestamp: number;
}

export interface OperationMetrics {
  name: string;
  processingTime: number;
  timestamp: number;
  success: boolean;
}

export interface OperationStats {
  count: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  successRate: number;
  p50: number;
  p95: number;
  p99: number;
}

export interface ThresholdViolation {
  type: 'operation' | 'fps';
  operation?: string;
  processingTime?: number;
  currentFPS?: number;
  threshold: number;
  timestamp: number;
}

// TypeScript interfaces for the new Memory API
interface MemoryMeasurement {
  bytes: number;
  breakdown: MemoryBreakdownEntry[];
}

interface MemoryBreakdownEntry {
  bytes: number;
  attribution: MemoryAttribution[];
  types: string[];
}

interface MemoryAttribution {
  url?: string;
  container?: {
    id: string;
    src?: string;
  };
  scope?: string;
}

// Extend Performance interface for modern memory API
declare global {
  interface Performance {
    measureUserAgentSpecificMemory?: () => Promise<MemoryMeasurement>;
  }
}

export type PerformanceGrade = 'excellent' | 'good' | 'fair' | 'poor';

export interface PerformanceGradingThresholds {
  excellent: { minFps: number; maxMemoryPercentage: number };
  good: { minFps: number; maxMemoryPercentage: number };
  fair: { minFps: number; maxMemoryPercentage: number };
}

export class PerformanceMonitor {
  private errorMonitor: typeof defaultErrorMonitor;
  private frameCount = 0;
  private lastFrameTime = 0;
  private fpsHistory: number[] = [];
  private readonly maxHistorySize = 60;
  private isRunning = false;
  private animationFrameId: number | null = null;
  private observers: ((metrics: PerformanceMetrics) => void)[] = [];
  private targetFps = 30;
  private frameDropCount = 0;

  // Memory monitoring state
  private cachedMemoryUsage: MemoryUsage = { used: 0, total: 0, percentage: 0 };
  private lastMemoryMeasurement = 0;
  private readonly memoryMeasurementInterval = 1000; // Update memory every 1 second
  private memoryMeasurementInProgress = false;

  private readonly gradingThresholds: PerformanceGradingThresholds = {
    excellent: { minFps: 28, maxMemoryPercentage: 60 },
    good: { minFps: 24, maxMemoryPercentage: 75 },
    fair: { minFps: 20, maxMemoryPercentage: 85 },
  };

  // Operation tracking
  private operationHistory = new Map<string, OperationMetrics[]>();
  private operationThresholds = new Map<string, number>();
  private readonly maxOperationHistorySize = 100;

  // Threshold violation tracking
  private operationViolationCallbacks: ((violation: ThresholdViolation) => void)[] = [];
  private fpsViolationCallbacks: { callback: (violation: ThresholdViolation) => void; threshold: number }[] = [];
  private lastViolationTime = new Map<string, number>();
  private readonly violationCooldownMs = 1000; // 1 second cooldown

  // Error monitor integration
  private errorMonitorEnabled = false;
  private fpsCriticalThreshold = 15;
  private lastErrorReportTime = -Infinity; // Initialize to a time in the past to allow first error to report
  private readonly errorReportCooldownMs = 5000; // 5 seconds

  constructor(errorMonitorInstance?: typeof defaultErrorMonitor) {
    this.errorMonitor = errorMonitorInstance ?? defaultErrorMonitor;
  }

  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.lastFrameTime = performance.now();

    // Initialize memory measurement
    void this.updateMemoryUsage();

    this.measureFrame();
  }

  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  reset(): void {
    this.frameCount = 0;
    this.fpsHistory = [];
    this.frameDropCount = 0;
  }

  subscribe(observer: (metrics: PerformanceMetrics) => void): () => void {
    this.observers.push(observer);
    return () => {
      const index = this.observers.indexOf(observer);
      if (index > -1) {
        this.observers.splice(index, 1);
      }
    };
  }

  getCurrentMetrics(): PerformanceMetrics {
    return {
      fps: this.getCurrentFps(),
      avgFps: this.getAverageFps(),
      memoryUsage: this.getMemoryUsage(),
      frameDrops: this.frameDropCount,
      timestamp: performance.now(),
    };
  }

  getPerformanceGrade(): PerformanceGrade {
    const metrics = this.getCurrentMetrics();
    const { fps, memoryUsage } = metrics;

    if (
      fps >= this.gradingThresholds.excellent.minFps &&
      memoryUsage.percentage <= this.gradingThresholds.excellent.maxMemoryPercentage
    ) {
      return 'excellent';
    }

    if (
      fps >= this.gradingThresholds.good.minFps &&
      memoryUsage.percentage <= this.gradingThresholds.good.maxMemoryPercentage
    ) {
      return 'good';
    }

    if (
      fps >= this.gradingThresholds.fair.minFps &&
      memoryUsage.percentage <= this.gradingThresholds.fair.maxMemoryPercentage
    ) {
      return 'fair';
    }

    return 'poor';
  }

  getMemoryCapabilities(): {
    hasModernAPI: boolean;
    hasLegacyAPI: boolean;
    isCrossOriginIsolated: boolean;
    activeAPI: 'modern' | 'legacy' | 'none';
  } {
    const hasModernAPI = this.isModernMemoryAPIAvailable();
    const hasLegacyAPI = this.isLegacyMemoryAPIAvailable();
    const isCrossOriginIsolated = this.isCrossOriginIsolated();

    let activeAPI: 'modern' | 'legacy' | 'none' = 'none';
    if (hasModernAPI) {
      activeAPI = 'modern';
    } else if (hasLegacyAPI) {
      activeAPI = 'legacy';
    }

    return {
      hasModernAPI,
      hasLegacyAPI,
      isCrossOriginIsolated,
      activeAPI,
    };
  }

  resetErrorReportTime(): void {
    this.lastErrorReportTime = -Infinity;
  }

  resetLastViolationTime(): void {
    this.lastViolationTime.clear();
  }

  measureFrame = (): void => {
    if (!this.isRunning) return;

    const currentTime = performance.now();
    const deltaTime = currentTime - this.lastFrameTime;

    if (deltaTime > 0) {
      const currentFps = 1000 / deltaTime;
      this.fpsHistory.push(currentFps);

      if (this.fpsHistory.length > this.maxHistorySize) {
        this.fpsHistory.shift();
      }

      if (currentFps < this.targetFps * 0.8) {
        this.frameDropCount++;
      }

      this.frameCount++;
      this.lastFrameTime = currentTime;

      if (this.frameCount % 10 === 0) {
        // Trigger memory measurement (async, non-blocking)
        void this.updateMemoryUsage();

        const metrics = this.getCurrentMetrics();
        this.notifyObservers(metrics);

        // Check FPS thresholds
        this.checkFPSThresholds();
      }
    }

    this.animationFrameId = requestAnimationFrame(this.measureFrame);
  };

  private getCurrentFps(): number {
    if (this.fpsHistory.length === 0) return 0;
    return this.fpsHistory[this.fpsHistory.length - 1] || 0;
  }

  private getAverageFps(): number {
    if (this.fpsHistory.length === 0) return 0;
    const sum = this.fpsHistory.reduce((acc, fps) => acc + fps, 0);
    return sum / this.fpsHistory.length;
  }

  private async updateMemoryUsage(): Promise<void> {
    if (this.memoryMeasurementInProgress) return;

    const now = performance.now();
    if (now - this.lastMemoryMeasurement < this.memoryMeasurementInterval) {
      return;
    }

    this.memoryMeasurementInProgress = true;
    this.lastMemoryMeasurement = now;

    try {
      const memoryUsage = await this.measureMemory();
      this.cachedMemoryUsage = memoryUsage;
    } catch {
      // Measurement failed, keep cached values
    } finally {
      this.memoryMeasurementInProgress = false;
    }
  }

  private async measureMemory(): Promise<MemoryUsage> {
    // Try modern API first
    if (this.isModernMemoryAPIAvailable()) {
      try {
        const measurement = await performance.measureUserAgentSpecificMemory!();
        const totalBytes = measurement.bytes;
        const usedMB = Math.round(totalBytes / (1024 * 1024));

        // For the modern API, we don't have a clear "total" or "limit" concept
        // So we'll use the current usage as both used and total, with 100% usage
        // This is a limitation but shows actual memory consumption
        return {
          used: usedMB,
          total: usedMB,
          percentage: 100, // We only know current usage, not limits
        };
      } catch {
        // Fall through to legacy API
      }
    }

    // Fall back to legacy API (deprecated but still functional)
    if (this.isLegacyMemoryAPIAvailable()) {
      return this.getLegacyMemoryUsage();
    }

    // No memory API available
    return {
      used: 0,
      total: 0,
      percentage: 0,
    };
  }

  private isModernMemoryAPIAvailable(): boolean {
    return typeof performance.measureUserAgentSpecificMemory === 'function' && this.isCrossOriginIsolated();
  }

  private isCrossOriginIsolated(): boolean {
    return typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated;
  }

  private isLegacyMemoryAPIAvailable(): boolean {
    return 'memory' in performance && (performance as unknown as { memory?: unknown }).memory != null;
  }

  private getLegacyMemoryUsage(): MemoryUsage {
    const memory = (
      performance as unknown as {
        memory: {
          usedJSHeapSize: number;
          totalJSHeapSize: number;
          jsHeapSizeLimit: number;
        };
      }
    ).memory;

    return {
      used: Math.round(memory.usedJSHeapSize / (1024 * 1024)), // MB
      total: Math.round(memory.totalJSHeapSize / (1024 * 1024)), // MB
      percentage: Math.round((memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100),
    };
  }

  getMemoryUsage(): MemoryUsage {
    return this.cachedMemoryUsage;
  }

  private notifyObservers(metrics: PerformanceMetrics): void {
    this.observers.forEach((observer) => observer(metrics));
  }

  // Operation tracking methods
  recordOperation(operation: OperationMetrics): void {
    const { name } = operation;

    if (!this.operationHistory.has(name)) {
      this.operationHistory.set(name, []);
    }

    const history = this.operationHistory.get(name)!;
    history.push(operation);

    // Maintain history size limit
    if (history.length > this.maxOperationHistorySize) {
      history.shift();
    }

    // Check for threshold violations
    this.checkOperationThreshold(operation);
  }

  getOperationMetrics(operationName: string): OperationStats {
    const history = this.operationHistory.get(operationName) ?? [];

    if (history.length === 0) {
      return {
        count: 0,
        averageTime: 0,
        minTime: 0,
        maxTime: 0,
        successRate: 0,
        p50: 0,
        p95: 0,
        p99: 0,
      };
    }

    const times = history.map((op) => op.processingTime).sort((a, b) => a - b);
    const successCount = history.filter((op) => op.success).length;

    return {
      count: history.length,
      averageTime: times.reduce((a, b) => a + b, 0) / times.length,
      minTime: Math.min(...times),
      maxTime: Math.max(...times),
      successRate: successCount / history.length,
      p50: this.calculatePercentile(times, 0.5),
      p95: this.calculatePercentile(times, 0.95),
      p99: this.calculatePercentile(times, 0.99),
    };
  }

  setOperationThreshold(operationName: string, maxMs: number): void {
    this.operationThresholds.set(operationName, maxMs);
  }

  onOperationThresholdViolation(callback: (violation: ThresholdViolation) => void): () => void {
    this.operationViolationCallbacks.push(callback);
    return () => {
      const index = this.operationViolationCallbacks.indexOf(callback);
      if (index > -1) {
        this.operationViolationCallbacks.splice(index, 1);
      }
    };
  }

  onFPSThresholdViolation(callback: (violation: ThresholdViolation) => void, threshold: number): () => void {
    const entry = { callback, threshold };
    this.fpsViolationCallbacks.push(entry);
    return () => {
      const index = this.fpsViolationCallbacks.indexOf(entry);
      if (index > -1) {
        this.fpsViolationCallbacks.splice(index, 1);
      }
    };
  }

  enableErrorMonitorIntegration(enabled: boolean): void {
    this.errorMonitorEnabled = enabled;
  }

  setFPSCriticalThreshold(threshold: number): void {
    this.fpsCriticalThreshold = threshold;
  }

  checkMemoryPressure(): void {
    const { percentage } = this.cachedMemoryUsage;

    if (percentage >= 85 && this.errorMonitorEnabled) {
      this.reportToErrorMonitor('High memory usage detected', 'high', {
        memoryUsage: this.cachedMemoryUsage,
      });
    }
  }

  // Helper methods
  private calculatePercentile(sortedArray: number[], percentile: number): number {
    const index = (sortedArray.length - 1) * percentile;
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index % 1;

    if (lower === upper) {
      return sortedArray[lower];
    }

    return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
  }

  private checkOperationThreshold(operation: OperationMetrics): void {
    const threshold = this.operationThresholds.get(operation.name);
    if (!threshold || operation.processingTime <= threshold) {
      return;
    }

    // Check cooldown
    const lastViolation = this.lastViolationTime.get(operation.name) ?? 0;
    if (operation.timestamp - lastViolation < this.violationCooldownMs) {
      return;
    }

    this.lastViolationTime.set(operation.name, operation.timestamp);

    const violation: ThresholdViolation = {
      type: 'operation',
      operation: operation.name,
      processingTime: operation.processingTime,
      threshold,
      timestamp: operation.timestamp,
    };

    // Notify callbacks
    this.operationViolationCallbacks.forEach((cb) => cb(violation));

    // Report to error monitor if enabled
    if (this.errorMonitorEnabled) {
      const stats = this.getOperationMetrics(operation.name);
      const recentViolations = this.operationHistory
        .get(operation.name)!
        .slice(-10)
        .filter((op) => op.processingTime > threshold).length;

      if (recentViolations >= 3) {
        // Report if 3+ violations in last 10 operations
        this.reportToErrorMonitor('Operation performance degraded', 'medium', {
          operation: operation.name,
          averageTime: stats.averageTime,
          threshold,
          violationCount: recentViolations,
          successRate: stats.successRate,
          p95: stats.p95,
          recentViolations,
        });
      }
    }
  }

  checkFPSThresholds(): void {
    const currentFPS = this.getCurrentFps();

    // Check custom FPS thresholds
    this.fpsViolationCallbacks.forEach(({ callback, threshold }) => {
      if (currentFPS < threshold && this.fpsHistory.length >= 10) {
        const violation: ThresholdViolation = {
          type: 'fps',
          currentFPS,
          threshold,
          timestamp: performance.now(),
        };
        callback(violation);
      }
    });

    // Check critical threshold for error monitoring
    if (this.errorMonitorEnabled && currentFPS < this.fpsCriticalThreshold && this.fpsHistory.length >= 10) {
      this.reportToErrorMonitor('Critical FPS drop detected', 'high', {
        currentFPS,
        threshold: this.fpsCriticalThreshold,
      });
    }
  }

  private reportToErrorMonitor(
    message: string,
    severity: 'low' | 'medium' | 'high',
    context: Record<string, unknown>,
  ): void {
    const now = performance.now();
    if (now - this.lastErrorReportTime < this.errorReportCooldownMs) {
      return; // Rate limiting
    }

    this.lastErrorReportTime = now;
    this.errorMonitor.reportError(message, 'custom', severity, context);
  }
}

export const performanceMonitor = new PerformanceMonitor();
