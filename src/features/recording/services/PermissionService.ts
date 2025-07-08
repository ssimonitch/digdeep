/**
 * Camera Permission Service
 *
 * Handles camera permission state checking, requesting, and monitoring
 * with browser-specific implementations and user-friendly error recovery.
 */

import { errorMonitor } from '@/shared/services/error-monitor.service';

/**
 * Permission states for camera access
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
 * Browser capability detection
 */
interface BrowserCapabilities {
  permissions: boolean;
  mediaDevices: boolean;
  getUserMedia: boolean;
  isSecureContext: boolean;
}

/**
 * Permission service for camera access management
 */
export class PermissionService {
  private permissionStatus: PermissionStatus;
  private changeCallbacks = new Set<PermissionChangeCallback>();
  private permissionMonitor: PermissionStatus | null = null;
  private browserCapabilities: BrowserCapabilities;

  constructor() {
    this.browserCapabilities = this.detectBrowserCapabilities();
    this.permissionStatus = {
      state: 'unknown',
      lastChecked: 0,
      browserSupport: {
        permissions: this.browserCapabilities.permissions,
        mediaDevices: this.browserCapabilities.mediaDevices,
        getUserMedia: this.browserCapabilities.getUserMedia,
      },
    };
  }

  /**
   * Detect browser capabilities for camera permissions
   */
  private detectBrowserCapabilities(): BrowserCapabilities {
    const capabilities = {
      permissions: false,
      mediaDevices: false,
      getUserMedia: false,
      isSecureContext: false,
    };

    // Check for secure context (HTTPS or localhost)
    capabilities.isSecureContext =
      window.isSecureContext ||
      location.protocol === 'https:' ||
      location.hostname === 'localhost' ||
      location.hostname === '127.0.0.1';

    // Check for Permissions API support
    capabilities.permissions = 'permissions' in navigator && 'query' in navigator.permissions;

    // Check for Media Devices API support
    capabilities.mediaDevices = 'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices;

    // Check for legacy getUserMedia support
    capabilities.getUserMedia =
      capabilities.mediaDevices ||
      'getUserMedia' in navigator ||
      'webkitGetUserMedia' in navigator ||
      'mozGetUserMedia' in navigator;

    return capabilities;
  }

  /**
   * Create permission error with user-friendly messaging
   */
  public createPermissionError(type: PermissionErrorType, originalError?: Error): PermissionError {
    const errorMap: Record<PermissionErrorType, Omit<PermissionError, 'type'>> = {
      permission_denied: {
        message: 'Camera permission denied by user',
        userMessage:
          'Camera access is required to record your workouts. Please enable camera permissions in your browser settings.',
        recoveryActions: [
          "Click the camera icon in your browser's address bar",
          'Select "Allow" for camera permissions',
          'Refresh the page and try again',
        ],
        canRetry: true,
      },
      browser_not_supported: {
        message: 'Browser does not support camera access',
        userMessage:
          "Your browser doesn't support camera access. Please use a modern browser like Chrome, Firefox, or Safari.",
        recoveryActions: [
          'Update your browser to the latest version',
          'Try using Chrome, Firefox, or Safari',
          "Ensure you're using HTTPS (not HTTP)",
        ],
        canRetry: false,
      },
      security_error: {
        message: 'Security error accessing camera',
        userMessage: "Camera access is blocked due to security settings. Make sure you're using HTTPS.",
        recoveryActions: [
          'Ensure the website is using HTTPS',
          "Check your browser's security settings",
          'Try using a different browser',
        ],
        canRetry: true,
      },
      device_not_found: {
        message: 'No camera device found',
        userMessage: 'No camera was found on your device. Please connect a camera and try again.',
        recoveryActions: [
          'Check that your camera is properly connected',
          'Try using a different camera',
          'Restart your browser and try again',
        ],
        canRetry: true,
      },
      already_in_use: {
        message: 'Camera is already in use',
        userMessage:
          'Your camera is currently being used by another application. Please close other apps and try again.',
        recoveryActions: [
          'Close other applications using your camera',
          'Restart your browser',
          'Try using a different camera if available',
        ],
        canRetry: true,
      },
      network_error: {
        message: 'Network error accessing camera',
        userMessage: 'There was a network error accessing your camera. Please check your connection and try again.',
        recoveryActions: [
          'Check your internet connection',
          'Refresh the page and try again',
          'Try using a different network',
        ],
        canRetry: true,
      },
      unknown_error: {
        message: originalError?.message ?? 'Unknown error accessing camera',
        userMessage: 'An unexpected error occurred while accessing your camera. Please try again.',
        recoveryActions: [
          'Refresh the page and try again',
          'Try using a different browser',
          'Check your camera and browser settings',
        ],
        canRetry: true,
      },
    };

    return {
      type,
      ...errorMap[type],
    };
  }

