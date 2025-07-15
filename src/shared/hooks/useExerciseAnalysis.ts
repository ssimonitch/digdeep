import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  UseExerciseAnalysisOptions,
  UseExerciseAnalysisReturn,
} from '@/features/pose-detection/types/exercise-analyzer.types';
import { useCamera } from '@/features/recording/hooks/useCamera';
import { errorMonitor } from '@/shared/services/error-monitor.service';

import { useAnimationLoopWithMetrics } from './useAnimationLoop';
import { useVideoElement } from './useVideoElement';

/**
 * Generic hook for real-time exercise analysis combining camera management and pose detection
 *
 * This hook provides a complete integration layer between the camera system and
 * any exercise pose analyzer, offering:
 * - Real-time analysis of camera feed
 * - Exercise-agnostic infrastructure
 * - Performance monitoring and FPS targeting
 * - Error handling and recovery
 * - Session management (start/stop/reset)
 *
 * @param options Configuration options including analyzer factory and metrics
 * @returns Analysis state, metrics, and control functions
 *
 * @example
 * ```typescript
 * const { metrics, isAnalyzing, startAnalysis } = useExerciseAnalysis({
 *   analyzerFactory: (config) => new SquatAnalyzerAdapter(config),
 *   emptyMetrics: EMPTY_SQUAT_METRICS,
 *   targetFPS: 30,
 *   onAnalysis: (analysis) => console.log('Analysis:', analysis)
 * });
 * ```
 */
