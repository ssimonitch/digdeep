/**
 * Camera and Recording Type Definitions
 *
 * Defines types for camera control, video recording, and pose detection
 * integration for the DigDeep powerlifting form analysis application.
 */

/**
 * Camera device information
 */
export interface CameraDevice {
  /** Device identifier */
  deviceId: string;
  /** Device label/name */
  label: string;
  /** Device group identifier */
  groupId: string;
  /** Device kind (videoinput) */
  kind: 'videoinput';
  /** Camera facing mode */
  facingMode?: 'user' | 'environment';
}

/**
 * Camera capability constraints
 */
export interface CameraCapabilities {
  /** Device identifier */
  deviceId: string;
  /** Supported resolutions */
  resolutions: {
    width: number;
    height: number;
  }[];
  /** Supported frame rates */
  frameRates: number[];
  /** Supported facing modes */
  facingModes: ('user' | 'environment')[];
  /** Maximum resolution */
  maxResolution: {
    width: number;
    height: number;
  };
  /** Minimum resolution */
  minResolution: {
    width: number;
    height: number;
  };
  /** Supported aspect ratios */
  aspectRatios: string[];
}

/**
 * Resolution preset definitions
 */
export interface ResolutionPreset {
  /** Preset name */
  name: string;
  /** Display label */
  label: string;
  /** Resolution width */
  width: number;
  /** Resolution height */
  height: number;
  /** Aspect ratio */
  aspectRatio: string;
  /** Recommended frame rate */
  frameRate: number;
}

/**
 * Camera configuration validation result
 */
export interface ConfigValidationResult {
  /** Whether configuration is valid */
  valid: boolean;
  /** Validation errors */
  errors: string[];
  /** Validation warnings */
  warnings: string[];
  /** Suggested configuration adjustments */
  suggestions?: Partial<CameraConfig>;
}

/**
 * Camera configuration and constraints
 */
export interface CameraConfig {
  /** Video resolution width */
  width: number;
  /** Video resolution height */
  height: number;
  /** Target frame rate for recording */
  frameRate: number;
  /** Preferred camera facing mode */
  facingMode: 'user' | 'environment';
  /** Video codec preference */
  codec?: string;
  /** Specific device ID (optional) */
  deviceId?: string;
}

/**
 * Camera permission and access states
 */
export interface CameraPermission {
  /** Whether camera permission is granted */
  granted: boolean;
  /** Whether permission request is pending */
  pending: boolean;
  /** Error message if permission denied */
  error?: string;
}

/**
 * Enhanced permission states for comprehensive permission handling
 */
export type PermissionState = 'granted' | 'denied' | 'prompt' | 'unknown';

/**
 * Permission error types with user-friendly messages
 */
export type PermissionErrorType =
  | 'permission_denied'
  | 'browser_not_supported'
  | 'security_error'
  | 'device_not_found'
  | 'already_in_use'
  | 'network_error'
  | 'unknown_error';

/**
 * Permission error with recovery strategies
 */
export interface PermissionError {
  type: PermissionErrorType;
  message: string;
  userMessage: string;
  recoveryActions: string[];
  canRetry: boolean;
}

/**
 * Permission status with detailed information
 */
export interface PermissionStatus {
  state: PermissionState;
  error?: PermissionError;
  lastChecked: number;
  browserSupport: {
    permissions: boolean;
    mediaDevices: boolean;
    getUserMedia: boolean;
  };
}

/**
 * Permission change callback
 */
export type PermissionChangeCallback = (status: PermissionStatus) => void;

/**
 * Camera permission prompt UI states
 */
export interface PermissionPromptState {
  /** Whether the prompt is visible */
  visible: boolean;
  /** Current permission state */
  permissionState: PermissionState;
  /** Error information if any */
  error?: PermissionError;
  /** Whether a permission request is in progress */
  requesting: boolean;
  /** Whether to show detailed recovery instructions */
  showRecoveryInstructions: boolean;
}

/**
 * Camera stream state and controls
 */
export interface CameraStream {
  /** MediaStream instance for video */
  stream: MediaStream | null;
  /** Whether camera is currently active */
  isActive: boolean;
  /** Whether camera is initializing */
  isInitializing: boolean;
  /** Current camera configuration */
  config: CameraConfig;
  /** Permission state */
  permission: CameraPermission;
  /** Error state */
  error?: string;
}

/**
 * Recording session states
 */
export type RecordingState = 'idle' | 'recording' | 'paused' | 'stopped' | 'processing';

/**
 * Recording session configuration
 */
export interface RecordingConfig {
  /** Maximum recording duration in seconds */
  maxDuration: number;
  /** Video quality setting */
  quality: 'low' | 'medium' | 'high';
  /** Whether to enable pose detection during recording */
  enablePoseDetection: boolean;
  /** Auto-stop recording after movement detection */
  autoStop: boolean;
}

/**
 * Recording session data
 */
export interface RecordingSession {
  /** Unique session identifier */
  id: string;
  /** Current recording state */
  state: RecordingState;
  /** Recording start timestamp */
  startTime: number | null;
  /** Recording duration in seconds */
  duration: number;
  /** MediaRecorder instance */
  recorder: MediaRecorder | null;
  /** Recorded video blob */
  videoBlob: Blob | null;
  /** Recording configuration */
  config: RecordingConfig;
  /** Error state */
  error?: string;
}

/**
 * Video file metadata
 */
export interface VideoMetadata {
  /** File size in bytes */
  size: number;
  /** Duration in seconds */
  duration: number;
  /** Video resolution */
  resolution: {
    width: number;
    height: number;
  };
  /** Recording timestamp */
  timestamp: number;
  /** File format/codec */
  format: string;
}

