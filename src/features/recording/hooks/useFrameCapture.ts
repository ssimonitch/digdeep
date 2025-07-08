/**
 * Frame Capture Hook
 *
 * React hook for managing video frame capture lifecycle with memory management,
 * frame buffering, and performance monitoring for the DigDeep powerlifting
 * form analysis application.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  type CapturedFrame,
  type FrameBufferStats,
  type FrameCaptureConfig,
  FrameCaptureService,
  type MemoryStats,
} from '../services/FrameCaptureService';

/**
 * Frame capture hook state
 */
interface FrameCaptureState {
  /** Whether frame capture is active */
  isCapturing: boolean;
  /** Current frame buffer */
  frames: CapturedFrame[];
  /** Latest captured frame */
  latestFrame: CapturedFrame | null;
  /** Frame capture statistics */
  stats: FrameBufferStats;
  /** Memory usage statistics */
  memoryStats: MemoryStats;
  /** Any capture errors */
  error: string | null;
  /** Whether the service is initializing */
  isInitializing: boolean;
}

/**
 * Frame capture hook options
 */
interface UseFrameCaptureOptions {
  /** Frame capture configuration */
  config?: Partial<FrameCaptureConfig>;
  /** Whether to auto-start capture when video is ready */
  autoStart?: boolean;
  /** Callback for frame capture events */
  onFrameCapture?: (frame: CapturedFrame) => void;
  /** Callback for frame drops */
  onFrameDropped?: (reason: string) => void;
  /** Callback for memory threshold exceeded */
  onMemoryThresholdExceeded?: (stats: MemoryStats) => void;
  /** Callback for errors */
  onError?: (error: Error) => void;
  /** Whether to enable performance monitoring */
  enablePerformanceMonitoring?: boolean;
  /** Performance monitoring interval in ms */
  performanceMonitoringInterval?: number;
}

/**
 * Frame capture hook return value
 */
interface UseFrameCaptureReturn {
  /** Current frame capture state */
  state: FrameCaptureState;
  /** Start frame capture */
  startCapture: (videoElement: HTMLVideoElement) => void;
  /** Stop frame capture */
  stopCapture: () => void;
  /** Clear frame buffer */
  clearBuffer: () => void;
  /** Force garbage collection */
  forceGarbageCollection: () => void;
  /** Get frame by sequence number */
  getFrameBySequence: (sequenceNumber: number) => CapturedFrame | null;
  /** Update capture configuration */
  updateConfig: (config: Partial<FrameCaptureConfig>) => void;
  /** Adjust frame quality */
  adjustQuality: (quality: number) => void;
  /** Convert frame for MediaPipe */
  convertFrameForMediaPipe: (frame: CapturedFrame) => ImageData | null;
  /** Check if memory usage is high */
  isMemoryUsageHigh: () => boolean;
  /** Get current FPS */
  getCurrentFPS: () => number;
  /** Get buffer utilization percentage */
  getBufferUtilization: () => number;
}

/**
 * Default frame capture configuration
 */
const defaultConfig: FrameCaptureConfig = {
  targetFPS: 30,
  maxBufferSize: 10,
  quality: 0.8,
  format: 'imageData',
  autoGC: true,
  memoryThreshold: 100, // 100MB
};

/**
 * Frame capture hook implementation
 */
