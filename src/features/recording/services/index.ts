/**
 * Recording Services
 *
 * Central export point for all recording-related services
 */

export type * from '../types';
export { CameraService, cameraService } from './CameraService';
export { FrameCaptureService, FrameFormatConverter } from './FrameCaptureService';
export { PermissionService, permissionService } from './PermissionService';
export {
  calculateOptimalResolution,
  getRecommendedQualityLevel,
  type OptimizationCallback,
  type OptimizationResult,
  type PerformanceCallback,
  type StreamOptimizationSettings,
  type StreamPerformanceMetrics,
  type StreamQualityLevel,
  VideoStreamOptimizer,
} from './VideoStreamOptimizer';
