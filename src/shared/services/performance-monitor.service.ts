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

  private measureFrame = (): void => {
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

  private getMemoryUsage(): MemoryUsage {
    return this.cachedMemoryUsage;
  }

  private notifyObservers(metrics: PerformanceMetrics): void {
    this.observers.forEach((observer) => observer(metrics));
  }
}

export const performanceMonitor = new PerformanceMonitor();
