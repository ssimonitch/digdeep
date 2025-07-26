import { useCallback, useEffect, useRef } from 'react';

/**
 * Simple hook for managing a video element with camera stream
 *
 * Focused on the minimal requirements for pose analysis:
 * - Create video element for camera stream
 * - Initialize with MediaStream
 * - Clean up resources on unmount
 *
 * @example
 * ```typescript
 * const { videoRef, initializeVideo, cleanup } = useVideoElement();
 *
 * // Initialize with camera stream
 * const video = await initializeVideo(cameraStream);
 * ```
 */
export function useVideoElement() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const initializationPromiseRef = useRef<Promise<HTMLVideoElement> | null>(null);

  /**
   * Initialize video element with a MediaStream
   */
  const initializeVideo = useCallback(async (stream: MediaStream): Promise<HTMLVideoElement> => {
    // If initialization is already in progress, return the existing promise
    if (initializationPromiseRef.current) {
      // Update the stream to the latest one
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      return initializationPromiseRef.current;
    }

    // Create video element if it doesn't exist
    if (!videoRef.current) {
      videoRef.current = document.createElement('video');
      // Camera-specific settings
      videoRef.current.playsInline = true;
      videoRef.current.muted = true;
      videoRef.current.autoplay = true;
    }

    const video = videoRef.current;
    video.srcObject = stream;

    // Create and store the initialization promise
    initializationPromiseRef.current = new Promise((resolve, reject) => {
      video.onloadedmetadata = () => {
        video
          .play()
          .then(() => {
            // Clear the promise ref after successful initialization
            initializationPromiseRef.current = null;
            resolve(video);
          })
          .catch((error: Error) => {
            // Clear the promise ref on error
            initializationPromiseRef.current = null;
            reject(error);
          });
      };
      video.onerror = () => {
        // Clear the promise ref on error
        initializationPromiseRef.current = null;
        reject(new Error('Video load failed'));
      };
    });

    return initializationPromiseRef.current;
  }, []);

  /**
   * Clean up video resources
   */
  const cleanup = useCallback(() => {
    if (videoRef.current) {
      // Stop camera tracks if present
      if (videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
      videoRef.current.srcObject = null;
    }
    // Clear any pending initialization promise
    initializationPromiseRef.current = null;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    videoRef,
    initializeVideo,
    cleanup,
  };
}
