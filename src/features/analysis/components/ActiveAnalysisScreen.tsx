import { useCallback, useEffect, useRef, useState } from 'react';

import { useSquatAnalysis } from '@/features/pose-detection/hooks/useSquatAnalysis';
import { ModeToggle } from '@/shared/components/layout/ModeToggle';
import { Button } from '@/shared/components/ui/button';

import { AnalysisStatus, ControlsSection, StatsGrid, VideoFeedSection } from './';

export interface ActiveAnalysisScreenProps {
  /** Callback when user wants to go back to home */
  onBack?: () => void;
}

export function ActiveAnalysisScreen({ onBack }: ActiveAnalysisScreenProps) {
  const [displayDimensions, setDisplayDimensions] = useState({ width: 0, height: 0 });
  const videoRef = useRef<HTMLVideoElement>(null);

  const {
    analysis,
    metrics,
    isAnalyzing,
    isInitialized,
    startAnalysis,
    stopAnalysis,
    resetSession,
    fps,
    processingTime,
    camera,
    error,
  } = useSquatAnalysis({
    autoStart: false,
    targetFPS: 30,
    onAnalysis: () => {
      // Analysis logging/tracking handled by errorMonitor service
    },
  });

  const handleStartSession = useCallback(async () => {
    try {
      await startAnalysis();
    } catch {
      // Error handling managed by useSquatAnalysis hook
    }
  }, [startAnalysis]);

  const handleStopSession = useCallback(() => {
    stopAnalysis();
  }, [stopAnalysis]);

  const handleResetSession = useCallback(() => {
    resetSession();
  }, [resetSession]);

  // Handle video element setup with proper event listener cleanup
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !camera.stream) return;

    video.srcObject = camera.stream;
    let resizeTimeoutId: ReturnType<typeof setTimeout> | null = null;

    const handleLoadedMetadata = () => {
      void video.play();
    };

    const handleVideoResize = () => {
      // Guard clause to prevent state updates if video is no longer available
      if (!videoRef.current) return;

      const rect = videoRef.current.getBoundingClientRect();
      setDisplayDimensions({
        width: rect.width,
        height: rect.height,
      });
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('resize', handleVideoResize);

    // Get initial display dimensions after metadata is loaded
    const handleInitialResize = () => {
      // Clear any existing timeout before setting a new one
      if (resizeTimeoutId) {
        clearTimeout(resizeTimeoutId);
      }
      resizeTimeoutId = setTimeout(handleVideoResize, 100); // Small delay to ensure video is rendered
    };

    video.addEventListener('loadedmetadata', handleInitialResize);

    return () => {
      // Clear the timeout if it's still pending
      if (resizeTimeoutId) {
        clearTimeout(resizeTimeoutId);
      }
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('resize', handleVideoResize);
      video.removeEventListener('loadedmetadata', handleInitialResize);
    };
  }, [camera.stream]);

  // Also update display dimensions when video container size changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const resizeObserver = new ResizeObserver(() => {
      const rect = video.getBoundingClientRect();
      setDisplayDimensions({
        width: rect.width,
        height: rect.height,
      });
    });

    resizeObserver.observe(video);

    return () => {
      resizeObserver.disconnect();
    };
  }, [camera.stream]);

  return (
    <div className="bg-background min-h-screen">
      {/* Header */}
      <header className="border-border/40 bg-background/80 border-b backdrop-blur-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <Button variant="ghost" onClick={onBack} disabled={isAnalyzing}>
            ← Back to Home
          </Button>
          <h1 className="text-2xl font-bold">Squat Analysis</h1>
          <div className="flex items-center gap-2">
            <ModeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-4xl px-4 py-6">
        {/* Camera Feed Section */}
        <VideoFeedSection
          videoRef={videoRef}
          cameraStream={camera.stream}
          isAnalyzing={isAnalyzing}
          landmarks={analysis?.landmarks?.landmarks?.[0] ?? null}
          displayDimensions={displayDimensions}
          confidence={metrics.confidence}
          detectionState={metrics.detectionState}
          isValidPose={metrics.isValidPose}
          visibilityFlags={metrics.visibilityFlags}
        />

        {/* Controls Section */}
        <ControlsSection
          isAnalyzing={isAnalyzing}
          isCameraPermissionPending={camera.permission.pending}
          onStartAnalysis={() => void handleStartSession()}
          onStopAnalysis={handleStopSession}
          onResetSession={handleResetSession}
        />

        {/* Error Display */}
        {error && (
          <div className="mb-6 rounded-lg border-2 border-red-200 bg-red-50 p-4 text-center">
            <div className="font-semibold text-red-700">Analysis Error</div>
            <div className="mt-1 text-sm text-red-600">{error}</div>
          </div>
        )}

        {/* Quick Stats */}
        <StatsGrid
          currentRep={metrics.currentRep}
          depthPercentage={metrics.depthPercentage}
          isValidPose={metrics.isValidPose}
          isBalanced={metrics.isBalanced}
          fps={fps}
        />

        {/* Analysis Status */}
        <AnalysisStatus
          camera={{
            isActive: camera.isActive,
            permissionGranted: camera.permission.granted,
            width: camera.config.width,
            height: camera.config.height,
          }}
          analysis={{
            isAnalyzing,
            isInitialized,
            processingTime,
            repPhase: metrics.repPhase,
          }}
        />
      </main>
    </div>
  );
}
