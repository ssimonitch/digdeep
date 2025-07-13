import { useCallback, useEffect, useRef, useState } from 'react';

import { useCamera } from '@/features/recording/hooks/useCamera';
import { errorMonitor } from '@/shared/services/error-monitor.service';

import type { RepPhase, SquatPoseAnalysis, SquatPoseAnalyzerConfig } from '../services/squat-pose-analyzer.service';
import { getSquatPoseAnalyzer } from '../services/squat-pose-analyzer.service';

/**
 * Configuration options for useSquatAnalysis hook
 */
export interface UseSquatAnalysisOptions {
  /** Whether to auto-start analysis when camera is ready */
  autoStart?: boolean;
  /** Configuration for the squat pose analyzer */
  config?: SquatPoseAnalyzerConfig;
  /** Callback fired on each analysis frame */
  onAnalysis?: (analysis: SquatPoseAnalysis) => void;
  /** Target frame rate for analysis (default: 30 FPS) */
  targetFPS?: number;
}

/**
 * Simplified metrics interface for UI components
 */
export interface SquatAnalysisMetrics {
  // Depth metrics
  depthPercentage: number;
  depthAchieved: boolean;

  // Balance metrics
  lateralShift: number;
  isBalanced: boolean;

  // Bar path metrics
  barPathDeviation: number;

  // Rep counting
  currentRep: number;
  repPhase: RepPhase;

  // Overall quality
  confidence: number;
  isValidPose: boolean;
}

/**
 * Hook return interface
 */
export interface UseSquatAnalysisReturn {
  // Analysis data
  analysis: SquatPoseAnalysis | null;
  metrics: SquatAnalysisMetrics;
  isAnalyzing: boolean;
  isInitialized: boolean;

  // Controls
  startAnalysis: () => Promise<void>;
  stopAnalysis: () => void;
  resetSession: () => void;

  // Performance metrics
  fps: number;
  processingTime: number;

  // Camera integration
  camera: ReturnType<typeof useCamera>['camera'];

  // Error state
  error: string | undefined;
}

/**
 * Default empty metrics
 */
const EMPTY_METRICS: SquatAnalysisMetrics = {
  depthPercentage: 0,
  depthAchieved: false,
  lateralShift: 0,
  isBalanced: true,
  barPathDeviation: 0,
  currentRep: 0,
  repPhase: 'standing',
  confidence: 0,
  isValidPose: false,
};

/**
 * React hook for real-time squat analysis combining camera management and pose detection
 *
 * This hook provides a complete integration layer between the camera system and
 * squat pose analysis, offering:
 * - Real-time analysis of camera feed
 * - Simplified metrics interface for UI components
 * - Performance monitoring and FPS targeting
 * - Error handling and recovery
 * - Session management (start/stop/reset)
 *
 * @param options Configuration options for analysis behavior
 * @returns Analysis state, metrics, and control functions
 *
 * @example
 * ```typescript
 * const {
 *   metrics,
 *   isAnalyzing,
 *   startAnalysis,
 *   stopAnalysis,
 *   fps
 * } = useSquatAnalysis({
 *   autoStart: true,
 *   targetFPS: 30,
 *   onAnalysis: (analysis) => console.log('Rep:', analysis.squatMetrics.repCounting.repCount)
 * });
 *
 * // metrics.depthPercentage, metrics.isBalanced, etc.
 * ```
 */
