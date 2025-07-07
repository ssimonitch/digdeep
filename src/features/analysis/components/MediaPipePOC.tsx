import { useCallback, useEffect, useRef, useState } from 'react';

import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { usePerformanceMonitoring } from '@/shared/hooks/usePerformanceMonitoring';

import {
  isMediaPipeSupported,
  mediaPipePOC,
  type PerformanceStats,
  type TestCallbacks,
} from '../services/mediapipe-poc.service';

interface MediaPipePOCProps {
  onPerformanceUpdate?: (stats: PerformanceStats) => void;
  onTestComplete?: (passed: boolean, stats: PerformanceStats) => void;
}

export function MediaPipePOC({ onPerformanceUpdate, onTestComplete }: MediaPipePOCProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<PerformanceStats | null>(null);
  const [testDuration, setTestDuration] = useState(30); // seconds
  const [testProgress, setTestProgress] = useState(0);

  const { startMonitoring, stopMonitoring, metrics } = usePerformanceMonitoring();

  // Check MediaPipe support on mount
  useEffect(() => {
    setIsSupported(isMediaPipeSupported());
  }, []);

  const initializeMediaPipe = useCallback(() => {
    void (async () => {
      try {
        setError(null);
        await mediaPipePOC.initialize();
        setIsInitialized(true);
      } catch (err) {
        setError(`Failed to initialize MediaPipe: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    })();
  }, []);

  const startCamera = useCallback(async () => {
    if (!videoRef.current) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30 },
          facingMode: 'user',
        },
      });

      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      return true;
    } catch (err) {
      setError(`Camera access failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      return false;
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
  }, []);

  const startTest = useCallback(() => {
    void (async () => {
      if (!isInitialized || !videoRef.current) return;

      const cameraStarted = await startCamera();
      if (!cameraStarted) return;

      setIsRunning(true);
      setTestProgress(0);
      startMonitoring();

      const callbacks: TestCallbacks = {
        onProgress: (progress) => {
          setTestProgress(progress);
        },
        onStatsUpdate: (stats) => {
          setStats(stats);
          onPerformanceUpdate?.(stats);
        },
        onComplete: (passed, finalStats) => {
          setIsRunning(false);
          stopMonitoring();
          stopCamera();
          onTestComplete?.(passed, finalStats);
        },
        onError: (errorMessage) => {
          setError(errorMessage);
          setIsRunning(false);
          stopMonitoring();
          stopCamera();
        },
      };

      mediaPipePOC.startTest(videoRef.current, testDuration, callbacks);
    })();
  }, [
    isInitialized,
    testDuration,
    startMonitoring,
    stopMonitoring,
    onPerformanceUpdate,
    onTestComplete,
    startCamera,
    stopCamera,
  ]);

  const stopTest = useCallback(() => {
    mediaPipePOC.stopTest();
    setIsRunning(false);
    stopMonitoring();
    stopCamera();
  }, [stopMonitoring, stopCamera]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTest();
      mediaPipePOC.destroy();
    };
  }, [stopTest]);

  const getTestStatus = () => {
    if (!stats) return { status: 'Not started', color: 'bg-gray-500' };

    if (isRunning) {
      return { status: 'Running...', color: 'bg-blue-500' };
    }

    const passed = stats.fps >= 30 && stats.successRate >= 90;
    if (passed) {
      return { status: 'PASSED', color: 'bg-green-500' };
    } else {
      return { status: 'FAILED', color: 'bg-red-500' };
    }
  };

  if (!isSupported) {
    return (
      <Card className="p-6">
        <div className="text-center">
          <h3 className="mb-2 text-lg font-semibold text-red-600">MediaPipe Not Supported</h3>
          <p className="text-muted-foreground text-sm">
            Your browser doesn't support the required features for MediaPipe pose detection:
          </p>
          <ul className="mt-2 space-y-1 text-left text-xs">
            <li>• WebGL support</li>
            <li>• WebAssembly support</li>
            <li>• Camera access (getUserMedia)</li>
          </ul>
        </div>
      </Card>
    );
  }

  return (
    <Card className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">MediaPipe Performance Test</h3>
        <Badge className={`${getTestStatus().color} text-white`}>{getTestStatus().status}</Badge>
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</div>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <div className="flex gap-2">
            {!isInitialized ? (
              <Button onClick={initializeMediaPipe} disabled={isRunning}>
                Initialize MediaPipe
              </Button>
            ) : (
              <>
                <Button
                  onClick={isRunning ? stopTest : startTest}
                  variant={isRunning ? 'destructive' : 'default'}
                  disabled={!isInitialized}
                >
                  {isRunning ? 'Stop Test' : 'Start Test'}
                </Button>
                <div className="flex items-center gap-2">
                  <label className="text-sm">Duration:</label>
                  <select
                    value={testDuration}
                    onChange={(e) => setTestDuration(Number(e.target.value))}
                    disabled={isRunning}
                    className="rounded border px-2 py-1 text-sm"
                  >
                    <option value={10}>10s</option>
                    <option value={30}>30s</option>
                    <option value={60}>60s</option>
                  </select>
                </div>
              </>
            )}
          </div>

          {isRunning && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>{testProgress.toFixed(1)}%</span>
              </div>
              <div className="bg-muted h-2 w-full rounded">
                <div className="h-2 rounded bg-blue-500" style={{ width: `${testProgress}%` }} />
              </div>
            </div>
          )}

          <video
            ref={videoRef}
            className="h-48 w-full rounded bg-black"
            style={{ transform: 'scaleX(-1)' }} // Mirror for user-facing camera
            muted
            playsInline
          />
        </div>

        <div className="space-y-4">
          {stats && (
            <div className="space-y-3">
              <h4 className="font-medium">Performance Metrics</h4>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-muted-foreground">MediaPipe FPS</div>
                  <div className="font-mono text-lg">
                    {stats.fps.toFixed(1)}
                    <span className={`ml-2 text-xs ${stats.fps >= 30 ? 'text-green-600' : 'text-red-600'}`}>
                      {stats.fps >= 30 ? '✓' : '✗'}
                    </span>
                  </div>
                </div>

                <div>
                  <div className="text-muted-foreground">Processing Time</div>
                  <div className="font-mono text-lg">{stats.avgProcessingTime.toFixed(1)}ms</div>
                </div>

                <div>
                  <div className="text-muted-foreground">Success Rate</div>
                  <div className="font-mono text-lg">
                    {stats.successRate.toFixed(1)}%
                    <span className={`ml-2 text-xs ${stats.successRate >= 90 ? 'text-green-600' : 'text-red-600'}`}>
                      {stats.successRate >= 90 ? '✓' : '✗'}
                    </span>
                  </div>
                </div>

                <div>
                  <div className="text-muted-foreground">Frame Count</div>
                  <div className="font-mono text-lg">{stats.frameCount}</div>
                </div>
              </div>

              {stats.errorCount > 0 && <div className="text-sm text-red-600">Errors: {stats.errorCount}</div>}
            </div>
          )}

          {metrics && (
            <div className="space-y-3 border-t pt-3">
              <h4 className="font-medium">Browser Performance</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-muted-foreground">Browser FPS</div>
                  <div className="font-mono">{metrics.fps.toFixed(1)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Memory</div>
                  <div className="font-mono">{metrics.memoryUsage.percentage}%</div>
                </div>
              </div>
            </div>
          )}

          <div className="text-muted-foreground space-y-1 text-xs">
            <div>
              <strong>Target:</strong> 30+ FPS with 90%+ success rate
            </div>
            <div>
              <strong>GPU:</strong> {isInitialized ? 'Enabled' : 'Pending'}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
