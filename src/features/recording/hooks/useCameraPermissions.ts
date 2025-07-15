import { useCallback, useState } from 'react';

import type { CameraPermission } from '../types';

/**
 * Hook return interface for camera permissions
 */
export interface UseCameraPermissionsReturn {
  /** Current permission state */
  permission: CameraPermission;
  /** Check camera permissions without prompting */
  checkPermissions: () => Promise<CameraPermission>;
  /** Request camera permissions from user */
  requestPermissions: (facingMode?: 'user' | 'environment') => Promise<CameraPermission>;
  /** Update permission state manually */
  updatePermission: (permission: CameraPermission) => void;
}

/**
 * Custom hook for managing camera permissions separately from camera stream.
 * This provides reusable permission management that can be used across different
 * components without coupling to the full camera functionality.
 *
 * Benefits:
 * - Separation of concerns: Permission logic isolated from stream management
 * - Reusability: Can be used in permission prompts, settings pages, etc.
 * - Testability: Easier to test permission logic in isolation
 * - Flexibility: Components can check permissions without full camera setup
 *
 * @returns Camera permission state and control functions
 *
 * @example
 * ```typescript
 * const { permission, checkPermissions, requestPermissions } = useCameraPermissions();
 *
 * // Check permissions on mount
 * useEffect(() => {
 *   checkPermissions();
 * }, []);
 *
 * // Request permissions when user clicks button
 * const handleRequestPermission = async () => {
 *   const result = await requestPermissions();
 *   if (result.granted) {
 *     // Proceed with camera usage
 *   }
 * };
 * ```
 */
export function useCameraPermissions(): UseCameraPermissionsReturn {
  const [permission, setPermission] = useState<CameraPermission>({
    granted: false,
    pending: false,
    error: undefined,
  });

  /**
   * Check current camera permissions without requesting.
   * This uses the Permissions API when available, with fallback behavior
   * for browsers that don't support it.
   */
  const checkPermissions = useCallback(async (): Promise<CameraPermission> => {
    // Check for API support
    if (!navigator.mediaDevices || !navigator.permissions) {
      const notSupported: CameraPermission = {
        granted: false,
        pending: false,
        error: 'Camera API not supported in this browser',
      };
      setPermission(notSupported);
      return notSupported;
    }

    try {
      // Try to use Permissions API for non-intrusive check
      const permissionStatus = await navigator.permissions.query({
        name: 'camera' as PermissionName,
      });

      const result: CameraPermission = {
        granted: permissionStatus.state === 'granted',
        pending: permissionStatus.state === 'prompt',
        error: permissionStatus.state === 'denied' ? 'Camera permission denied' : undefined,
      };

      setPermission(result);
      return result;
    } catch {
      // Fallback for browsers that don't support permissions.query
      // We can't know the state without prompting, so assume pending
      const fallback: CameraPermission = {
        granted: false,
        pending: true,
        error: undefined,
      };
      setPermission(fallback);
      return fallback;
    }
  }, []);

  /**
   * Request camera permissions from the user.
   * This will show the browser's permission prompt if needed.
   *
   * @param facingMode - Optional camera facing mode for the permission request
   */
  const requestPermissions = useCallback(
    async (facingMode: 'user' | 'environment' = 'environment'): Promise<CameraPermission> => {
      // Check for API support
      if (!navigator.mediaDevices) {
        const notSupported: CameraPermission = {
          granted: false,
          pending: false,
          error: 'Camera API not supported in this browser',
        };
        setPermission(notSupported);
        return notSupported;
      }

      // Set pending state
      setPermission((prev) => ({
        ...prev,
        pending: true,
        error: undefined,
      }));

      try {
        // Request camera access to trigger permission prompt
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode },
          audio: false,
        });

        // Clean up the test stream immediately
        stream.getTracks().forEach((track) => track.stop());

        // Permission was granted
        const granted: CameraPermission = {
          granted: true,
          pending: false,
          error: undefined,
        };
        setPermission(granted);
        return granted;
      } catch (error) {
        // Permission was denied or error occurred
        const errorMessage = error instanceof Error ? error.message : 'Camera access denied';
        const denied: CameraPermission = {
          granted: false,
          pending: false,
          error: errorMessage,
        };
        setPermission(denied);
        return denied;
      }
    },
    [],
  );

  /**
   * Manually update permission state.
   * Useful for syncing with parent components or resetting state.
   */
  const updatePermission = useCallback((newPermission: CameraPermission) => {
    setPermission(newPermission);
  }, []);

  return {
    permission,
    checkPermissions,
    requestPermissions,
    updatePermission,
  };
}
