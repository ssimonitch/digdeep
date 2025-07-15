/**
 * Recording Feature Hooks
 *
 * Custom hooks for camera management, recording control, and pose detection
 * integration for the DigDeep powerlifting form analysis application.
 */

export type { UseCameraOptions, UseCameraReturn } from './useCamera';
export { clearCapabilityCache, useCamera } from './useCamera';
export type { UseCameraPermissionsReturn } from './useCameraPermissions';
export { useCameraPermissions } from './useCameraPermissions';
export {
  useAutoFrameCapture,
  useFrameCapture,
  useOptimizedFrameCapture,
  usePoseDetectionFrameCapture,
} from './useFrameCapture';
export type {
  OptimizedStreamActions,
  OptimizedStreamConfig,
  OptimizedStreamState,
  UseOptimizedStreamResult,
} from './useOptimizedStream';
export { useOptimizationSettings, useOptimizedStream, useStreamPerformance } from './useOptimizedStream';