export function useExerciseAnalysis<TAnalysis, TMetrics, TConfig>(
  options: UseExerciseAnalysisOptions<TAnalysis, TMetrics, TConfig>,
): UseExerciseAnalysisReturn<TAnalysis, TMetrics> {
  const { analyzerFactory, emptyMetrics, autoStart = false, config, onAnalysis, targetFPS = 30 } = options;

  // Create analyzer instance using ref for stability
  const analyzerRef = useRef<ReturnType<typeof analyzerFactory>>(analyzerFactory(config));

  // Update analyzer config
  const isFirstMount = useRef(true);
  useEffect(() => {
    // Skip the first mount since analyzer already has the initial config
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }

    if (analyzerRef.current && config) {
      analyzerRef.current.updateConfig(config);
    }
  }, [config]);

  // Camera integration
  // IMPORTANT: We intentionally pass autoStart: false to useCamera regardless of the
  // autoStart option passed to this hook. This is because:
  // 1. The autoStart option here controls the entire analysis workflow (camera + analyzer)
  // 2. We need to ensure proper initialization order: camera → analyzer → video element
  // 3. Starting the camera before the analyzer is ready would drop frames
  // 4. Our own autoStart implementation (see useEffect below) handles the complete workflow
  const camera = useCamera({
    autoStart: false, // Always false - we manage camera lifecycle explicitly
    defaultConfig: {
      frameRate: targetFPS,
      facingMode: 'environment', // Rear camera for exercise recording
    },
  });

  // Batched analysis state - closely related data that updates together
  const [analysisData, setAnalysisData] = useState<{
    analysis: TAnalysis | null;
    metrics: TMetrics;
  }>({
    analysis: null,
    metrics: emptyMetrics,
  });

  // Performance state - updates at different frequency than analysis
  const [performanceData, setPerformanceData] = useState({
    fps: 0,
    processingTime: 0,
  });

  // Control states - independent lifecycle
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Error state - kept separate for error boundary compatibility
  const [error, setError] = useState<string | undefined>();

  // Video element management
  const { videoRef, initializeVideo } = useVideoElement();
  const streamRef = useRef<MediaStream>(null);

  /**
   * Perform analysis on current video frame
   * This function always has access to fresh values without dependency issues
   */
  const performAnalysis = useCallback(() => {
    if (!videoRef.current || !streamRef.current) return;

    const startTime = performance.now();

    try {
      // Perform exercise-specific analysis
      const analysisResult = analyzerRef.current.analyze(videoRef.current);

      // Extract simplified metrics for UI
      const extractedMetrics = analyzerRef.current.extractMetrics(analysisResult);

      // Calculate processing time
      const endTime = performance.now();
      const processingMs = endTime - startTime;

      // Batch update analysis data - single state update for related data
      setAnalysisData({
        analysis: analysisResult,
        metrics: extractedMetrics,
      });

      // Update performance data separately (different update frequency)
      setPerformanceData((prev) => ({
        ...prev,
        processingTime: processingMs,
      }));

      // Call analysis callback if provided
      onAnalysis?.(analysisResult);

      // Clear any previous errors
      setError(undefined);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Analysis failed';

      errorMonitor.reportError(`Exercise analysis frame processing failed: ${errorMessage}`, 'custom', 'high', {
        error: errorMessage,
        processingTime: performance.now() - startTime,
        analyzer: analyzerRef.current.constructor.name,
      });

      setError(errorMessage);
    }
  }, [onAnalysis, videoRef]);

  // Use the animation loop hook for clean frame management
  useAnimationLoopWithMetrics(performAnalysis, isAnalyzing, targetFPS, {
    onFPSUpdate: (newFps) => {
      setPerformanceData((prev) => ({
        ...prev,
        fps: newFps,
      }));
    },
    onFrameDrop: (droppedFrames) => {
      errorMonitor.reportError('Frame dropped during analysis', 'performance', droppedFrames > 2 ? 'high' : 'low', {
        targetFPS,
        analyzer: analyzerRef.current.constructor.name,
        droppedFrames,
      });
    },
  });

  /**
   * Start exercise analysis
   */
  const startAnalysis = useCallback(async (): Promise<void> => {
    if (isAnalyzing) return;

    try {
      setError(undefined);

      // Initialize camera if not already active
      let stream: MediaStream;
      if (!camera.camera.isActive) {
        await camera.initialize();
        stream = await camera.start(); // Get stream directly from start()
      } else if (camera.camera.stream) {
        stream = camera.camera.stream; // Use existing stream
      } else {
        throw new Error('Camera stream not available');
      }

      // Initialize analyzer if not already done
      if (!isInitialized) {
        await analyzerRef.current.initialize();
        setIsInitialized(true);
      }

      // Set up video element with current stream
      await initializeVideo(stream);
      streamRef.current = stream;

      // Start analysis loop
      setIsAnalyzing(true);

      errorMonitor.reportError('Exercise analysis started successfully', 'custom', 'low', {
        targetFPS,
        cameraConfig: camera.camera.config,
        analyzer: analyzerRef.current.constructor.name,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start analysis';
      setError(errorMessage);

      errorMonitor.reportError(`Failed to start exercise analysis: ${errorMessage}`, 'custom', 'high', {
        error: errorMessage,
        analyzer: analyzerRef.current.constructor.name,
      });

      throw err;
    }
  }, [isAnalyzing, isInitialized, camera, initializeVideo, targetFPS]);

  /**
   * Stop exercise analysis
   */
  const stopAnalysis = useCallback((): void => {
    setIsAnalyzing(false);

    // Stop camera
    camera.stop();
    streamRef.current = null;

    // Reset performance data
    setPerformanceData({
      fps: 0,
      processingTime: 0,
    });

    errorMonitor.reportError('Exercise analysis stopped', 'custom', 'low', {
      analyzer: analyzerRef.current.constructor.name,
      finalFPS: performanceData.fps,
    });
  }, [camera, performanceData.fps]);

  /**
   * Reset analysis session
   */
  const resetSession = useCallback((): void => {
    // Reset analyzer state
    analyzerRef.current.reset();

    // Reset local state
    setAnalysisData({
      analysis: null,
      metrics: emptyMetrics,
    });
    setPerformanceData((prev) => ({
      ...prev,
      processingTime: 0,
    }));
    setError(undefined);

    errorMonitor.reportError('Exercise analysis session reset', 'custom', 'low', {
      analyzer: analyzerRef.current.constructor.name,
    });
  }, [emptyMetrics]);

  // Config changes are now handled by analyzer.updateConfig()
  // No need to reset initialization state

  // Auto-start if requested
  // This implements the autoStart behavior for the complete analysis workflow,
  // ensuring proper initialization order (camera → analyzer → video element)
  useEffect(() => {
    if (autoStart) {
      startAnalysis().catch((error) => {
        errorMonitor.reportError(
          `Auto-start failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'custom',
          'medium',
          {
            autoStart: true,
            error: error instanceof Error ? error.message : String(error),
            analyzer: analyzerRef.current.constructor.name,
          },
        );
      });
    }
  }, [autoStart, startAnalysis]);

  // Handle component unmount cleanup
  useEffect(() => {
    const currentAnalyzer = analyzerRef.current;
    return () => {
      currentAnalyzer.cleanup();
    };
  }, []);

  // Monitor camera errors
  useEffect(() => {
    if (camera.camera.error) {
      setError(`Camera error: ${camera.camera.error}`);
      if (isAnalyzing) {
        stopAnalysis();
      }
    }
  }, [camera.camera.error, isAnalyzing, stopAnalysis]);

  return {
    // Destructure batched states for API compatibility
    analysis: analysisData.analysis,
    metrics: analysisData.metrics,
    isAnalyzing,
    isInitialized,
    startAnalysis,
    stopAnalysis,
    resetSession,
    fps: performanceData.fps,
    processingTime: performanceData.processingTime,
    camera: camera.camera,
    error,
  };
}
