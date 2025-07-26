/**
 * useVideoElement Hook Tests
 *
 * Comprehensive tests for the video element management hook including:
 * - Hook initialization and return values
 * - Video element creation and configuration
 * - MediaStream initialization
 * - Video playback lifecycle
 * - Resource cleanup on unmount
 * - Error handling scenarios
 * - Video element reuse
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';

import { useVideoElement } from '../useVideoElement';

describe('useVideoElement', () => {
  // Mock HTMLVideoElement methods
  const mockPlay = vi.fn();
  const mockStop = vi.fn();
  const mockGetTracks = vi.fn();

  // Mock MediaStreamTrack
  const mockTrack: Partial<MediaStreamTrack> = {
    stop: mockStop,
    kind: 'video',
    id: 'test-track-id',
    enabled: true,
    readyState: 'live',
  };

  // Mock MediaStream with proper methods
  const createMockStream = () =>
    ({
      getTracks: vi.fn(() => [mockTrack as MediaStreamTrack]),
      id: 'test-stream-id',
      active: true,
    }) as unknown as MediaStream;

  let mockStream: MediaStream;

  // Create a real video element for testing
  let mockVideoElement: HTMLVideoElement;
  let createElementSpy: MockInstance<typeof document.createElement>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create fresh mock stream for each test
    mockStream = createMockStream();

    // Setup default mock behaviors
    mockPlay.mockResolvedValue(undefined);
    mockGetTracks.mockReturnValue([mockTrack]);

    // Store original createElement
    const originalCreateElement = document.createElement.bind(document);

    // Mock document.createElement to return our customized video element
    createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'video') {
        // Create a real video element
        const video = originalCreateElement('video');

        // Mock the play method
        Object.defineProperty(video, 'play', {
          value: mockPlay,
          writable: true,
          configurable: true,
        });

        mockVideoElement = video;
        return video;
      }
      return originalCreateElement(tagName);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should return the expected hook interface', () => {
      const { result } = renderHook(() => useVideoElement());

      expect(result.current).toHaveProperty('videoRef');
      expect(result.current).toHaveProperty('initializeVideo');
      expect(result.current).toHaveProperty('cleanup');

      expect(result.current.videoRef.current).toBeNull();
      expect(typeof result.current.initializeVideo).toBe('function');
      expect(typeof result.current.cleanup).toBe('function');
    });

    it('should not create video element on mount', () => {
      renderHook(() => useVideoElement());

      // renderHook creates a div, but we're checking for video elements
      expect(document.createElement).not.toHaveBeenCalledWith('video');
    });
  });

  describe('Video Initialization', () => {
    it('should create and configure video element with camera-specific settings', async () => {
      const { result } = renderHook(() => useVideoElement());

      await act(async () => {
        const promise = result.current.initializeVideo(mockStream);

        // Trigger loadedmetadata event
        expect(mockVideoElement.onloadedmetadata).toBeTruthy();
        mockVideoElement.onloadedmetadata?.call(mockVideoElement, new Event('loadedmetadata'));

        await promise;
      });

      // Verify video element creation
      expect(document.createElement).toHaveBeenCalledWith('video');

      // Verify camera-specific settings
      expect(mockVideoElement.playsInline).toBe(true);
      expect(mockVideoElement.muted).toBe(true);
      expect(mockVideoElement.autoplay).toBe(true);

      // Verify stream assignment
      expect(mockVideoElement.srcObject).toBe(mockStream);

      // Verify play was called
      expect(mockPlay).toHaveBeenCalled();
    });

    it('should reuse existing video element on subsequent calls', async () => {
      const { result } = renderHook(() => useVideoElement());

      // First initialization
      await act(async () => {
        const promise = result.current.initializeVideo(mockStream);
        mockVideoElement.onloadedmetadata?.call(mockVideoElement, new Event('loadedmetadata'));
        await promise;
      });

      // One call for video element (plus renderHook's div)
      expect(document.createElement).toHaveBeenCalledWith('video');
      const videoCreateCalls = createElementSpy.mock.calls.filter(([tagName]) => tagName === 'video');
      expect(videoCreateCalls).toHaveLength(1);

      // Second initialization with new stream
      const newStream = createMockStream();

      await act(async () => {
        const promise = result.current.initializeVideo(newStream);
        mockVideoElement.onloadedmetadata?.call(mockVideoElement, new Event('loadedmetadata'));
        await promise;
      });

      // Should not create new element
      const videoCreateCallsAfter = createElementSpy.mock.calls.filter(([tagName]) => tagName === 'video');
      expect(videoCreateCallsAfter).toHaveLength(1);

      // Should update stream
      expect(mockVideoElement.srcObject).toBe(newStream);
    });

    it('should wait for video to be ready before resolving', async () => {
      const { result } = renderHook(() => useVideoElement());

      let resolved = false;

      act(() => {
        void result.current.initializeVideo(mockStream).then(() => {
          resolved = true;
        });
      });

      // Should not resolve immediately
      expect(resolved).toBe(false);

      // Trigger loadedmetadata event
      act(() => {
        mockVideoElement.onloadedmetadata?.call(mockVideoElement, new Event('loadedmetadata'));
      });

      await waitFor(() => {
        expect(resolved).toBe(true);
      });
    });

    it('should handle video play error', async () => {
      const playError = new Error('Play failed');
      mockPlay.mockRejectedValueOnce(playError);

      const { result } = renderHook(() => useVideoElement());

      await expect(async () => {
        await act(async () => {
          const promise = result.current.initializeVideo(mockStream);
          mockVideoElement.onloadedmetadata?.call(mockVideoElement, new Event('loadedmetadata'));
          await promise;
        });
      }).rejects.toThrow('Play failed');
    });

    it('should handle video load error', async () => {
      const { result } = renderHook(() => useVideoElement());

      await expect(async () => {
        await act(async () => {
          const promise = result.current.initializeVideo(mockStream);
          mockVideoElement.onerror?.call(mockVideoElement, new Event('error'));
          await promise;
        });
      }).rejects.toThrow('Video load failed');
    });

    it('should return the video element on successful initialization', async () => {
      const { result } = renderHook(() => useVideoElement());

      let video: HTMLVideoElement | undefined;

      await act(async () => {
        const promise = result.current.initializeVideo(mockStream);
        mockVideoElement.onloadedmetadata?.call(mockVideoElement, new Event('loadedmetadata'));
        video = await promise;
      });

      expect(video).toBe(mockVideoElement);
      expect(result.current.videoRef.current).toBe(mockVideoElement);
    });
  });

  describe('Cleanup', () => {
    it('should stop all tracks and clear srcObject on cleanup', async () => {
      const { result } = renderHook(() => useVideoElement());

      // Initialize video first
      await act(async () => {
        const promise = result.current.initializeVideo(mockStream);
        mockVideoElement.onloadedmetadata?.call(mockVideoElement, new Event('loadedmetadata'));
        await promise;
      });

      // Perform cleanup
      act(() => {
        result.current.cleanup();
      });

      // Verify tracks were stopped
      expect(mockStream.getTracks).toHaveBeenCalled();
      expect(mockStop).toHaveBeenCalled();

      // Verify srcObject was cleared
      expect(mockVideoElement.srcObject).toBeNull();
    });

    it('should handle cleanup when no video element exists', () => {
      const { result } = renderHook(() => useVideoElement());

      // Should not throw
      expect(() => {
        act(() => {
          result.current.cleanup();
        });
      }).not.toThrow();
    });

    it('should handle cleanup when video element has no stream', () => {
      const { result } = renderHook(() => useVideoElement());

      // Create video element without stream
      act(() => {
        // Access videoRef to trigger element creation
        result.current.videoRef.current = document.createElement('video');
      });

      // Should not throw
      expect(() => {
        act(() => {
          result.current.cleanup();
        });
      }).not.toThrow();

      expect(mockGetTracks).not.toHaveBeenCalled();
    });

    it('should cleanup on unmount', async () => {
      const { result, unmount } = renderHook(() => useVideoElement());

      // Initialize video
      await act(async () => {
        const promise = result.current.initializeVideo(mockStream);
        mockVideoElement.onloadedmetadata?.call(mockVideoElement, new Event('loadedmetadata'));
        await promise;
      });

      // Unmount hook
      unmount();

      // Verify cleanup was called
      expect(mockStream.getTracks).toHaveBeenCalled();
      expect(mockStop).toHaveBeenCalled();
      expect(mockVideoElement.srcObject).toBeNull();
    });

    it('should handle multiple tracks during cleanup', async () => {
      const mockTrack2 = {
        ...mockTrack,
        id: 'test-track-id-2',
        stop: vi.fn(),
      };

      // Create stream with multiple tracks
      const multiTrackStream = {
        getTracks: vi.fn(() => [mockTrack, mockTrack2]),
        id: 'multi-track-stream-id',
        active: true,
      } as unknown as MediaStream;

      const { result } = renderHook(() => useVideoElement());

      // Initialize video
      await act(async () => {
        const promise = result.current.initializeVideo(multiTrackStream);
        mockVideoElement.onloadedmetadata?.call(mockVideoElement, new Event('loadedmetadata'));
        await promise;
      });

      // Cleanup
      act(() => {
        result.current.cleanup();
      });

      // Verify all tracks were stopped
      expect(multiTrackStream.getTracks).toHaveBeenCalled();
      expect(mockTrack.stop).toHaveBeenCalled();
      expect(mockTrack2.stop).toHaveBeenCalled();
    });
  });

  describe('Callback Stability', () => {
    it('should maintain stable initializeVideo callback reference', () => {
      const { result, rerender } = renderHook(() => useVideoElement());

      const callback1 = result.current.initializeVideo;

      rerender();

      const callback2 = result.current.initializeVideo;

      expect(callback1).toBe(callback2);
    });

    it('should maintain stable cleanup callback reference', () => {
      const { result, rerender } = renderHook(() => useVideoElement());

      const callback1 = result.current.cleanup;

      rerender();

      const callback2 = result.current.cleanup;

      expect(callback1).toBe(callback2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle stream with no tracks', async () => {
      // Create stream with no tracks
      const emptyStream = {
        getTracks: vi.fn(() => []),
        id: 'empty-stream-id',
        active: true,
      } as unknown as MediaStream;

      const { result } = renderHook(() => useVideoElement());

      // Initialize video
      await act(async () => {
        const promise = result.current.initializeVideo(emptyStream);
        mockVideoElement.onloadedmetadata?.call(mockVideoElement, new Event('loadedmetadata'));
        await promise;
      });

      // Cleanup should not throw
      act(() => {
        result.current.cleanup();
      });

      expect(emptyStream.getTracks).toHaveBeenCalled();
      expect(mockStop).not.toHaveBeenCalled();
    });

    it('should handle rapid initialization calls', async () => {
      const { result } = renderHook(() => useVideoElement());

      const stream1 = createMockStream();
      const stream2 = createMockStream();

      // Start two initializations rapidly
      const promise1 = result.current.initializeVideo(stream1);
      const promise2 = result.current.initializeVideo(stream2);

      // Both should use the same video element
      const videoCreateCalls = createElementSpy.mock.calls.filter(([tagName]) => tagName === 'video');
      expect(videoCreateCalls).toHaveLength(1);

      // Last stream should be set immediately
      expect(mockVideoElement.srcObject).toBe(stream2);

      // Trigger loadedmetadata to resolve both promises
      act(() => {
        mockVideoElement.onloadedmetadata?.call(mockVideoElement, new Event('loadedmetadata'));
      });

      // Wait for both initialization promises
      const [video1, video2] = await Promise.all([promise1, promise2]);

      // Both should return the same video element
      expect(video1).toBe(mockVideoElement);
      expect(video2).toBe(mockVideoElement);
    }, 10000); // Increase timeout to 10 seconds
  });
});
