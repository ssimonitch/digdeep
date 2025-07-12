/**
 * Permission Service Tests
 *
 * Tests for camera permission handling and error state management
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PermissionErrorType } from '../types';
import { PermissionService } from './PermissionService';

// Create mock function reference using vi.hoisted
const mockErrorMonitorReportError = vi.hoisted(() => vi.fn());

// Mock the error monitor service
vi.mock('@/shared/services/error-monitor.service', () => ({
  errorMonitor: {
    reportError: mockErrorMonitorReportError,
  },
}));

// Mock MediaDevices API
const mockGetUserMedia = vi.fn();
const mockEnumerateDevices = vi.fn();
const mockPermissionsQuery = vi.fn();

// Mock permissions API
const mockPermissionStatus = {
  state: 'prompt',
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};

// Setup global mocks
Object.defineProperty(global, 'navigator', {
  value: {
    mediaDevices: {
      getUserMedia: mockGetUserMedia,
      enumerateDevices: mockEnumerateDevices,
    },
    permissions: {
      query: mockPermissionsQuery,
    },
    userAgent: 'Mozilla/5.0 (Chrome)',
  },
  writable: true,
});

Object.defineProperty(global, 'window', {
  value: {
    isSecureContext: true,
  },
  writable: true,
});

Object.defineProperty(global, 'location', {
  value: {
    protocol: 'https:',
    hostname: 'localhost',
  },
  writable: true,
});

describe('PermissionService', () => {
  let permissionService: PermissionService;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    mockGetUserMedia.mockClear();
    mockEnumerateDevices.mockClear();
    mockPermissionsQuery.mockClear();
    mockErrorMonitorReportError.mockClear();

    // Restore global mocks after clearing
    Object.defineProperty(global, 'navigator', {
      value: {
        mediaDevices: {
          getUserMedia: mockGetUserMedia,
          enumerateDevices: mockEnumerateDevices,
        },
        permissions: {
          query: mockPermissionsQuery,
        },
        userAgent: 'Mozilla/5.0 (Chrome)',
      },
      writable: true,
    });

    Object.defineProperty(global, 'window', {
      value: {
        isSecureContext: true,
      },
      writable: true,
    });

    Object.defineProperty(global, 'location', {
      value: {
        protocol: 'https:',
        hostname: 'localhost',
      },
      writable: true,
    });

    // Create new instance for each test
    permissionService = new PermissionService();
  });

  afterEach(() => {
    permissionService.cleanup();
  });

  describe('Browser Capability Detection', () => {
    it('should detect secure context correctly', () => {
      const status = permissionService.getPermissionStatus();
      expect(status.browserSupport.permissions).toBeDefined();
      expect(status.browserSupport.mediaDevices).toBeDefined();
      expect(status.browserSupport.getUserMedia).toBeDefined();
    });

    it('should handle insecure context', () => {
      // Mock insecure context
      Object.defineProperty(global, 'window', {
        value: { isSecureContext: false },
        writable: true,
      });
      Object.defineProperty(global, 'location', {
        value: { protocol: 'http:', hostname: 'example.com' },
        writable: true,
      });

      const insecureService = new PermissionService();
      expect(insecureService.canRequestPermission()).toBe(false);
      insecureService.cleanup();
    });

    it('should handle missing MediaDevices API', () => {
      // Mock missing MediaDevices
      Object.defineProperty(global, 'navigator', {
        value: {
          userAgent: 'Mozilla/5.0 (Chrome)',
        },
        writable: true,
      });

      const limitedService = new PermissionService();
      const status = limitedService.getPermissionStatus();
      expect(status.browserSupport.mediaDevices).toBe(false);
      limitedService.cleanup();
    });
  });

  describe('Permission Status Checking', () => {
    it('should check permission status using Permissions API', async () => {
      mockPermissionsQuery.mockResolvedValue({
        ...mockPermissionStatus,
        state: 'granted',
      });

      const status = await permissionService.checkPermissionStatus();

      expect(mockPermissionsQuery).toHaveBeenCalledWith({ name: 'camera' });
      expect(status.state).toBe('granted');
      expect(status.error).toBeUndefined();
    });

    it('should fall back to device enumeration when Permissions API unavailable', async () => {
      // Mock no Permissions API
      Object.defineProperty(global, 'navigator', {
        value: {
          mediaDevices: {
            getUserMedia: mockGetUserMedia,
            enumerateDevices: mockEnumerateDevices,
          },
          userAgent: 'Mozilla/5.0 (Chrome)',
        },
        writable: true,
      });

      mockEnumerateDevices.mockResolvedValue([
        { kind: 'videoinput', deviceId: 'camera1', label: 'Camera 1', groupId: 'group1' },
      ]);

      const fallbackService = new PermissionService();
      const status = await fallbackService.checkPermissionStatus();

      expect(mockEnumerateDevices).toHaveBeenCalled();
      expect(status.state).toBe('prompt');
      fallbackService.cleanup();
    });

    it('should handle no camera devices found', async () => {
      mockEnumerateDevices.mockResolvedValue([
        { kind: 'audioinput', deviceId: 'mic1', label: 'Microphone 1', groupId: 'group1' },
      ]);

      // Mock no Permissions API
      Object.defineProperty(global, 'navigator', {
        value: {
          mediaDevices: {
            getUserMedia: mockGetUserMedia,
            enumerateDevices: mockEnumerateDevices,
          },
          userAgent: 'Mozilla/5.0 (Chrome)',
        },
        writable: true,
      });

      const noDeviceService = new PermissionService();
      const status = await noDeviceService.checkPermissionStatus();

      expect(status.state).toBe('denied');
      expect(status.error?.type).toBe('device_not_found');
      noDeviceService.cleanup();
    });
  });

  describe('Permission Requesting', () => {
    it('should request camera permission successfully', async () => {
      const mockStream = {
        getTracks: () => [{ stop: vi.fn() }],
      };
      mockGetUserMedia.mockResolvedValue(mockStream);

      const status = await permissionService.requestPermission();

      expect(mockGetUserMedia).toHaveBeenCalledWith({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      expect(status.state).toBe('granted');
      expect(status.error).toBeUndefined();
    });

    it('should handle permission denied error', async () => {
      const deniedError = new Error('Permission denied');
      deniedError.name = 'NotAllowedError';
      mockGetUserMedia.mockRejectedValue(deniedError);

      const status = await permissionService.requestPermission();

      expect(status.state).toBe('denied');
      expect(status.error?.type).toBe('permission_denied');
      expect(status.error?.canRetry).toBe(true);
    });

    it('should handle device not found error', async () => {
      const notFoundError = new Error('Device not found');
      notFoundError.name = 'NotFoundError';
      mockGetUserMedia.mockRejectedValue(notFoundError);

      const status = await permissionService.requestPermission();

      expect(status.state).toBe('denied');
      expect(status.error?.type).toBe('device_not_found');
      expect(status.error?.canRetry).toBe(true);
    });

    it('should handle device already in use error', async () => {
      const inUseError = new Error('Device already in use');
      inUseError.name = 'NotReadableError';
      mockGetUserMedia.mockRejectedValue(inUseError);

      const status = await permissionService.requestPermission();

      expect(status.state).toBe('denied');
      expect(status.error?.type).toBe('already_in_use');
      expect(status.error?.canRetry).toBe(true);
    });

    it('should handle security error', async () => {
      const securityError = new Error('Security error');
      securityError.name = 'SecurityError';
      mockGetUserMedia.mockRejectedValue(securityError);

      const status = await permissionService.requestPermission();

      expect(status.state).toBe('denied');
      expect(status.error?.type).toBe('security_error');
      expect(status.error?.canRetry).toBe(true);
    });

    it('should handle browser not supported error', async () => {
      const typeError = new Error('Browser not supported');
      typeError.name = 'TypeError';
      mockGetUserMedia.mockRejectedValue(typeError);

      const status = await permissionService.requestPermission();

      expect(status.state).toBe('denied');
      expect(status.error?.type).toBe('browser_not_supported');
      expect(status.error?.canRetry).toBe(false);
    });

    it('should handle unknown error', async () => {
      const unknownError = new Error('Unknown error');
      unknownError.name = 'UnknownError';
      mockGetUserMedia.mockRejectedValue(unknownError);

      const status = await permissionService.requestPermission();

      expect(status.state).toBe('denied');
      expect(status.error?.type).toBe('unknown_error');
      expect(status.error?.canRetry).toBe(true);
    });
  });

  describe('Permission State Management', () => {
    it('should return cached permission status', () => {
      const status = permissionService.getPermissionStatus();
      expect(status).toBeDefined();
      expect(status.state).toBe('unknown');
      expect(status.lastChecked).toBe(0);
    });

    it('should check if permission is granted', () => {
      expect(permissionService.isPermissionGranted()).toBe(false);

      // Mock granted state
      permissionService.resetPermissionState();
      // We can't directly set the state, so we'll test after a successful request
    });

    it('should check if permission can be requested', () => {
      expect(permissionService.canRequestPermission()).toBe(true);
    });

    it('should reset permission state', () => {
      permissionService.resetPermissionState();
      const status = permissionService.getPermissionStatus();
      expect(status.state).toBe('unknown');
      expect(status.lastChecked).toBe(0);
    });
  });

  describe('Permission Change Monitoring', () => {
    it('should register permission change callbacks', () => {
      const callback = vi.fn();
      const unsubscribe = permissionService.onPermissionChange(callback);

      expect(typeof unsubscribe).toBe('function');

      // Test unsubscribe
      unsubscribe();
      expect(callback).not.toHaveBeenCalled();
    });

    it('should handle permission change events', async () => {
      vi.useFakeTimers();
      const callback = vi.fn();
      permissionService.onPermissionChange(callback);

      // Mock permissions API with change event
      mockPermissionsQuery.mockResolvedValue({
        ...mockPermissionStatus,
        state: 'granted',
        addEventListener: vi.fn((event, handler) => {
          if (event === 'change') {
            // Simulate permission change
            setTimeout(() => (handler as () => void)(), 0);
          }
        }),
      });

      await permissionService.checkPermissionStatus();

      // Advance timers to trigger the change event
      await vi.runAllTimersAsync();

      expect(callback).toHaveBeenCalled();
      vi.useRealTimers();
    });
  });

  describe('Browser Instructions', () => {
    it('should return Chrome-specific instructions', () => {
      Object.defineProperty(global, 'navigator', {
        value: {
          ...global.navigator,
          userAgent: 'Mozilla/5.0 (Chrome)',
        },
        writable: true,
      });

      const instructions = permissionService.getBrowserInstructions();
      expect(instructions).toContain('Click the camera icon in the address bar');
      expect(instructions.some((instruction) => instruction.includes('Always allow'))).toBe(true);
    });

    it('should return Firefox-specific instructions', () => {
      Object.defineProperty(global, 'navigator', {
        value: {
          ...global.navigator,
          userAgent: 'Mozilla/5.0 (Firefox)',
        },
        writable: true,
      });

      const firefoxService = new PermissionService();
      const instructions = firefoxService.getBrowserInstructions();
      expect(instructions.some((instruction) => instruction.includes('Remember this decision'))).toBe(true);
      firefoxService.cleanup();
    });

    it('should return Safari-specific instructions', () => {
      Object.defineProperty(global, 'navigator', {
        value: {
          ...global.navigator,
          userAgent: 'Mozilla/5.0 (Safari)',
        },
        writable: true,
      });

      const safariService = new PermissionService();
      const instructions = safariService.getBrowserInstructions();
      expect(instructions.some((instruction) => instruction.includes('Safari → Settings'))).toBe(true);
      safariService.cleanup();
    });

    it('should return generic instructions for unknown browsers', () => {
      Object.defineProperty(global, 'navigator', {
        value: {
          ...global.navigator,
          userAgent: 'Mozilla/5.0 (UnknownBrowser)',
        },
        writable: true,
      });

      const unknownService = new PermissionService();
      const instructions = unknownService.getBrowserInstructions();
      expect(instructions.some((instruction) => instruction.includes('Look for a camera icon'))).toBe(true);
      unknownService.cleanup();
    });
  });

  describe('Error Handling', () => {
    it('should create appropriate error for each error type', () => {
      const testCases: { type: PermissionErrorType; expectedMessage: string }[] = [
        { type: 'permission_denied', expectedMessage: 'Camera access is required' },
        { type: 'browser_not_supported', expectedMessage: "Your browser doesn't support" },
        { type: 'security_error', expectedMessage: 'blocked due to security settings' },
        { type: 'device_not_found', expectedMessage: 'No camera was found' },
        { type: 'already_in_use', expectedMessage: 'currently being used' },
        { type: 'network_error', expectedMessage: 'network error' },
        { type: 'unknown_error', expectedMessage: 'unexpected error' },
      ];

      testCases.forEach(({ type, expectedMessage }) => {
        const error = permissionService.createPermissionError(type);
        expect(error.type).toBe(type);
        expect(error.userMessage.toLowerCase()).toContain(expectedMessage.toLowerCase());
        expect(error.recoveryActions).toBeInstanceOf(Array);
        expect(error.recoveryActions.length).toBeGreaterThan(0);
      });
    });

    it('should handle callback errors gracefully', () => {
      const errorCallback = vi.fn(() => {
        throw new Error('Callback error');
      }) as () => void;

      permissionService.onPermissionChange(errorCallback);

      // Trigger notification
      permissionService.notifyPermissionChange();

      expect(mockErrorMonitorReportError).toHaveBeenCalledWith(
        'Error in permission change callback: Callback error',
        'custom',
        'medium',
        { error: 'Callback error' },
      );
    });
  });

  describe('Cleanup', () => {
    it('should cleanup resources properly', () => {
      const callback = vi.fn();
      permissionService.onPermissionChange(callback);

      permissionService.cleanup();

      // Verify callbacks are cleared
      permissionService.notifyPermissionChange();
      expect(callback).not.toHaveBeenCalled();
    });
  });
});
