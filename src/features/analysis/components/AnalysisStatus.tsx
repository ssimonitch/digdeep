import { memo, useEffect, useRef, useState } from 'react';

import type { RepPhase } from '@/features/pose-detection/services/analyzers/squat/squat-pose-analyzer';

export interface AnalysisStatusProps {
  /** Camera status information */
  camera: {
    isActive: boolean;
    permissionGranted: boolean;
    width: number;
    height: number;
  };
  /** Analysis status information */
  analysis: {
    isAnalyzing: boolean;
    isInitialized: boolean;
    processingTime: number;
    repPhase: RepPhase;
  };
}

/**
 * AnalysisStatus component displaying session status information.
 * Optimized with React.memo and throttled processing time updates.
 */
export const AnalysisStatus = memo(function AnalysisStatus({ camera, analysis }: AnalysisStatusProps) {
  // Throttle processing time updates to reduce re-renders
  const [throttledProcessingTime, setThrottledProcessingTime] = useState(analysis.processingTime);
  const lastProcessingTimeUpdate = useRef(Date.now());

  useEffect(() => {
    const now = Date.now();
    // Only update processing time display once per second
    if (now - lastProcessingTimeUpdate.current >= 1000) {
      setThrottledProcessingTime(analysis.processingTime);
      lastProcessingTimeUpdate.current = now;
    }
  }, [analysis.processingTime]);

  return (
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
              <span className={camera.permissionGranted ? 'text-green-600' : 'text-red-600'}>
                {camera.permissionGranted ? 'Granted' : 'Not Granted'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Resolution:</span>
              <span>
                {camera.width}x{camera.height}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-lg border p-4">
          <h3 className="mb-2 font-semibold">Analysis</h3>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Status:</span>
              <span className={analysis.isAnalyzing ? 'text-green-600' : 'text-gray-600'}>
                {analysis.isAnalyzing ? 'Analyzing' : 'Stopped'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Initialized:</span>
              <span className={analysis.isInitialized ? 'text-green-600' : 'text-gray-600'}>
                {analysis.isInitialized ? 'Yes' : 'No'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Processing Time:</span>
              <span>{throttledProcessingTime.toFixed(1)}ms</span>
            </div>
            <div className="flex justify-between">
              <span>Rep Phase:</span>
              <span className="capitalize">{analysis.repPhase}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

// Custom comparison function for React.memo
AnalysisStatus.displayName = 'AnalysisStatus';
