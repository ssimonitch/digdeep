import { useEffect, useRef, useState } from 'react';

import { useSquatAnalysis } from '@/features/pose-detection/hooks/useSquatAnalysis';
import { ModeToggle } from '@/shared/components/layout/ModeToggle';
import { Button } from '@/shared/components/ui/button';

import { PoseLandmarkOverlay } from './PoseLandmarkOverlay';

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

  const handleStartSession = async () => {
    try {
      await startAnalysis();
    } catch {
      // Error handling managed by useSquatAnalysis hook
    }
  };

  const handleStopSession = () => {
    stopAnalysis();
  };

  const handleResetSession = () => {
    resetSession();
  };

  // Handle video element setup with proper event listener cleanup
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !camera.stream) return;

    video.srcObject = camera.stream;

    const handleLoadedMetadata = () => {
      void video.play();
    };

    const handleVideoResize = () => {
      const rect = video.getBoundingClientRect();
      setDisplayDimensions({
        width: rect.width,
        height: rect.height,
      });
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('resize', handleVideoResize);

    // Get initial display dimensions after metadata is loaded
    const handleInitialResize = () => {
      setTimeout(handleVideoResize, 100); // Small delay to ensure video is rendered
    };

    video.addEventListener('loadedmetadata', handleInitialResize);

    return () => {
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
        <div className="relative mb-6 aspect-video overflow-hidden rounded-lg bg-gray-900">
          {camera.stream && (
            <video
              ref={videoRef}
              data-testid="camera-feed"
              className="h-full w-full object-cover"
              playsInline
              muted
              autoPlay
            />
          )}

          {!camera.stream && (
            <div className="flex h-full items-center justify-center text-center">
              <div className="space-y-4">
                <div className="text-6xl">📹</div>
                <div>
                  <p className="text-xl font-semibold">Camera Ready</p>
                  <p className="text-muted-foreground">Start your session to begin analysis</p>
                </div>
              </div>
            </div>
          )}

          {/* Pose Landmark Overlay */}
          {isAnalyzing &&
            analysis?.landmarks?.landmarks &&
            analysis.landmarks.landmarks.length > 0 &&
            analysis.landmarks.landmarks[0] &&
            displayDimensions.width > 0 &&
            displayDimensions.height > 0 && (
              <>
                {/* Debug info for development */}
                {typeof window !== 'undefined' && window.location.hostname === 'localhost' && (
                  <div className="bg-opacity-50 absolute top-2 left-2 rounded bg-black p-2 text-xs text-white">
                    Debug: Display {Math.round(displayDimensions.width)}x{Math.round(displayDimensions.height)} |
                    Landmarks: {analysis.landmarks.landmarks[0]?.length || 0} | Valid:{' '}
                    {metrics.isValidPose ? 'Yes' : 'No'}
                  </div>
                )}
                <PoseLandmarkOverlay
                  landmarks={analysis.landmarks.landmarks[0]}
                  width={displayDimensions.width}
                  height={displayDimensions.height}
                  isValidPose={metrics.isValidPose}
                  confidence={metrics.confidence}
                />
              </>
            )}

          {/* Pose Validity UI */}
          {isAnalyzing && (
            <div className="pointer-events-none absolute inset-0">
              {/* Invalid Pose Message */}
              {!metrics.isValidPose && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="rounded-lg bg-black/75 p-6 text-center">
                    <p className="text-xl font-semibold text-white">Position yourself in frame</p>
                    <p className="mt-2 text-gray-300">
                      {/* Check for specific missing landmarks */}
                      {analysis?.squatMetrics?.keyLandmarkVisibility?.hips &&
                      analysis.squatMetrics.keyLandmarkVisibility.hips < 0.5
                        ? 'Hips not visible - step back from camera'
                        : analysis?.squatMetrics?.keyLandmarkVisibility?.knees &&
                            analysis.squatMetrics.keyLandmarkVisibility.knees < 0.5
                          ? 'Knees not visible - ensure full body is in frame'
                          : analysis?.squatMetrics?.keyLandmarkVisibility?.ankles &&
                              analysis.squatMetrics.keyLandmarkVisibility.ankles < 0.5
                            ? 'Ankles not visible - step back from camera'
                            : 'Make sure your full body is visible'}
                    </p>
                  </div>
                </div>
              )}

              {/* Pose Detected Indicator */}
              {metrics.isValidPose && (
                <div className="absolute top-4 right-4">
                  <div
                    data-testid="pose-validity-indicator"
                    className="valid rounded-lg bg-green-600 px-4 py-2 font-semibold text-white"
                  >
                    Pose Detected
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Controls Section */}
        <div className="mb-6 flex flex-wrap justify-center gap-4">
          {!isAnalyzing ? (
            <Button
              onClick={() => void handleStartSession()}
              size="lg"
              className="bg-primary hover:bg-primary/90 h-14 px-8 text-lg font-bold"
              disabled={camera.permission.pending}
            >
              {camera.permission.pending ? 'Requesting Camera...' : 'START ANALYSIS'}
            </Button>
          ) : (
            <>
              <Button
                onClick={handleStopSession}
                variant="destructive"
                size="lg"
                className="h-14 px-8 text-lg font-bold"
              >
                STOP ANALYSIS
              </Button>
              <Button onClick={handleResetSession} variant="outline" size="lg" className="h-14 px-8 text-lg font-bold">
                RESET SESSION
              </Button>
            </>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 rounded-lg border-2 border-red-200 bg-red-50 p-4 text-center">
            <div className="font-semibold text-red-700">Analysis Error</div>
            <div className="mt-1 text-sm text-red-600">{error}</div>
          </div>
        )}

        {/* Quick Stats */}
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="bg-card rounded-lg border p-4 text-center">
            <div className="text-2xl font-bold">{metrics.currentRep}</div>
            <div className="text-muted-foreground text-sm">Reps</div>
          </div>
          {metrics.isValidPose ? (
            <div className="bg-card rounded-lg border p-4 text-center" data-testid="depth-indicator">
              <div className="text-2xl font-bold">{`${Math.round(metrics.depthPercentage)}%`}</div>
              <div className="text-muted-foreground text-sm">Depth</div>
            </div>
          ) : (
            <div className="bg-card rounded-lg border p-4 text-center">
              <div className="text-2xl font-bold">--</div>
              <div className="text-muted-foreground text-sm">Depth</div>
            </div>
          )}
          <div className="bg-card rounded-lg border p-4 text-center">
            <div className="text-2xl font-bold">{fps}</div>
            <div className="text-muted-foreground text-sm">FPS</div>
          </div>
          {metrics.isValidPose ? (
            <div className="bg-card rounded-lg border p-4 text-center" data-testid="balance-meter">
              <div className={`text-2xl font-bold ${metrics.isBalanced ? 'text-green-600' : 'text-red-600'}`}>
                {metrics.isBalanced ? '✓' : '⚠️'}
              </div>
              <div className="text-muted-foreground text-sm">Balance</div>
            </div>
          ) : (
            <div className="bg-card rounded-lg border p-4 text-center">
              <div className="text-2xl font-bold text-gray-400">--</div>
              <div className="text-muted-foreground text-sm">Balance</div>
            </div>
          )}
        </div>

        {/* Analysis Status */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Session Status</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="bg-card rounded-lg border p-4">
              <h3 className="mb-2 font-semibold">Camera</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Status:</span>
                  <span className={camera.isActive ? 'text-green-600' : 'text-gray-600'}>
                    {camera.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Permission:</span>
                  <span className={camera.permission.granted ? 'text-green-600' : 'text-red-600'}>
                    {camera.permission.granted ? 'Granted' : 'Not Granted'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Resolution:</span>
                  <span>
                    {camera.config.width}x{camera.config.height}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-lg border p-4">
              <h3 className="mb-2 font-semibold">Analysis</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Status:</span>
                  <span className={isAnalyzing ? 'text-green-600' : 'text-gray-600'}>
                    {isAnalyzing ? 'Analyzing' : 'Stopped'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Initialized:</span>
                  <span className={isInitialized ? 'text-green-600' : 'text-gray-600'}>
                    {isInitialized ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Processing Time:</span>
                  <span>{processingTime.toFixed(1)}ms</span>
                </div>
                <div className="flex justify-between">
                  <span>Rep Phase:</span>
                  <span className="capitalize">{metrics.repPhase}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
