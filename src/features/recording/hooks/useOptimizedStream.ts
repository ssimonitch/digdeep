/**
 * Optimized Camera Stream Hook
 *
 * Provides a camera stream with automatic performance optimization
 * to maintain 30 FPS target for pose detection applications.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { errorMonitor } from '@/shared/services/error-monitor.service';

import {
  getRecommendedQualityLevel,
  type OptimizationResult,
  type StreamOptimizationSettings,
  type StreamPerformanceMetrics,
  VideoStreamOptimizer,
} from '../services/VideoStreamOptimizer';
import type { CameraConfig } from '../types';
import { useCamera } from './useCamera';

export interface OptimizedStreamConfig extends CameraConfig {
  /** Optimization settings */
  optimization?: Partial<StreamOptimizationSettings>;
  /** Whether to enable automatic optimization */
  enableAutoOptimization?: boolean;
  /** Initial quality level */
  initialQualityLevel?: 'ultra' | 'high' | 'medium' | 'low' | 'minimal';
}

export interface OptimizedStreamState {
  /** Camera stream state */
  stream: MediaStream | null;
  /** Whether camera is active */
  isActive: boolean;
  /** Whether camera is initializing */
  isInitializing: boolean;
  /** Current camera configuration */
  config: CameraConfig;
  /** Stream optimization error */
  error: string | null;
  /** Current performance metrics */
  performanceMetrics: StreamPerformanceMetrics | null;
  /** Current quality level */
  qualityLevel: string;
  /** Whether optimization is active */
  isOptimizing: boolean;
  /** Optimization history */
  optimizationHistory: OptimizationResult[];
}

export interface OptimizedStreamActions {
  /** Start the optimized camera stream */
  startStream: () => Promise<void>;
  /** Stop the camera stream */
  stopStream: () => void;
  /** Manually set quality level */
  setQualityLevel: (level: 'ultra' | 'high' | 'medium' | 'low' | 'minimal') => void;
  /** Enable/disable automatic optimization */
  setAutoOptimization: (enabled: boolean) => void;
  /** Reset optimization state */
  resetOptimization: () => void;
  /** Get current optimization settings */
  getOptimizationSettings: () => StreamOptimizationSettings;
  /** Update optimization settings */
  updateOptimizationSettings: (settings: Partial<StreamOptimizationSettings>) => void;
}

export interface UseOptimizedStreamResult {
  /** Stream state */
  state: OptimizedStreamState;
  /** Stream control actions */
  actions: OptimizedStreamActions;
}

