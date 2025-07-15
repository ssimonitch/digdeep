/**
 * Camera Test Mocks and Fixtures
 *
 * Shared mocks for browser APIs and test utilities
 */

import { vi } from 'vitest';

import type { CameraConfig, CameraPermission } from '../../../types';

/**
 * Mock MediaStream for testing
 */
export class MockMediaStream implements MediaStream {
  active = true;
  id = 'mock-stream-id';
  onaddtrack: ((this: MediaStream, ev: MediaStreamTrackEvent) => unknown) | null = null;
  onremovetrack: ((this: MediaStream, ev: MediaStreamTrackEvent) => unknown) | null = null;

  private tracks: MediaStreamTrack[] = [];

  constructor(tracks?: MediaStreamTrack[]) {
    this.tracks = tracks ?? [createMockVideoTrack()];
  }

  getTracks(): MediaStreamTrack[] {
    return this.tracks;
  }

  getVideoTracks(): MediaStreamTrack[] {
    return this.tracks.filter((track) => track.kind === 'video');
  }

  getAudioTracks(): MediaStreamTrack[] {
    return this.tracks.filter((track) => track.kind === 'audio');
  }

  getTrackById(trackId: string): MediaStreamTrack | null {
    return this.tracks.find((track) => track.id === trackId) ?? null;
  }

  addTrack(track: MediaStreamTrack): void {
    this.tracks.push(track);
  }

  removeTrack(track: MediaStreamTrack): void {
    this.tracks = this.tracks.filter((t) => t !== track);
  }

  clone(): MediaStream {
    return new MockMediaStream(this.tracks.map((t) => t.clone()));
  }

  addEventListener(): void {
    // Mock implementation
  }

  removeEventListener(): void {
    // Mock implementation
  }

  dispatchEvent(): boolean {
    return true;
  }
}

/**
 * Create a mock video track
 */
export function createMockVideoTrack(): MediaStreamTrack {
  return {
    kind: 'video',
    id: 'mock-video-track',
    label: 'Mock Video Track',
    enabled: true,
    muted: false,
    readyState: 'live',
    onended: null,
    onmute: null,
    onunmute: null,
    contentHint: '',
    isolated: false,
    oncapturehandlechange: null,
    stop: vi.fn(),
    getSettings: vi.fn(() => ({
      width: 1280,
      height: 720,
      frameRate: 30,
      facingMode: 'environment',
      deviceId: 'mock-device-id',
    })),
    getCapabilities: vi.fn(() => ({
      width: { min: 320, max: 1920 },
      height: { min: 240, max: 1080 },
      frameRate: { min: 1, max: 60 },
      facingMode: ['user', 'environment'],
    })),
    getConstraints: vi.fn(() => ({})),
    applyConstraints: vi.fn(),
    clone: vi.fn(function (this: MediaStreamTrack) {
      return { ...this };
    }),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(() => true),
  } as unknown as MediaStreamTrack;
}

/**
 * Mock navigator.mediaDevices
 */
export const mockMediaDevices = {
  getUserMedia: vi.fn(),
  enumerateDevices: vi.fn(),
  getDisplayMedia: vi.fn(),
  getSupportedConstraints: vi.fn(() => ({
    width: true,
    height: true,
    frameRate: true,
    facingMode: true,
    deviceId: true,
  })),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(() => true),
  ondevicechange: null,
};

/**
 * Mock permission status
 */
export const createMockPermissionStatus = (state: PermissionState = 'prompt') => ({
  state,
  onchange: null,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(() => true),
});

/**
 * Mock navigator.permissions
 */
export const mockPermissions = {
  query: vi.fn(),
};

/**
 * Setup browser API mocks
 */
export function setupBrowserMocks() {
  // Ensure navigator exists
  if (!global.navigator) {
    Object.defineProperty(global, 'navigator', {
      value: {},
      writable: true,
      configurable: true,
    });
  }

  // Setup navigator.mediaDevices
  Object.defineProperty(global.navigator, 'mediaDevices', {
    value: mockMediaDevices,
    writable: true,
    configurable: true,
  });

  // Setup navigator.permissions
  Object.defineProperty(global.navigator, 'permissions', {
    value: mockPermissions,
    writable: true,
    configurable: true,
  });

  // Setup default mock implementations
  mockMediaDevices.getUserMedia.mockResolvedValue(new MockMediaStream());
  mockMediaDevices.enumerateDevices.mockResolvedValue([
    {
      deviceId: 'mock-camera-1',
      kind: 'videoinput',
      label: 'Mock Camera 1',
      groupId: 'group-1',
    },
    {
      deviceId: 'mock-camera-2',
      kind: 'videoinput',
      label: 'Mock Camera 2',
      groupId: 'group-2',
    },
  ]);
  mockPermissions.query.mockResolvedValue(createMockPermissionStatus('granted'));
}

/**
 * Reset all browser mocks
 */
export function resetBrowserMocks() {
  mockMediaDevices.getUserMedia.mockReset();
  mockMediaDevices.enumerateDevices.mockReset();
  mockPermissions.query.mockReset();
}

/**
 * Default camera configurations for testing
 */
export const TEST_CAMERA_CONFIGS = {
  valid: {
    width: 1280,
    height: 720,
    frameRate: 30,
    facingMode: 'environment',
    codec: 'video/webm;codecs=vp9',
  } as CameraConfig,

  invalid: {
    width: -100, // Invalid: negative
    height: 5000, // Invalid: exceeds max
    frameRate: 100, // Invalid: exceeds max
    facingMode: 'invalid' as const, // Invalid: not a valid mode
    codec: 'invalid/codec',
  },

  partial: {
    width: 1920,
    frameRate: 60,
  } as Partial<CameraConfig>,
};

/**
 * Default permission states for testing
 */
export const TEST_PERMISSIONS = {
  granted: {
    granted: true,
    pending: false,
    error: undefined,
  } as CameraPermission,

  denied: {
    granted: false,
    pending: false,
    error: 'Camera permission denied',
  } as CameraPermission,

  pending: {
    granted: false,
    pending: true,
    error: undefined,
  } as CameraPermission,
};

/**
 * Mock error monitor
 */
export const mockErrorMonitor = {
  reportError: vi.fn(),
};