export function useFrameCapture(options: UseFrameCaptureOptions = {}): UseFrameCaptureReturn {
  const {
    config = {},
    onFrameCapture,
    onFrameDropped,
    onMemoryThresholdExceeded,
    onError,
    enablePerformanceMonitoring = true,
    performanceMonitoringInterval = 1000,
  } = options;

  // Service reference
  const serviceRef = useRef<FrameCaptureService | null>(null);
  const performanceIntervalRef = useRef<number | null>(null);

  // State
  const [state, setState] = useState<FrameCaptureState>({
    isCapturing: false,
    frames: [],
    latestFrame: null,
    stats: {
      currentSize: 0,
      maxSize: 0,
      totalFrames: 0,
      droppedFrames: 0,
      memoryUsage: 0,
      utilization: 0,
      averageFrameSize: 0,
      currentFPS: 0,
    },
    memoryStats: {
      currentUsage: 0,
      peakUsage: 0,
      threshold: 0,
      gcCycles: 0,
      lastGC: 0,
      framesCleanedUp: 0,
    },
    error: null,
    isInitializing: false,
  });

  // Initialize service
  useEffect(() => {
    setState((prev) => ({ ...prev, isInitializing: true }));

    try {
      const mergedConfig = { ...defaultConfig, ...config };
      serviceRef.current = new FrameCaptureService(mergedConfig);

      // Setup event listeners
      serviceRef.current.on('frameCapture', (frame) => {
        setState((prev) => ({
          ...prev,
          frames: [...prev.frames],
          latestFrame: frame,
          stats: serviceRef.current?.getStats() ?? prev.stats,
          memoryStats: serviceRef.current?.getMemoryStats() ?? prev.memoryStats,
        }));
        onFrameCapture?.(frame);
      });

      serviceRef.current.on('frameDropped', (reason) => {
        setState((prev) => ({
          ...prev,
          stats: serviceRef.current?.getStats() ?? prev.stats,
        }));
        onFrameDropped?.(reason);
      });

      serviceRef.current.on('memoryThresholdExceeded', (stats) => {
        setState((prev) => ({
          ...prev,
          memoryStats: stats,
        }));
        onMemoryThresholdExceeded?.(stats);
      });

      serviceRef.current.on('garbageCollected', (stats) => {
        setState((prev) => ({
          ...prev,
          memoryStats: stats,
          stats: serviceRef.current?.getStats() ?? prev.stats,
        }));
      });

      serviceRef.current.on('captureError', (error) => {
        setState((prev) => ({
          ...prev,
          error: error.message,
        }));
        onError?.(error);
      });

      setState((prev) => ({ ...prev, isInitializing: false }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to initialize frame capture',
        isInitializing: false,
      }));
      onError?.(error as Error);
    }
  }, [config, onFrameCapture, onFrameDropped, onMemoryThresholdExceeded, onError]);

  // Setup performance monitoring
  useEffect(() => {
    if (enablePerformanceMonitoring && serviceRef.current) {
      performanceIntervalRef.current = window.setInterval(() => {
        if (serviceRef.current) {
          setState((prev) => ({
            ...prev,
            stats: serviceRef.current!.getStats(),
            memoryStats: serviceRef.current!.getMemoryStats(),
            frames: serviceRef.current!.getFrameBuffer(),
          }));
        }
      }, performanceMonitoringInterval);
    }

    return () => {
      if (performanceIntervalRef.current) {
        clearInterval(performanceIntervalRef.current);
        performanceIntervalRef.current = null;
      }
    };
  }, [enablePerformanceMonitoring, performanceMonitoringInterval]);

  // Start capture
  const startCapture = useCallback(
    (videoElement: HTMLVideoElement) => {
      if (!serviceRef.current) {
        setState((prev) => ({ ...prev, error: 'Frame capture service not initialized' }));
        return;
      }

      try {
        serviceRef.current.startCapture(videoElement);
        setState((prev) => ({
          ...prev,
          isCapturing: true,
          error: null,
        }));
      } catch (error) {
        setState((prev) => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Failed to start frame capture',
        }));
        onError?.(error as Error);
      }
    },
    [onError],
  );

  // Stop capture
  const stopCapture = useCallback(() => {
    if (serviceRef.current) {
      serviceRef.current.stopCapture();
      setState((prev) => ({
        ...prev,
        isCapturing: false,
      }));
    }
  }, []);

  // Clear buffer
  const clearBuffer = useCallback(() => {
    if (serviceRef.current) {
      serviceRef.current.clearBuffer();
      setState((prev) => ({
        ...prev,
        frames: [],
        latestFrame: null,
        stats: serviceRef.current?.getStats() ?? prev.stats,
        memoryStats: serviceRef.current?.getMemoryStats() ?? prev.memoryStats,
      }));
    }
  }, []);

  // Force garbage collection
  const forceGarbageCollection = useCallback(() => {
    if (serviceRef.current) {
      serviceRef.current.performGarbageCollection();
      setState((prev) => ({
        ...prev,
        frames: serviceRef.current?.getFrameBuffer() ?? [],
        stats: serviceRef.current?.getStats() ?? prev.stats,
        memoryStats: serviceRef.current?.getMemoryStats() ?? prev.memoryStats,
      }));
    }
  }, []);

  // Get frame by sequence number
  const getFrameBySequence = useCallback((sequenceNumber: number): CapturedFrame | null => {
    return serviceRef.current?.getFrameBySequence(sequenceNumber) ?? null;
  }, []);

  // Update configuration
  const updateConfig = useCallback((newConfig: Partial<FrameCaptureConfig>) => {
    if (serviceRef.current) {
      serviceRef.current.updateConfig(newConfig);
      setState((prev) => ({
        ...prev,
        stats: serviceRef.current?.getStats() ?? prev.stats,
        memoryStats: serviceRef.current?.getMemoryStats() ?? prev.memoryStats,
      }));
    }
  }, []);

  // Adjust quality
  const adjustQuality = useCallback((quality: number) => {
    if (serviceRef.current) {
      serviceRef.current.adjustFrameQuality(quality);
    }
  }, []);

  // Convert frame for MediaPipe
  const convertFrameForMediaPipe = useCallback((frame: CapturedFrame): ImageData | null => {
    return serviceRef.current?.convertToMediaPipeFormat(frame) ?? null;
  }, []);

  // Check if memory usage is high
  const isMemoryUsageHigh = useCallback((): boolean => {
    const threshold = state.memoryStats.threshold * 0.8; // 80% of threshold
    return state.memoryStats.currentUsage > threshold;
  }, [state.memoryStats]);

  // Get current FPS
  const getCurrentFPS = useCallback((): number => {
    return state.stats.currentFPS;
  }, [state.stats.currentFPS]);

  // Get buffer utilization
  const getBufferUtilization = useCallback((): number => {
    return state.stats.utilization;
  }, [state.stats.utilization]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (performanceIntervalRef.current) {
        clearInterval(performanceIntervalRef.current);
      }
      if (serviceRef.current) {
        serviceRef.current.dispose();
      }
    };
  }, []);

  return {
    state,
    startCapture,
    stopCapture,
    clearBuffer,
    forceGarbageCollection,
    getFrameBySequence,
    updateConfig,
    adjustQuality,
    convertFrameForMediaPipe,
    isMemoryUsageHigh,
    getCurrentFPS,
    getBufferUtilization,
  };
}