export function useSquatAnalysis(options: UseSquatAnalysisOptions = {}): UseSquatAnalysisReturn {
  const { autoStart = false, config = {}, onAnalysis, targetFPS = 30 } = options;

  // Camera integration
  const camera = useCamera({
    autoStart: false, // We'll manage camera start manually
    defaultConfig: {
      frameRate: targetFPS,
      facingMode: 'environment', // Rear camera for squat recording
    },
  });

  // Analysis state
  const [analysis, setAnalysis] = useState<SquatPoseAnalysis | null>(null);
  const [metrics, setMetrics] = useState<SquatAnalysisMetrics>(EMPTY_METRICS);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | undefined>();

  // Performance tracking
  const [fps, setFps] = useState(0);
  const [processingTime, setProcessingTime] = useState(0);

  // Refs for analysis loop
  const analyzerRef = useRef(getSquatPoseAnalyzer());
  const animationFrameRef = useRef<number>(null);
  const videoElementRef = useRef<HTMLVideoElement>(null);
  const lastFrameTimeRef = useRef(0);
  const frameCountRef = useRef(0);
  const fpsUpdateIntervalRef = useRef<NodeJS.Timeout>(null);

  /**
   * Extract simplified metrics from full analysis for UI consumption
   */
  const extractMetrics = useCallback((analysisData: SquatPoseAnalysis): SquatAnalysisMetrics => {
    const { squatMetrics, confidence, isValid } = analysisData;

    return {
      depthPercentage: squatMetrics.depth.depthPercentage ?? 0,
      depthAchieved: squatMetrics.depth.hasAchievedDepth,
      lateralShift: squatMetrics.balance.lateralDeviation ?? 0,
      isBalanced: squatMetrics.balance.isBalanced,
      barPathDeviation: squatMetrics.barPath.verticalDeviation ?? 0,
      currentRep: squatMetrics.repCounting.repCount,
      repPhase: squatMetrics.repCounting.phase,
      confidence,
      isValidPose: isValid,
    };
  }, []);

  /**
   * Main analysis loop - processes video frames at target FPS
   */
  const analyzeFrame = useCallback(() => {
    if (!isAnalyzing || !videoElementRef.current || !camera.camera.stream) {
      return;
    }

    const now = performance.now();
    const frameInterval = 1000 / targetFPS; // Target interval between frames

    // Throttle to target FPS
    if (now - lastFrameTimeRef.current < frameInterval) {
      animationFrameRef.current = requestAnimationFrame(analyzeFrame);
      return;
    }

    try {
      // Perform squat analysis
      const analysisResult = analyzerRef.current.analyzeSquatPose(videoElementRef.current);

      // Update processing time
      setProcessingTime(analysisResult.processingTime);

      // Update analysis state
      setAnalysis(analysisResult);

      // Extract simplified metrics
      const newMetrics = extractMetrics(analysisResult);
      setMetrics(newMetrics);

      // Call analysis callback
      onAnalysis?.(analysisResult);

      // Update frame tracking
      frameCountRef.current++;
      lastFrameTimeRef.current = now;

      // Clear any previous errors
      setError(undefined);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Analysis failed';

      errorMonitor.reportError(`Squat analysis frame processing failed: ${errorMessage}`, 'custom', 'high', {
        error: errorMessage,
        timestamp: now,
        frameCount: frameCountRef.current,
      });

      setError(errorMessage);
    }

    // Schedule next frame
    animationFrameRef.current = requestAnimationFrame(analyzeFrame);
  }, [isAnalyzing, camera.camera.stream, targetFPS, extractMetrics, onAnalysis]);

  /**
   * Initialize video element for analysis
   */
  const initializeVideoElement = useCallback((): Promise<HTMLVideoElement> | null => {
    if (!camera.camera.stream) return null;

    // Create or reuse video element
    if (!videoElementRef.current) {
      videoElementRef.current = document.createElement('video');
      videoElementRef.current.playsInline = true;
      videoElementRef.current.muted = true;
    }

    const video = videoElementRef.current;
    video.srcObject = camera.camera.stream;

    return new Promise<HTMLVideoElement>((resolve, reject) => {
      video.onloadedmetadata = () => {
        video
          .play()
          .then(() => resolve(video))
          .catch(reject);
      };
      video.onerror = () => reject(new Error('Video load failed'));
    });
  }, [camera.camera.stream]);

  /**
   * Start squat analysis
   */
  const startAnalysis = useCallback(async (): Promise<void> => {
    if (isAnalyzing) return;

    try {
      setError(undefined);

      // Initialize camera if not already active
      if (!camera.camera.isActive) {
        if (!camera.camera.permission.granted) {
          await camera.initialize();
        }
        await camera.start();
      }

      // Initialize analyzer if not already done
      if (!isInitialized) {
        await analyzerRef.current.initialize();
        setIsInitialized(true);
      }

      // Set up video element
      const videoPromise = initializeVideoElement();
      if (videoPromise) {
        await videoPromise;
      }

      // Start analysis loop
      setIsAnalyzing(true);
      frameCountRef.current = 0;
      lastFrameTimeRef.current = performance.now();

      // Start FPS monitoring
      fpsUpdateIntervalRef.current = setInterval(() => {
        const currentFps = frameCountRef.current;
        setFps(currentFps);
        frameCountRef.current = 0; // Reset for next second
      }, 1000);

      // Start analysis loop
      analyzeFrame();

      errorMonitor.reportError('Squat analysis started successfully', 'custom', 'low', {
        targetFPS,
        cameraConfig: camera.camera.config,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start analysis';
      setError(errorMessage);

      errorMonitor.reportError(`Failed to start squat analysis: ${errorMessage}`, 'custom', 'high', {
        error: errorMessage,
      });

      throw err;
    }
  }, [isAnalyzing, camera, isInitialized, initializeVideoElement, analyzeFrame, targetFPS]);

  /**
   * Stop squat analysis
   */
  const stopAnalysis = useCallback((): void => {
    setIsAnalyzing(false);

    // Cancel animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Stop FPS monitoring
    if (fpsUpdateIntervalRef.current) {
      clearInterval(fpsUpdateIntervalRef.current);
      fpsUpdateIntervalRef.current = null;
    }

    // Stop camera
    camera.stop();

    // Reset FPS
    setFps(0);

    errorMonitor.reportError('Squat analysis stopped', 'custom', 'low', {
      finalFrameCount: frameCountRef.current,
      finalFPS: fps,
    });
  }, [camera, fps]);

  /**
   * Reset analysis session (clear rep counting, metrics history)
   */
  const resetSession = useCallback((): void => {
    // Reset analyzer state
    analyzerRef.current.resetRepCounting();
    analyzerRef.current.resetShiftHistory();

    // Reset local state
    setAnalysis(null);
    setMetrics(EMPTY_METRICS);
    setError(undefined);

    errorMonitor.reportError('Squat analysis session reset', 'custom', 'low');
  }, []);

  // Update analyzer when config changes (recreate with new config)
  useEffect(() => {
    analyzerRef.current = getSquatPoseAnalyzer(config);
    // Reset initialization state when config changes
    setIsInitialized(false);
  }, [config]);

  // Auto-start if requested
  useEffect(() => {
    if (autoStart) {
      startAnalysis().catch((error) => {
        errorMonitor.reportError(
          `Auto-start failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'custom',
          'medium',
          { autoStart: true, error: error instanceof Error ? error.message : String(error) },
        );
      });
    }
  }, [autoStart, startAnalysis]);

  // Cleanup on unmount
  useEffect(() => {
    const analyzer = analyzerRef.current;
    return () => {
      stopAnalysis();
      if (videoElementRef.current) {
        videoElementRef.current.srcObject = null;
      }
      analyzer.cleanup();
    };
  }, [stopAnalysis]);

  // Monitor camera errors
  useEffect(() => {
    if (camera.camera.error) {
      setError(`Camera error: ${camera.camera.error}`);
      if (isAnalyzing) {
        stopAnalysis();
      }
    }
  }, [camera, isAnalyzing, stopAnalysis]);

  return {
    analysis,
    metrics,
    isAnalyzing,
    isInitialized,
    startAnalysis,
    stopAnalysis,
    resetSession,
    fps,
    processingTime,
    camera: camera.camera,
    error,
  };
}
