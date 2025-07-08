import { useCallback, useEffect, useRef, useState } from 'react';

import { errorMonitor } from '@/shared/services/error-monitor.service';

import type { CameraConfig, CameraEvents, CameraPermission, CameraStream } from '../types';

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
  start: () => Promise<void>;
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

/**
 * Default camera configuration optimized for 30 FPS performance
 */
const DEFAULT_CAMERA_CONFIG: CameraConfig = {
  width: 1280,
  height: 720,
  frameRate: 30,
  facingMode: 'environment', // Rear camera for squat recording
  codec: 'video/webm;codecs=vp9',
};

/**
 * Camera capability detection utilities
 */
const getCameraCapabilities = async (deviceId?: string): Promise<MediaTrackCapabilities | null> => {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter((device) => device.kind === 'videoinput');

    if (videoDevices.length === 0) return null;

    const targetDevice = deviceId ? videoDevices.find((device) => device.deviceId === deviceId) : videoDevices[0];

    if (!targetDevice) return null;

    const stream = await navigator.mediaDevices.getUserMedia({
      video: { deviceId: targetDevice.deviceId },
    });

    const track = stream.getVideoTracks()[0];
    const capabilities = track.getCapabilities();

    // Clean up test stream
    track.stop();

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
    frameRate: { ideal: config.frameRate, min: 24 },
    facingMode: config.facingMode,
  };

  // Apply capability-based optimizations
  if (capabilities) {
    // Optimize frame rate based on device capabilities
    if (capabilities.frameRate) {
      const maxFrameRate = Math.max(...(capabilities.frameRate.max ? [capabilities.frameRate.max] : [30]));
      constraints.frameRate = {
        ideal: Math.min(config.frameRate, maxFrameRate),
        min: Math.min(24, maxFrameRate),
      };
    }

    // Optimize resolution based on device capabilities
    if (capabilities.width && capabilities.height) {
      const maxWidth = Math.max(...(capabilities.width.max ? [capabilities.width.max] : [1280]));
      const maxHeight = Math.max(...(capabilities.height.max ? [capabilities.height.max] : [720]));

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

  const [camera, setCamera] = useState<CameraStream>({
    stream: null,
    isActive: false,
    isInitializing: false,
    config: { ...DEFAULT_CAMERA_CONFIG, ...defaultConfig },
    permission: {
      granted: false,
      pending: false,
    },
    error: undefined,
  });

  // Store current stream for cleanup
  const streamRef = useRef<MediaStream | null>(null);
  const capabilitiesRef = useRef<MediaTrackCapabilities | null>(null);

  /**
   * Check current camera permissions without requesting
   */
  const checkPermissions = useCallback(async (): Promise<CameraPermission> => {
    if (!navigator.mediaDevices || !navigator.permissions) {
      return {
        granted: false,
        pending: false,
        error: 'Camera API not supported in this browser',
      };
    }

    try {
      const permission = await navigator.permissions.query({ name: 'camera' as PermissionName });

      return {
        granted: permission.state === 'granted',
        pending: permission.state === 'prompt',
        error: permission.state === 'denied' ? 'Camera permission denied' : undefined,
      };
    } catch {
      // Fallback for browsers that don't support permissions query
      return {
        granted: false,
        pending: true,
        error: undefined,
      };
    }
  }, []);

  /**
   * Request camera permissions
   */
  const requestPermissions = useCallback(async (): Promise<CameraPermission> => {
    if (!navigator.mediaDevices) {
      const error = 'Camera API not supported in this browser';
      onEvents.permissionDenied?.(error);
      return { granted: false, pending: false, error };
    }

    setCamera((prev) => ({
      ...prev,
      permission: { ...prev.permission, pending: true },
      error: undefined,
    }));

    try {
      // Request basic camera access to check permissions
      const testStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: camera.config.facingMode },
      });

      // Stop test stream immediately
      testStream.getTracks().forEach((track) => track.stop());

      const permission: CameraPermission = { granted: true, pending: false };

      setCamera((prev) => ({
        ...prev,
        permission,
      }));

      onEvents.permissionGranted?.();
      return permission;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Camera access denied';
      const permission: CameraPermission = {
        granted: false,
        pending: false,
        error: errorMessage,
      };

      setCamera((prev) => ({
        ...prev,
        permission,
        error: errorMessage,
      }));

      onEvents.permissionDenied?.(errorMessage);
      return permission;
    }
  }, [camera.config.facingMode, onEvents]);

  /**
   * Initialize camera with permissions check
   */
  const initialize = useCallback(async (): Promise<void> => {
    setCamera((prev) => ({
      ...prev,
      isInitializing: true,
      error: undefined,
    }));

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
      capabilitiesRef.current = await getCameraCapabilities();

      setCamera((prev) => ({
        ...prev,
        isInitializing: false,
        permission: { granted: true, pending: false },
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Camera initialization failed';

      setCamera((prev) => ({
        ...prev,
        isInitializing: false,
        error: errorMessage,
      }));

      onEvents.error?.(errorMessage);
      throw error;
    }
  }, [checkPermissions, requestPermissions, onEvents]);

  /**
   * Start camera stream with optimized constraints
   */
  const start = useCallback(async (): Promise<void> => {
    if (!camera.permission.granted) {
      throw new Error('Camera permission not granted');
    }

    if (camera.isActive || camera.isInitializing) {
      return;
    }

    setCamera((prev) => ({
      ...prev,
      isInitializing: true,
      error: undefined,
    }));

    try {
      // Stop any existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      // Create optimized constraints
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
      errorMonitor.reportError('Camera stream started successfully', 'custom', 'low', {
        requested: camera.config,
        actual: settings,
        type: 'camera_settings',
      });

      streamRef.current = stream;

      setCamera((prev) => ({
        ...prev,
        stream,
        isActive: true,
        isInitializing: false,
      }));

      onEvents.streamStarted?.(stream);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start camera';

      setCamera((prev) => ({
        ...prev,
        isInitializing: false,
        error: errorMessage,
      }));

      onEvents.error?.(errorMessage);
      throw error;
    }
  }, [camera.permission.granted, camera.isActive, camera.isInitializing, camera.config, onEvents]);

  /**
   * Stop camera stream and clean up resources
   */
  const stop = useCallback((): void => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    setCamera((prev) => ({
      ...prev,
      stream: null,
      isActive: false,
      isInitializing: false,
    }));

    onEvents.streamStopped?.();
  }, [onEvents]);

  /**
   * Switch between front and rear camera
   */
  const switchCamera = useCallback(async (): Promise<void> => {
    if (!camera.isActive) {
      // Just update config if camera is not active
      setCamera((prev) => ({
        ...prev,
        config: {
          ...prev.config,
          facingMode: prev.config.facingMode === 'user' ? 'environment' : 'user',
        },
      }));
      return;
    }

    const newFacingMode = camera.config.facingMode === 'user' ? 'environment' : 'user';

    // Update config
    setCamera((prev) => ({
      ...prev,
      config: {
        ...prev.config,
        facingMode: newFacingMode,
      },
    }));

    // Restart stream with new facing mode
    stop();
    await start();
  }, [camera.isActive, camera.config.facingMode, stop, start]);

  /**
   * Update camera configuration and restart stream if active
   */
  const updateConfig = useCallback(
    async (newConfig: Partial<CameraConfig>): Promise<void> => {
      const updatedConfig = { ...camera.config, ...newConfig };

      setCamera((prev) => ({
        ...prev,
        config: updatedConfig,
      }));

      // Restart stream with new configuration if currently active
      if (camera.isActive) {
        stop();
        await start();
      }
    },
    [camera.config, camera.isActive, stop, start],
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

  return {
    camera,
    initialize,
    start,
    stop,
    switchCamera,
    updateConfig,
    checkPermissions,
    requestPermissions,
  };
}
