import { useState } from 'react';

import { PerformanceDashboard } from '@/shared/components/PerformanceDashboard';

import type { PerformanceStats } from '../services/mediapipe-poc.service';
import { MediaPipePOC } from './MediaPipePOC';

export function MediaPipePOCPage() {
  const [testResults, setTestResults] = useState<{
    passed: boolean;
    stats: PerformanceStats;
    timestamp: string;
  } | null>(null);

  const handleTestComplete = (passed: boolean, stats: PerformanceStats) => {
    setTestResults({
      passed,
      stats,
      timestamp: new Date().toLocaleString(),
    });
  };

  const clearResults = () => {
    setTestResults(null);
  };

  return (
    <div className="container mx-auto space-y-6 px-4 py-8">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-bold">MediaPipe Performance Validation</h1>
        <p className="text-muted-foreground">
          Test MediaPipe pose detection performance to validate 30+ FPS requirement
        </p>
      </div>

      <MediaPipePOC onTestComplete={handleTestComplete} />

      {testResults && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Test Results</h2>
            <button
              onClick={clearResults}
              className="text-muted-foreground hover:text-foreground text-sm"
              type="button"
            >
              Clear Results
            </button>
          </div>

          <div
            className={`rounded-lg border-2 p-6 ${
              testResults.passed ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
            }`}
          >
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                <h3 className={`mb-3 text-lg font-semibold ${testResults.passed ? 'text-green-700' : 'text-red-700'}`}>
                  {testResults.passed ? '✅ TEST PASSED' : '❌ TEST FAILED'}
                </h3>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Completed:</span>
                    <span className="font-mono">{testResults.timestamp}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>MediaPipe FPS:</span>
                    <span className={`font-mono ${testResults.stats.fps >= 30 ? 'text-green-600' : 'text-red-600'}`}>
                      {testResults.stats.fps.toFixed(1)} {testResults.stats.fps >= 30 ? '✓' : '✗'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Success Rate:</span>
                    <span
                      className={`font-mono ${testResults.stats.successRate >= 90 ? 'text-green-600' : 'text-red-600'}`}
                    >
                      {testResults.stats.successRate.toFixed(1)}% {testResults.stats.successRate >= 90 ? '✓' : '✗'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Avg Processing Time:</span>
                    <span className="font-mono">{testResults.stats.avgProcessingTime.toFixed(1)}ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Frames:</span>
                    <span className="font-mono">{testResults.stats.frameCount}</span>
                  </div>
                  {testResults.stats.errorCount > 0 && (
                    <div className="flex justify-between">
                      <span>Errors:</span>
                      <span className="font-mono text-red-600">{testResults.stats.errorCount}</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="mb-3 text-lg font-semibold">Performance Analysis</h3>
                <div className="space-y-2 text-sm">
                  {testResults.passed ? (
                    <div className="text-green-700">
                      <p>
                        <strong>✅ Performance Requirements Met</strong>
                      </p>
                      <p>MediaPipe can maintain the required 30+ FPS with good reliability.</p>
                      <p className="mt-2 text-xs">
                        <strong>Recommendation:</strong> Proceed with MediaPipe integration on main thread.
                      </p>
                    </div>
                  ) : (
                    <div className="text-red-700">
                      <p>
                        <strong>❌ Performance Requirements Not Met</strong>
                      </p>
                      {testResults.stats.fps < 30 && <p>• FPS below 30: Consider Web Workers or lower frame rate</p>}
                      {testResults.stats.successRate < 90 && (
                        <p>• Success rate below 90%: Investigate error handling</p>
                      )}
                      <p className="mt-2 text-xs">
                        <strong>Recommendation:</strong> Implement Web Workers or optimize settings.
                      </p>
                    </div>
                  )}

                  <div className="mt-4 border-t pt-3">
                    <p className="text-muted-foreground text-xs">
                      Performance may vary based on device capabilities, camera resolution, and browser optimization.
                      Test on target devices for production validation.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Technical Details</h2>
        <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
          <div className="space-y-2">
            <h3 className="font-medium">Test Configuration</h3>
            <ul className="text-muted-foreground space-y-1">
              <li>• Model: pose_landmarker_lite (optimized for performance)</li>
              <li>• GPU Acceleration: Enabled</li>
              <li>• Video Resolution: 640x480</li>
              <li>• Target Frame Rate: 30 FPS</li>
              <li>• Number of Poses: 1 (single person detection)</li>
              <li>• Segmentation Masks: Disabled</li>
            </ul>
          </div>
          <div className="space-y-2">
            <h3 className="font-medium">Success Criteria</h3>
            <ul className="text-muted-foreground space-y-1">
              <li>• MediaPipe FPS: ≥30 FPS sustained</li>
              <li>• Success Rate: ≥90% frame processing</li>
              <li>• Processing Time: &lt;33ms per frame</li>
              <li>• Error Rate: &lt;10% failed detections</li>
              <li>• Browser Performance: Stable during test</li>
            </ul>
          </div>
        </div>
      </div>

      <PerformanceDashboard showErrors={true} />
    </div>
  );
}
