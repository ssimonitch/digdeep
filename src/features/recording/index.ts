/**
 * Recording Feature Module
 *
 * Barrel export file for the camera/recording feature module.
 * This module handles video recording, camera control, and pose detection
 * integration for powerlifting form analysis.
 */

// Type definitions
export type * from './types';

// Components
// TODO: Export camera and recording components once implemented
// export { CameraView } from './components/CameraView';
// export { RecordingControls } from './components/RecordingControls';
// export { VideoPlayback } from './components/VideoPlayback';

// Hooks
export type { UseCameraOptions, UseCameraReturn } from './hooks/useCamera';
export { useCamera } from './hooks/useCamera';
export type {
  OptimizedStreamActions,
  OptimizedStreamConfig,
  OptimizedStreamState,
  UseOptimizedStreamResult,
} from './hooks/useOptimizedStream';
export { useOptimizationSettings, useOptimizedStream, useStreamPerformance } from './hooks/useOptimizedStream';
// TODO: Export additional recording hooks once implemented
// export { useRecording } from './hooks/useRecording';
// export { usePoseDetection } from './hooks/usePoseDetection';

// Services
export type {
  OptimizationResult,
  StreamOptimizationSettings,
  StreamPerformanceMetrics,
  StreamQualityLevel,
} from './services/VideoStreamOptimizer';
export {
  calculateOptimalResolution,
  getRecommendedQualityLevel,
  VideoStreamOptimizer,
} from './services/VideoStreamOptimizer';
// TODO: Export recording services once implemented
// export { cameraService } from './services/camera.service';
// export { recordingService } from './services/recording.service';
// export { poseDetectionService } from './services/pose-detection.service';

// Stores
// TODO: Export recording stores once implemented
// export { useRecordingStore } from './stores/recording.store';
// export { useCameraStore } from './stores/camera.store';

// Workers
// TODO: Export web workers once implemented
// export { PoseDetectionWorker } from './workers/pose-detection.worker';
// export { VideoProcessingWorker } from './workers/video-processing.worker';

/**
 * Feature Module Structure:
 *
 * /components/
 *   - CameraView.tsx          - Main camera preview component
 *   - RecordingControls.tsx   - Recording start/stop/pause controls
 *   - VideoPlayback.tsx       - Video playback with analysis overlay
 *   - SettingsPanel.tsx       - Camera and recording settings
 *   - PoseOverlay.tsx         - Real-time pose detection visualization
 *
 * /hooks/
 *   - useCamera.ts            - Camera access and stream management
 *   - useRecording.ts         - Recording session management
 *   - usePoseDetection.ts     - MediaPipe pose detection integration
 *   - useVideoProcessing.ts   - Video analysis and processing
 *
 * /services/
 *   - camera.service.ts       - Camera API wrapper and utilities
 *   - recording.service.ts    - MediaRecorder API wrapper
 *   - pose-detection.service.ts - MediaPipe integration service
 *   - video-storage.service.ts - Video upload and storage (Cloudinary)
 *
 * /stores/
 *   - recording.store.ts      - Recording session state management
 *   - camera.store.ts         - Camera state and configuration
 *   - pose-detection.store.ts - Pose detection results and history
 *
 * /workers/
 *   - pose-detection.worker.ts - Background pose detection processing
 *   - video-processing.worker.ts - Video analysis and frame processing
 */