/**
 * Frame capture hook with auto-start functionality
 */
export function useAutoFrameCapture(
  videoElement: HTMLVideoElement | null,
  options: UseFrameCaptureOptions = {},
): UseFrameCaptureReturn {
  const frameCapture = useFrameCapture({ ...options, autoStart: true });

  // Auto-start capture when video element is ready
  useEffect(() => {
    if (videoElement && videoElement.readyState >= 2 && !frameCapture.state.isCapturing) {
      frameCapture.startCapture(videoElement);
    }
  }, [videoElement, frameCapture]);

  // Auto-stop capture when video element is removed
  useEffect(() => {
    if (!videoElement && frameCapture.state.isCapturing) {
      frameCapture.stopCapture();
    }
  }, [videoElement, frameCapture]);

  return frameCapture;
}

/**
 * Frame capture hook with memory optimization
 */
export function useOptimizedFrameCapture(options: UseFrameCaptureOptions = {}): UseFrameCaptureReturn {
  const frameCapture = useFrameCapture({
    ...options,
    config: {
      targetFPS: 15, // Lower FPS for better memory management
      maxBufferSize: 5, // Smaller buffer
      autoGC: true,
      memoryThreshold: 50, // Lower threshold
      ...options.config,
    },
    enablePerformanceMonitoring: true,
    performanceMonitoringInterval: 500, // More frequent monitoring
  });

  // Auto-adjust quality based on memory usage
  useEffect(() => {
    if (frameCapture.isMemoryUsageHigh()) {
      const currentQuality = frameCapture.state.stats.averageFrameSize > 100000 ? 0.5 : 0.8;
      frameCapture.adjustQuality(currentQuality);
    }
  }, [frameCapture.state.memoryStats.currentUsage, frameCapture]);

  // Auto-trigger garbage collection when buffer is 80% full
  useEffect(() => {
    if (frameCapture.getBufferUtilization() > 80) {
      frameCapture.forceGarbageCollection();
    }
  }, [frameCapture.state.stats.utilization, frameCapture]);

  return frameCapture;
}

/**
 * Frame capture hook for pose detection
 */
export function usePoseDetectionFrameCapture(options: UseFrameCaptureOptions = {}): UseFrameCaptureReturn & {
  /** Get frames ready for pose detection */
  getFramesForPoseDetection: () => ImageData[];
  /** Get latest frame for pose detection */
  getLatestFrameForPoseDetection: () => ImageData | null;
} {
  const frameCapture = useFrameCapture({
    ...options,
    config: {
      format: 'imageData', // MediaPipe needs ImageData
      targetFPS: 30,
      maxBufferSize: 3, // Keep only last 3 frames for pose detection
      ...options.config,
    },
  });

  // Get frames ready for pose detection
  const getFramesForPoseDetection = useCallback((): ImageData[] => {
    return frameCapture.state.frames
      .filter((frame) => frame.data instanceof ImageData)
      .map((frame) => frame.data as ImageData);
  }, [frameCapture.state.frames]);

  // Get latest frame for pose detection
  const getLatestFrameForPoseDetection = useCallback((): ImageData | null => {
    const latestFrame = frameCapture.state.latestFrame;
    if (latestFrame && latestFrame.data instanceof ImageData) {
      return latestFrame.data;
    }
    return null;
  }, [frameCapture.state.latestFrame]);

  return {
    ...frameCapture,
    getFramesForPoseDetection,
    getLatestFrameForPoseDetection,
  };
}