export function useOptimizedStream(config: OptimizedStreamConfig): UseOptimizedStreamResult {
  const optimizerRef = useRef<VideoStreamOptimizer | null>(null);
  const [currentConfig, setCurrentConfig] = useState<CameraConfig>(config);
  const [performanceMetrics, setPerformanceMetrics] = useState<StreamPerformanceMetrics | null>(null);
  const [optimizationHistory, setOptimizationHistory] = useState<OptimizationResult[]>([]);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use the base camera hook with dynamically updated config
  const camera = useCamera({ defaultConfig: currentConfig });

  // Initialize optimizer
  useEffect(() => {
    if (!optimizerRef.current) {
      const optimizer = new VideoStreamOptimizer(config.optimization);

      // Set initial quality level
      const initialLevel = config.initialQualityLevel ?? getRecommendedQualityLevel();
      optimizer.setQualityLevel(initialLevel);

      optimizerRef.current = optimizer;
    }

    return () => {
      if (optimizerRef.current) {
        optimizerRef.current.stopMonitoring();
      }
    };
  }, [config.optimization, config.initialQualityLevel]);

  // Set up optimizer callbacks
  useEffect(() => {
    const optimizer = optimizerRef.current;
    if (!optimizer) return;

    // Subscribe to performance updates
    const unsubscribePerformance = optimizer.onPerformanceUpdate((metrics) => {
      setPerformanceMetrics(metrics);
    });

    // Subscribe to optimization events
    const unsubscribeOptimization = optimizer.onOptimization((result) => {
      setOptimizationHistory((prev) => [...prev, result]);

      // Update camera config with optimized settings
      const newConfig = optimizer.getOptimalCameraConfig(config);
      setCurrentConfig(newConfig);
      setIsOptimizing(false);
    });

    return () => {
      unsubscribePerformance();
      unsubscribeOptimization();
    };
  }, [config]);

  // Start monitoring when stream is active
  useEffect(() => {
    const optimizer = optimizerRef.current;
    if (!optimizer) return;

    if (camera.camera.isActive && camera.camera.stream) {
      optimizer.startMonitoring();
      setIsOptimizing(true);
    } else {
      optimizer.stopMonitoring();
      setIsOptimizing(false);
    }
  }, [camera.camera.isActive, camera.camera.stream]);

  // Handle camera errors
  useEffect(() => {
    if (camera.camera.error) {
      setError(`Camera error: ${camera.camera.error}`);
    } else {
      setError(null);
    }
  }, [camera.camera.error]);

  const startStream = useCallback(async () => {
    try {
      setError(null);
      const optimizer = optimizerRef.current;

      if (optimizer) {
        // Get optimal configuration before starting
        const optimalConfig = optimizer.getOptimalCameraConfig(config);
        setCurrentConfig(optimalConfig);
      }

      // Start camera with optimal configuration
      await camera.start();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start optimized stream';
      setError(errorMessage);
      errorMonitor.reportError(`Optimized stream start failed: ${errorMessage}`, 'custom', 'high', {
        config,
        error: errorMessage,
      });
      throw err;
    }
  }, [camera, config]);

  const stopStream = useCallback(() => {
    camera.stop();
    optimizerRef.current?.stopMonitoring();
    setIsOptimizing(false);
  }, [camera]);

  const setQualityLevel = useCallback(
    (level: 'ultra' | 'high' | 'medium' | 'low' | 'minimal') => {
      const optimizer = optimizerRef.current;
      if (!optimizer) return;

      const success = optimizer.setQualityLevel(level);
      if (success) {
        const newConfig = optimizer.getOptimalCameraConfig(config);
        setCurrentConfig(newConfig);
      }
    },
    [config],
  );

  const setAutoOptimization = useCallback((enabled: boolean) => {
    const optimizer = optimizerRef.current;
    if (!optimizer) return;

    // const currentSettings = optimizer.getSettings();
    optimizer.updateSettings({ enableAutoOptimization: enabled });
  }, []);

  const resetOptimization = useCallback(() => {
    const optimizer = optimizerRef.current;
    if (!optimizer) return;

    optimizer.reset();
    setOptimizationHistory([]);
    setPerformanceMetrics(null);
  }, []);

  const getOptimizationSettings = useCallback((): StreamOptimizationSettings => {
    const optimizer = optimizerRef.current;
    if (!optimizer) {
      return {
        targetFPS: 30,
        minFPS: 24,
        maxMemoryUsage: 80,
        checkInterval: 1000,
        optimizationThreshold: 3,
        enableAutoOptimization: true,
      };
    }
    return optimizer.getSettings();
  }, []);

  const updateOptimizationSettings = useCallback((settings: Partial<StreamOptimizationSettings>) => {
    const optimizer = optimizerRef.current;
    if (!optimizer) return;

    optimizer.updateSettings(settings);
  }, []);

  const state: OptimizedStreamState = {
    stream: camera.camera.stream,
    isActive: camera.camera.isActive,
    isInitializing: camera.camera.isInitializing,
    config: currentConfig,
    error,
    performanceMetrics,
    qualityLevel: optimizerRef.current?.getCurrentQualityLevel().level ?? 'medium',
    isOptimizing,
    optimizationHistory,
  };

  const actions: OptimizedStreamActions = {
    startStream,
    stopStream,
    setQualityLevel,
    setAutoOptimization,
    resetOptimization,
    getOptimizationSettings,
    updateOptimizationSettings,
  };

  return {
    state,
    actions,
  };
}

/**
 * Hook for getting real-time performance feedback
 */
export function useStreamPerformance() {
  const [metrics] = useState<StreamPerformanceMetrics | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);

  useEffect(() => {
    // This hook can be used independently to monitor any stream performance
    // Implementation would depend on having access to a global optimizer instance
    // For now, it's a placeholder for future enhancement
  }, []);

  return {
    metrics,
    isMonitoring,
    startMonitoring: () => setIsMonitoring(true),
    stopMonitoring: () => setIsMonitoring(false),
  };
}

/**
 * Hook for optimization settings management
 */
export function useOptimizationSettings(initialSettings?: Partial<StreamOptimizationSettings>) {
  const [settings, setSettings] = useState<StreamOptimizationSettings>({
    targetFPS: 30,
    minFPS: 24,
    maxMemoryUsage: 80,
    checkInterval: 1000,
    optimizationThreshold: 3,
    enableAutoOptimization: true,
    ...initialSettings,
  });

  const updateSettings = useCallback((newSettings: Partial<StreamOptimizationSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings({
      targetFPS: 30,
      minFPS: 24,
      maxMemoryUsage: 80,
      checkInterval: 1000,
      optimizationThreshold: 3,
      enableAutoOptimization: true,
      ...initialSettings,
    });
  }, [initialSettings]);

  return {
    settings,
    updateSettings,
    resetSettings,
  };
}