/**
 * Pose detection integration types
 */
export interface PoseDetectionFrame {
  /** Frame timestamp */
  timestamp: number;
  /** Detected pose landmarks */
  landmarks: number[][];
  /** Confidence score */
  confidence: number;
  /** Frame processing time in ms */
  processingTime: number;
}

/**
 * Real-time pose detection results
 */
export interface PoseDetectionResult {
  /** Whether pose was detected */
  detected: boolean;
  /** Pose landmarks array */
  landmarks: number[][];
  /** Overall confidence score */
  confidence: number;
  /** Processing timestamp */
  timestamp: number;
  /** Squat-specific metrics */
  squatMetrics?: {
    /** Squat depth percentage */
    depth: number;
    /** Bar path deviation */
    barPath: number[];
    /** Knee alignment score */
    kneeAlignment: number;
    /** Hip hinge angle */
    hipAngle: number;
  };
}

/**
 * Camera and recording event types
 */
export interface CameraEvents {
  /** Camera permission granted */
  permissionGranted: () => void;
  /** Camera permission denied */
  permissionDenied: (error: string) => void;
  /** Camera stream started */
  streamStarted: (stream: MediaStream) => void;
  /** Camera stream stopped */
  streamStopped: () => void;
  /** Camera error occurred */
  error: (error: string) => void;
}

export interface RecordingEvents {
  /** Recording started */
  recordingStarted: (sessionId: string) => void;
  /** Recording stopped */
  recordingStopped: (sessionId: string, blob: Blob) => void;
  /** Recording paused */
  recordingPaused: (sessionId: string) => void;
  /** Recording resumed */
  recordingResumed: (sessionId: string) => void;
  /** Recording error occurred */
  recordingError: (sessionId: string, error: string) => void;
  /** Recording progress update */
  recordingProgress: (sessionId: string, duration: number) => void;
}

/**
 * Stream optimization types
 */
export interface StreamOptimizationMetrics {
  /** Current FPS */
  currentFPS: number;
  /** Target FPS */
  targetFPS: number;
  /** Average FPS over monitoring window */
  averageFPS: number;
  /** Memory usage percentage */
  memoryUsage: number;
  /** Number of dropped frames */
  droppedFrames: number;
  /** Stream quality level */
  qualityLevel: string;
  /** Whether optimization is active */
  isOptimizing: boolean;
  /** Last optimization timestamp */
  lastOptimization: number;
}

/**
 * Frame capture types
 */
export interface FrameCaptureConfig {
  /** Target frame rate for capture */
  targetFPS: number;
  /** Maximum frames to buffer */
  maxBufferSize: number;
  /** Frame quality (0-1) */
  quality: number;
  /** Output format for frames */
  format: 'imageData' | 'blob' | 'dataURL';
  /** Whether to enable automatic garbage collection */
  autoGC: boolean;
  /** Memory threshold for triggering cleanup (MB) */
  memoryThreshold: number;
}

export interface CapturedFrame {
  /** Frame timestamp */
  timestamp: number;
  /** Frame sequence number */
  sequenceNumber: number;
  /** Frame data based on format */
  data: ImageData | Blob | string;
  /** Frame dimensions */
  dimensions: {
    width: number;
    height: number;
  };
  /** Frame size in bytes */
  size: number;
  /** Frame quality level */
  quality: number;
}

export interface FrameBufferStats {
  /** Current buffer size */
  currentSize: number;
  /** Maximum buffer size */
  maxSize: number;
  /** Total frames processed */
  totalFrames: number;
  /** Frames dropped due to buffer overflow */
  droppedFrames: number;
  /** Memory usage in MB */
  memoryUsage: number;
  /** Buffer utilization percentage */
  utilization: number;
  /** Average frame size */
  averageFrameSize: number;
  /** Current frame rate */
  currentFPS: number;
}

export interface MemoryStats {
  /** Current memory usage in MB */
  currentUsage: number;
  /** Peak memory usage in MB */
  peakUsage: number;
  /** Memory threshold in MB */
  threshold: number;
  /** Number of GC cycles performed */
  gcCycles: number;
  /** Last GC timestamp */
  lastGC: number;
  /** Frames cleaned up */
  framesCleanedUp: number;
}

export interface FrameCaptureState {
  /** Whether frame capture is active */
  isCapturing: boolean;
  /** Current frame buffer */
  frames: CapturedFrame[];
  /** Latest captured frame */
  latestFrame: CapturedFrame | null;
  /** Frame capture statistics */
  stats: FrameBufferStats;
  /** Memory usage statistics */
  memoryStats: MemoryStats;
  /** Any capture errors */
  error: string | null;
  /** Whether the service is initializing */
  isInitializing: boolean;
}

/**
 * Combined camera and recording state
 */
export interface RecordingFeatureState {
  /** Camera stream state */
  camera: CameraStream;
  /** Current recording session */
  recording: RecordingSession | null;
  /** Frame capture state */
  frameCapture: FrameCaptureState;
  /** Pose detection state */
  poseDetection: {
    enabled: boolean;
    results: PoseDetectionResult[];
    lastFrame: PoseDetectionFrame | null;
  };
  /** Stream optimization state */
  optimization: {
    enabled: boolean;
    metrics: StreamOptimizationMetrics | null;
    currentQualityLevel: string;
    autoOptimization: boolean;
  };
  /** UI state */
  ui: {
    /** Whether controls are visible */
    showControls: boolean;
    /** Whether settings panel is open */
    showSettings: boolean;
    /** Current view mode */
    viewMode: 'camera' | 'playback' | 'analysis';
    /** Whether performance metrics are shown */
    showPerformanceMetrics: boolean;
  };
}
