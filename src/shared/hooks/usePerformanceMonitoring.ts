import { useCallback, useEffect, useState } from 'react';

import { errorMonitor, type ErrorSummary } from '@/shared/services/error-monitor.service';
import type { PerformanceGrade, PerformanceMetrics } from '@/shared/services/performance-monitor.service';
import { performanceMonitor } from '@/shared/services/performance-monitor.service';

export interface UsePerformanceMonitoringOptions {
  autoStart?: boolean;
  trackErrors?: boolean;
  updateInterval?: number;
}

export interface PerformanceMonitoringState {
  metrics: PerformanceMetrics | null;
  grade: PerformanceGrade;
  errorSummary: ErrorSummary | null;
  isMonitoring: boolean;
}

export function usePerformanceMonitoring(options: UsePerformanceMonitoringOptions = {}) {
  const { autoStart = false, trackErrors = true, updateInterval = 1000 } = options;

  const [state, setState] = useState<PerformanceMonitoringState>({
    metrics: null,
    grade: 'good',
    errorSummary: null,
    isMonitoring: false,
  });

  const startMonitoring = useCallback(() => {
    performanceMonitor.start();
    if (trackErrors) {
      errorMonitor.initialize();
    }
    setState((prev) => ({ ...prev, isMonitoring: true }));
  }, [trackErrors]);

  const stopMonitoring = useCallback(() => {
    performanceMonitor.stop();
    setState((prev) => ({ ...prev, isMonitoring: false }));
  }, []);

  const resetMetrics = useCallback(() => {
    performanceMonitor.reset();
    if (trackErrors) {
      errorMonitor.clearErrors();
    }
  }, [trackErrors]);

  useEffect(() => {
    if (autoStart) {
      startMonitoring();
    }

    return () => {
      performanceMonitor.stop();
      if (trackErrors) {
        errorMonitor.destroy();
      }
    };
  }, [autoStart, startMonitoring, trackErrors]);

  useEffect(() => {
    const updateMetrics = () => {
      const metrics = performanceMonitor.getCurrentMetrics();
      const grade = performanceMonitor.getPerformanceGrade();
      const errorSummary = trackErrors ? errorMonitor.getErrorSummary() : null;

      setState((prev) => ({
        ...prev,
        metrics,
        grade,
        errorSummary,
      }));
    };

    let intervalId: NodeJS.Timeout;

    if (state.isMonitoring) {
      intervalId = setInterval(updateMetrics, updateInterval);
      updateMetrics();
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [state.isMonitoring, updateInterval, trackErrors]);

  useEffect(() => {
    if (!trackErrors) return;

    const unsubscribeError = errorMonitor.subscribe(() => {
      const errorSummary = errorMonitor.getErrorSummary();
      setState((prev) => ({ ...prev, errorSummary }));
    });

    return unsubscribeError;
  }, [trackErrors]);

  return {
    ...state,
    startMonitoring,
    stopMonitoring,
    resetMetrics,
  };
}

export function usePerformanceMetrics() {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);

  useEffect(() => {
    const unsubscribe = performanceMonitor.subscribe(setMetrics);
    return unsubscribe;
  }, []);

  return metrics;
}