  /**
   * Check current permission status
   */
  public async checkPermissionStatus(): Promise<PermissionStatus> {
    if (!this.browserCapabilities.isSecureContext) {
      this.permissionStatus = {
        state: 'denied',
        error: this.createPermissionError('security_error'),
        lastChecked: Date.now(),
        browserSupport: this.permissionStatus.browserSupport,
      };
      return this.permissionStatus;
    }

    if (!this.browserCapabilities.getUserMedia) {
      this.permissionStatus = {
        state: 'denied',
        error: this.createPermissionError('browser_not_supported'),
        lastChecked: Date.now(),
        browserSupport: this.permissionStatus.browserSupport,
      };
      return this.permissionStatus;
    }

    try {
      // Use Permissions API if available
      if (this.browserCapabilities.permissions) {
        const permissionStatus = await navigator.permissions.query({ name: 'camera' as PermissionName });
        this.permissionStatus = {
          state: permissionStatus.state as PermissionState,
          lastChecked: Date.now(),
          browserSupport: this.permissionStatus.browserSupport,
        };

        // Monitor permission changes
        if (!this.permissionMonitor) {
          this.permissionMonitor = this.permissionStatus;
          permissionStatus.addEventListener('change', () => {
            void this.handlePermissionChange();
          });
        }
      } else {
        // Fallback for browsers without Permissions API
        // Try to enumerate devices to check permission
        const devices = await navigator.mediaDevices.enumerateDevices();
        const hasCamera = devices.some((device) => device.kind === 'videoinput');

        if (!hasCamera) {
          this.permissionStatus = {
            state: 'denied',
            error: this.createPermissionError('device_not_found'),
            lastChecked: Date.now(),
            browserSupport: this.permissionStatus.browserSupport,
          };
        } else {
          // Can't determine exact state without Permissions API
          this.permissionStatus = {
            state: 'prompt',
            lastChecked: Date.now(),
            browserSupport: this.permissionStatus.browserSupport,
          };
        }
      }
    } catch (error) {
      this.permissionStatus = {
        state: 'denied',
        error: this.createPermissionError('unknown_error', error as Error),
        lastChecked: Date.now(),
        browserSupport: this.permissionStatus.browserSupport,
      };
    }

    return this.permissionStatus;
  }

  /**
   * Request camera permission from user
   */
  public async requestPermission(): Promise<PermissionStatus> {
    if (!this.browserCapabilities.isSecureContext) {
      return this.checkPermissionStatus();
    }

    try {
      // Request camera access to trigger permission prompt
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Default to rear camera for gym use
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      // Success - permission granted
      this.permissionStatus = {
        state: 'granted',
        lastChecked: Date.now(),
        browserSupport: this.permissionStatus.browserSupport,
      };

      // Clean up test stream
      stream.getTracks().forEach((track) => track.stop());

      this.notifyPermissionChange();
      return this.permissionStatus;
    } catch (error) {
      const err = error as Error;
      let permissionError: PermissionError;

      // Map specific error types
      if (err.name === 'NotAllowedError') {
        permissionError = this.createPermissionError('permission_denied');
      } else if (err.name === 'NotFoundError') {
        permissionError = this.createPermissionError('device_not_found');
      } else if (err.name === 'NotReadableError') {
        permissionError = this.createPermissionError('already_in_use');
      } else if (err.name === 'SecurityError') {
        permissionError = this.createPermissionError('security_error');
      } else if (err.name === 'TypeError') {
        permissionError = this.createPermissionError('browser_not_supported');
      } else {
        permissionError = this.createPermissionError('unknown_error', err);
      }

      this.permissionStatus = {
        state: 'denied',
        error: permissionError,
        lastChecked: Date.now(),
        browserSupport: this.permissionStatus.browserSupport,
      };

      this.notifyPermissionChange();
      return this.permissionStatus;
    }
  }

  /**
   * Get current permission status (cached)
   */
  public getPermissionStatus(): PermissionStatus {
    return this.permissionStatus;
  }

  /**
   * Check if camera permission is granted
   */
  public isPermissionGranted(): boolean {
    return this.permissionStatus.state === 'granted';
  }

  /**
   * Check if permission can be requested
   */
  public canRequestPermission(): boolean {
    return (
      this.browserCapabilities.isSecureContext &&
      this.browserCapabilities.getUserMedia &&
      this.permissionStatus.state !== 'denied'
    );
  }

  /**
   * Register callback for permission changes
   */
  public onPermissionChange(callback: PermissionChangeCallback): () => void {
    this.changeCallbacks.add(callback);

    // Return unsubscribe function
    return () => {
      this.changeCallbacks.delete(callback);
    };
  }

  /**
   * Handle permission state changes
   */
  private async handlePermissionChange(): Promise<void> {
    await this.checkPermissionStatus();
    this.notifyPermissionChange();
  }

  /**
   * Notify all registered callbacks of permission changes
   */
  public notifyPermissionChange(): void {
    this.changeCallbacks.forEach((callback) => {
      try {
        callback(this.permissionStatus);
      } catch (error) {
        errorMonitor.reportError(
          `Error in permission change callback: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'custom',
          'medium',
          { error: error instanceof Error ? error.message : String(error) },
        );
      }
    });
  }

  /**
   * Get browser-specific instructions for enabling camera
   */
  public getBrowserInstructions(): string[] {
    const userAgent = navigator.userAgent.toLowerCase();

    if (userAgent.includes('chrome')) {
      return [
        'Click the camera icon in the address bar',
        'Select "Always allow" for camera access',
        'Refresh the page',
      ];
    } else if (userAgent.includes('firefox')) {
      return [
        'Click the camera icon in the address bar',
        'Select "Allow" and check "Remember this decision"',
        'Refresh the page',
      ];
    } else if (userAgent.includes('safari')) {
      return ['Go to Safari → Settings → Websites → Camera', 'Set this website to "Allow"', 'Refresh the page'];
    } else if (userAgent.includes('edge')) {
      return ['Click the camera icon in the address bar', 'Select "Allow" for camera access', 'Refresh the page'];
    }

    return [
      "Look for a camera icon in your browser's address bar",
      'Select "Allow" for camera access',
      'Refresh the page if needed',
    ];
  }

  /**
   * Reset permission state (for testing)
   */
  public resetPermissionState(): void {
    this.permissionStatus = {
      state: 'unknown',
      lastChecked: 0,
      browserSupport: this.permissionStatus.browserSupport,
    };
  }

  /**
   * Cleanup resources
   */
  public cleanup(): void {
    this.changeCallbacks.clear();
    this.permissionMonitor = null;
  }
}

// Export singleton instance
export const permissionService = new PermissionService();
