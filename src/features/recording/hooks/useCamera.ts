import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';

import { errorMonitor } from '@/shared/services/error-monitor.service';

import { CAMERA_CONSTRAINTS, createSafeCameraConfig, partialCameraConfigSchema } from '../schemas';
import type { CameraConfig, CameraEvents, CameraPermission, CameraStream } from '../types';
import { useCameraPermissions } from './useCameraPermissions';

/**
 * Camera hook configuration options
 */
export interface UseCameraOptions {
  /** Whether to auto-start camera on mount */
  autoStart?: boolean;
  /** Default camera configuration */
  defaultConfig?: Partial<CameraConfig>;
  /** Event handlers for camera lifecycle */
  onEvents?: Partial<CameraEvents>;
}

/**
 * Camera hook return interface
 */
export interface UseCameraReturn {
  /** Current camera stream state */
  camera: CameraStream;
  /** Initialize camera with permissions */
  initialize: () => Promise<void>;
  /** Start camera stream */
  start: () => Promise<MediaStream>;
  /** Stop camera stream */
  stop: () => void;
  /** Switch camera facing mode */
  switchCamera: () => Promise<void>;
  /** Update camera configuration */
  updateConfig: (config: Partial<CameraConfig>) => Promise<void>;
  /** Check camera permissions */
  checkPermissions: () => Promise<CameraPermission>;
  /** Request camera permissions */
  requestPermissions: () => Promise<CameraPermission>;
}

// Default camera configuration is created inside the hook using createSafeCameraConfig()

/**
 * Camera state action types for useReducer
 */
type CameraAction =
  | { type: 'INIT_START' }
  | { type: 'INIT_SUCCESS'; permission: CameraPermission }
  | { type: 'INIT_ERROR'; error: string }
  | { type: 'PERMISSION_PENDING' }
  | { type: 'PERMISSION_UPDATE'; permission: CameraPermission }
  | { type: 'STREAM_START' }
  | { type: 'STREAM_SUCCESS'; stream: MediaStream }
  | { type: 'STREAM_STOP' }
  | { type: 'STREAM_ERROR'; error: string }
  | { type: 'CONFIG_UPDATE'; config: Partial<CameraConfig> }
  | { type: 'ERROR'; error: string }
  | { type: 'CLEAR_ERROR' };

/**
 * Camera state reducer for centralized state management
 */
function cameraReducer(state: CameraStream, action: CameraAction): CameraStream {
  switch (action.type) {
    case 'INIT_START':
      return {
        ...state,
        isInitializing: true,
        error: undefined,
      };

    case 'INIT_SUCCESS':
      return {
        ...state,
        isInitializing: false,
        permission: action.permission,
        error: undefined,
      };

    case 'INIT_ERROR':
      return {
        ...state,
        isInitializing: false,
        error: action.error,
      };

    case 'PERMISSION_PENDING':
      return {
        ...state,
        permission: { ...state.permission, pending: true },
        error: undefined,
      };

    case 'PERMISSION_UPDATE':
      return {
        ...state,
        permission: action.permission,
      };

    case 'STREAM_START':
      return {
        ...state,
        isInitializing: true,
        error: undefined,
      };

    case 'STREAM_SUCCESS':
      return {
        ...state,
        stream: action.stream,
        isActive: true,
        isInitializing: false,
        error: undefined,
      };

    case 'STREAM_STOP':
      return {
        ...state,
        stream: null,
        isActive: false,
        isInitializing: false,
      };

    case 'STREAM_ERROR':
      return {
        ...state,
        isInitializing: false,
        error: action.error,
      };

    case 'CONFIG_UPDATE':
      return {
        ...state,
        config: { ...state.config, ...action.config },
      };

    case 'ERROR':
      return {
        ...state,
        error: action.error,
      };

    case 'CLEAR_ERROR':
      return {
        ...state,
        error: undefined,
      };

    default:
      return state;
  }
}

/**
 * Device capability cache to avoid creating test streams repeatedly.
 * Creating a test stream to check capabilities adds ~100-200ms overhead each time.
 * By caching capabilities for 5 minutes, we significantly improve performance
 * for operations like camera switching or configuration updates.
 */
interface CachedCapability {
  capabilities: MediaTrackCapabilities;
  timestamp: number;
  deviceId: string;
}

