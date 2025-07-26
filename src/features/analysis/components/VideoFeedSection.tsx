import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import React, { memo } from 'react';

import type { VisibilityFlags } from '@/features/pose-detection/adapters/squat/squat-analyzer-adapter';
import type { DetectionState } from '@/features/pose-detection/services';

import { PoseGuidanceOverlay } from './PoseGuidanceOverlay';
import { PoseLandmarkOverlay } from './PoseLandmarkOverlay';

export interface VideoFeedSectionProps {
  /** Video element for the camera feed */
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** Camera stream if available */
  cameraStream: MediaStream | null;
  /** Whether analysis is currently running */
  isAnalyzing: boolean;
  /** Pose landmarks from MediaPipe */
  landmarks: NormalizedLandmark[] | null;
  /** Display dimensions for overlay positioning */
  displayDimensions: { width: number; height: number };
  /** Pose detection confidence (0-1) */
  confidence: number;
  /** Current detection state */
  detectionState: DetectionState;
  /** Whether the pose is valid */
  isValidPose: boolean;
  /** Boolean visibility flags for UI guidance */
  visibilityFlags: VisibilityFlags;
}

/**
 * Custom comparison function for React.memo optimization
 * Only re-render if:
 * - Core state changes (stream, analyzing, detectionState)
 * - Display dimensions change
 * - Visibility flags change
 * - Landmarks array reference changes (allows pose updates)
 */
const arePropsEqual = (prevProps: VideoFeedSectionProps, nextProps: VideoFeedSectionProps): boolean => {
  // Always re-render if core state changes
  if (
    prevProps.cameraStream !== nextProps.cameraStream ||
    prevProps.isAnalyzing !== nextProps.isAnalyzing ||
    prevProps.detectionState !== nextProps.detectionState ||
    prevProps.isValidPose !== nextProps.isValidPose
  ) {
    return false;
  }

  // Re-render if display dimensions change
  if (
    prevProps.displayDimensions.width !== nextProps.displayDimensions.width ||
    prevProps.displayDimensions.height !== nextProps.displayDimensions.height
  ) {
    return false;
  }

  // Re-render if landmarks array reference changes (allows pose updates)
  if (prevProps.landmarks !== nextProps.landmarks) {
    return false;
  }

  // Only re-render if confidence changes significantly (5% threshold)
  const confidenceThreshold = 0.05;
  if (Math.abs(prevProps.confidence - nextProps.confidence) > confidenceThreshold) {
    return false;
  }

  // Compare visibility flags
  if (
    prevProps.visibilityFlags.shoulders !== nextProps.visibilityFlags.shoulders ||
    prevProps.visibilityFlags.hips !== nextProps.visibilityFlags.hips ||
    prevProps.visibilityFlags.knees !== nextProps.visibilityFlags.knees ||
    prevProps.visibilityFlags.ankles !== nextProps.visibilityFlags.ankles
  ) {
    return false;
  }

  return true; // Props are considered equal, skip re-render
};

/**
 * VideoFeedSection component displaying the camera feed with pose overlays.
 * Optimized with React.memo to prevent unnecessary re-renders.
 */
const VideoFeedSectionComponent = function VideoFeedSection({
  videoRef,
  cameraStream,
  isAnalyzing,
  landmarks,
  displayDimensions,
  confidence,
  detectionState,
  isValidPose,
  visibilityFlags,
}: VideoFeedSectionProps) {
  const showDebugInfo = typeof window !== 'undefined' && window.location.hostname === 'localhost';

  return (
    <div className="relative mb-6 aspect-video overflow-hidden rounded-lg bg-gray-900">
      {cameraStream && (
        <video
          ref={videoRef}
          data-testid="camera-feed"
          className="h-full w-full object-cover"
          playsInline
          muted
          autoPlay
        />
      )}

      {!cameraStream && (
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

      {/* Pose Landmark Overlay - Always show when analyzing */}
      {isAnalyzing &&
        landmarks &&
        landmarks.length > 0 &&
        displayDimensions.width > 0 &&
        displayDimensions.height > 0 && (
          <>
            {/* Debug info for development */}
            {showDebugInfo && (
              <div className="bg-opacity-50 absolute top-2 left-2 rounded bg-black p-2 text-xs text-white">
                Debug: Display {Math.round(displayDimensions.width)}x{Math.round(displayDimensions.height)} | Landmarks:{' '}
                {landmarks.length} | Valid: {isValidPose ? 'Yes' : 'No'}
              </div>
            )}
            <PoseLandmarkOverlay
              landmarks={landmarks}
              width={displayDimensions.width}
              height={displayDimensions.height}
              confidence={confidence}
              detectionState={detectionState}
            />
          </>
        )}

      {/* Enhanced Pose Guidance Overlay */}
      {isAnalyzing && (
        <PoseGuidanceOverlay
          detectionState={detectionState}
          confidence={confidence}
          visibilityFlags={visibilityFlags}
        />
      )}
    </div>
  );
};

// Export the memoized component with custom comparison
export const VideoFeedSection = memo(VideoFeedSectionComponent, arePropsEqual);
VideoFeedSection.displayName = 'VideoFeedSection';