// Module-level cache to persist across hook instances
const capabilityCache = new Map<string, CachedCapability>();
const CAPABILITY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes - capabilities rarely change

/**
 * Clear stale entries from the capability cache
 */
const cleanCapabilityCache = (): void => {
  const now = Date.now();
  for (const [key, cached] of capabilityCache.entries()) {
    if (now - cached.timestamp > CAPABILITY_CACHE_TTL) {
      capabilityCache.delete(key);
    }
  }
};

/**
 * Manually clear all cached capabilities
 * Useful when switching cameras or after permission changes
 */
export const clearCapabilityCache = (): void => {
  capabilityCache.clear();
};

/**
 * Camera capability detection utilities with caching
 */
const getCameraCapabilities = async (deviceId?: string): Promise<MediaTrackCapabilities | null> => {
  try {
    // Clean stale cache entries periodically
    cleanCapabilityCache();

    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter((device) => device.kind === 'videoinput');

    if (videoDevices.length === 0) return null;

    const targetDevice = deviceId ? videoDevices.find((device) => device.deviceId === deviceId) : videoDevices[0];

    if (!targetDevice) return null;

    // Check cache first to avoid creating unnecessary test streams
    const cacheKey = targetDevice.deviceId;
    const cached = capabilityCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CAPABILITY_CACHE_TTL) {
      // Return cached capabilities, saving ~100-200ms
      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.info('Using cached camera capabilities', {
          deviceId: cacheKey,
          cacheAge: Date.now() - cached.timestamp,
          ttl: CAPABILITY_CACHE_TTL,
        });
      }
      return cached.capabilities;
    }

    // No valid cache entry, need to create test stream
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { deviceId: targetDevice.deviceId },
    });

    const track = stream.getVideoTracks()[0];
    const capabilities = track.getCapabilities();

    // Clean up test stream
    track.stop();

    // Cache the capabilities for future use
    if (capabilities) {
      capabilityCache.set(cacheKey, {
        capabilities,
        timestamp: Date.now(),
        deviceId: targetDevice.deviceId,
      });
    }

    return capabilities;
  } catch (error) {
    errorMonitor.reportError(
      `Failed to get camera capabilities: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'custom',
      'low',
      { deviceId, error: error instanceof Error ? error.message : String(error) },
    );
    return null;
  }
};

/**
 * Optimize camera constraints for target frame rate and resolution
 */
const optimizeConstraints = (config: CameraConfig, capabilities?: MediaTrackCapabilities): MediaTrackConstraints => {
  const constraints: MediaTrackConstraints = {
    width: { ideal: config.width },
    height: { ideal: config.height },
    frameRate: { ideal: config.frameRate, min: Math.max(CAMERA_CONSTRAINTS.MIN_FRAME_RATE, 24) },
    facingMode: config.facingMode,
  };

  // Apply capability-based optimizations
  if (capabilities) {
    // Optimize frame rate based on device capabilities
    if (capabilities.frameRate) {
      const maxFrameRate = Math.max(
        ...(capabilities.frameRate.max ? [capabilities.frameRate.max] : [CAMERA_CONSTRAINTS.DEFAULT_FRAME_RATE]),
      );
      constraints.frameRate = {
        ideal: Math.min(config.frameRate, maxFrameRate),
        min: Math.min(24, maxFrameRate),
      };
    }

    // Optimize resolution based on device capabilities
    if (capabilities.width && capabilities.height) {
      const maxWidth = Math.max(
        ...(capabilities.width.max ? [capabilities.width.max] : [CAMERA_CONSTRAINTS.DEFAULT_WIDTH]),
      );
      const maxHeight = Math.max(
        ...(capabilities.height.max ? [capabilities.height.max] : [CAMERA_CONSTRAINTS.DEFAULT_HEIGHT]),
      );

      constraints.width = {
        ideal: Math.min(config.width, maxWidth),
        max: maxWidth,
      };
      constraints.height = {
        ideal: Math.min(config.height, maxHeight),
        max: maxHeight,
      };
    }
  }

  return constraints;
};

/**
 * Custom hook for managing camera access, stream control, and 30 FPS optimization
 *
 * This hook provides comprehensive camera management including:
 * - Permission handling with proper error states
 * - Stream initialization and cleanup
 * - 30 FPS targeting with fallback optimization
 * - Camera switching (front/back)
 * - Configuration updates
 * - Browser compatibility handling
 *
 * @param options - Configuration options for camera behavior
 * @returns Camera state and control functions
 *
 * @example
 * ```typescript
 * const { camera, initialize, start, stop, switchCamera } = useCamera({
 *   autoStart: true,
 *   defaultConfig: { frameRate: 30, facingMode: 'environment' },
 *   onEvents: {
 *     streamStarted: (stream) => console.log('Camera started'),
 *     error: (error) => console.error('Camera error:', error),
 *   }
 * });
 * ```
 */
export function useCamera(options: UseCameraOptions = {}): UseCameraReturn {
  const { autoStart = false, defaultConfig = {}, onEvents = {} } = options;

  // Validate and stabilize config object to prevent unnecessary re-renders
  const config = useMemo(() => {
    // Validate the provided config and merge with defaults
    const result = createSafeCameraConfig(defaultConfig);

    // Log validation warnings if there were errors
    if (result.errors && result.errors.length > 0) {
      errorMonitor.reportError('Invalid camera configuration provided', 'custom', 'low', {
        errors: result.errors,
        providedConfig: defaultConfig,
      });
    }

    return result.config;
  }, [defaultConfig]);

  // Use the dedicated permissions hook for cleaner separation of concerns
  const {
    permission: hookPermission,
    checkPermissions: hookCheckPermissions,
    requestPermissions: hookRequestPermissions,
  } = useCameraPermissions();

  // Initialize state with useReducer
  const [camera, dispatch] = useReducer(cameraReducer, {
    stream: null,
    isActive: false,
    isInitializing: false,
    config,
    permission: hookPermission, // Initialize with hook's permission state
    error: undefined,
  });

  // Store current stream for cleanup
  const streamRef = useRef<MediaStream | null>(null);
  const capabilitiesRef = useRef<MediaTrackCapabilities | null>(null);

  // Sync permission state from hook to reducer
  useEffect(() => {
    dispatch({ type: 'PERMISSION_UPDATE', permission: hookPermission });
  }, [hookPermission]);

  /**
   * Check current camera permissions without requesting.
   * Wraps the hook's checkPermissions to maintain API compatibility.
   */
  const checkPermissions = useCallback(async (): Promise<CameraPermission> => {
    return hookCheckPermissions();
  }, [hookCheckPermissions]);

  /**
   * Request camera permissions.
   * Wraps the hook's requestPermissions to add event handling.
   */
  const requestPermissions = useCallback(async (): Promise<CameraPermission> => {
    const result = await hookRequestPermissions(camera.config.facingMode);

    // Trigger appropriate events based on result
    if (result.granted) {
      onEvents.permissionGranted?.();
    } else if (result.error) {
      onEvents.permissionDenied?.(result.error);
      dispatch({ type: 'ERROR', error: result.error });
    }

    return result;
  }, [camera.config.facingMode, hookRequestPermissions, onEvents]);

  /**
   * Initialize camera with permissions check
   */
  const initialize = useCallback(async (): Promise<void> => {
    dispatch({ type: 'INIT_START' });

    try {
      // Check permissions first
      const permission = await checkPermissions();

      if (!permission.granted && !permission.pending) {
        throw new Error(permission.error ?? 'Camera permission denied');
      }

      // Request permissions if needed
      if (!permission.granted) {
        const requestedPermission = await requestPermissions();
        if (!requestedPermission.granted) {
          throw new Error(requestedPermission.error ?? 'Camera permission denied');
        }
      }

      // Get camera capabilities for optimization
      // This uses caching to avoid the ~100-200ms overhead of creating a test stream
      capabilitiesRef.current = await getCameraCapabilities();

      dispatch({ type: 'INIT_SUCCESS', permission: { granted: true, pending: false } });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Camera initialization failed';

      dispatch({ type: 'INIT_ERROR', error: errorMessage });

      onEvents.error?.(errorMessage);
      throw error;
    }
  }, [checkPermissions, requestPermissions, onEvents]);

  /**
   * Start camera stream with optimized constraints
   * @returns The MediaStream that was started
   */
  const start = useCallback(async (): Promise<MediaStream> => {
    // Check current permission state to avoid stale closure issues
    const currentPermission = await checkPermissions();
    if (!currentPermission.granted) {
      throw new Error('Camera permission not granted');
    }

    // Check if already active or initializing
    if (camera.isActive || camera.isInitializing) {
      // Return existing stream if already active
      if (camera.stream) {
        return camera.stream;
      }
      throw new Error('Camera is initializing');
    }

    dispatch({ type: 'STREAM_START' });

    try {
      // Stop any existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      // Create optimized constraints using camera config from state
      const constraints = optimizeConstraints(camera.config, capabilitiesRef.current ?? undefined);

      // Start new stream with optimized settings
      const stream = await navigator.mediaDevices.getUserMedia({
        video: constraints,
        audio: false, // Audio not needed for pose detection
      });

      // Verify stream meets our requirements
      const videoTrack = stream.getVideoTracks()[0];
      const settings = videoTrack.getSettings();

      // Report camera settings for monitoring
      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.info('Camera stream started successfully', {
          requested: camera.config,
          actual: settings,
          type: 'camera_settings',
        });
      }

      streamRef.current = stream;

      dispatch({ type: 'STREAM_SUCCESS', stream });

      onEvents.streamStarted?.(stream);

      // Return the stream directly for immediate use
      return stream;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start camera';

      dispatch({ type: 'STREAM_ERROR', error: errorMessage });

      onEvents.error?.(errorMessage);
      throw error;
    }
  }, [checkPermissions, camera.config, camera.isActive, camera.isInitializing, onEvents, camera.stream]);

  /**
   * Stop camera stream and clean up resources
   */
  const stop = useCallback((): void => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    dispatch({ type: 'STREAM_STOP' });

    onEvents.streamStopped?.();
  }, [onEvents]);

  /**
   * Switch between front and rear camera
   */
  const switchCamera = useCallback(async (): Promise<void> => {
    const newFacingMode = camera.config.facingMode === 'user' ? 'environment' : 'user';

    dispatch({
      type: 'CONFIG_UPDATE',
      config: { facingMode: newFacingMode },
    });

    // Restart stream with new facing mode if currently active
    if (camera.isActive) {
      stop();
      await start();
    }
  }, [camera.config.facingMode, camera.isActive, stop, start]);

  /**
   * Update camera configuration and restart stream if active.
   * Validates the new configuration before applying it.
   */
  const updateConfig = useCallback(
    async (newConfig: Partial<CameraConfig>): Promise<void> => {
      // Validate the new configuration using Zod directly
      const validation = partialCameraConfigSchema.safeParse(newConfig);

      if (!validation.success) {
        const errors = validation.error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }));

        const errorMessage = errors.map((e) => `${e.field}: ${e.message}`).join(', ');

        // Report validation error
        errorMonitor.reportError(`Invalid camera configuration: ${errorMessage}`, 'custom', 'medium', {
          providedConfig: newConfig,
          errors,
          type: 'config_validation_error',
        });

        // Throw error to prevent invalid config from being applied
        throw new Error(errorMessage);
      }

      // Apply validated configuration
      dispatch({ type: 'CONFIG_UPDATE', config: validation.data });

      // Restart stream with new configuration if currently active
      if (camera.isActive) {
        stop();
        await start();
      }
    },
    [camera.isActive, stop, start],
  );

  // Auto-start camera on mount if requested
  useEffect(() => {
    if (autoStart) {
      initialize()
        .then(() => start())
        .catch((error) => {
          errorMonitor.reportError(
            `Camera auto-start failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            'custom',
            'high',
            { autoStart: true, error: error instanceof Error ? error.message : String(error) },
          );
        });
    }
  }, [autoStart, initialize, start]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Handle page visibility changes to manage camera resources
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && camera.isActive) {
        // Pause camera when tab is hidden to save resources
        try {
          stop();
        } catch (error) {
          errorMonitor.reportError(
            `Failed to stop camera on visibility change: ${error instanceof Error ? error.message : 'Unknown error'}`,
            'custom',
            'medium',
            { visibilityChange: true, error: error instanceof Error ? error.message : String(error) },
          );
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [camera.isActive, stop]);

  // Memoize return object to prevent infinite re-renders in dependent hooks
  return useMemo(
    () => ({
      camera,
      initialize,
      start,
      stop,
      switchCamera,
      updateConfig,
      checkPermissions,
      requestPermissions,
    }),
    [camera, initialize, start, stop, switchCamera, updateConfig, checkPermissions, requestPermissions],
  );
}
