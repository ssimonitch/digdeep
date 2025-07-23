/**
 * Video element test mocks for jsdom compatibility
 * Handles video.srcObject assignments and dimension mocking
 */

interface ExtendedHTMLVideoElement extends HTMLVideoElement {
  _mockSrcObject?: MediaStream | null;
}

/**
 * Setup video element mocks for jsdom compatibility
 * Returns a cleanup function to restore original implementations
 */
export function setupVideoElementMock(): () => void {
  // Store original methods for restoration
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const originalPlay = HTMLVideoElement.prototype.play;
  const originalSrcObject = Object.getOwnPropertyDescriptor(HTMLVideoElement.prototype, 'srcObject');
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const originalGetBoundingClientRect = HTMLVideoElement.prototype.getBoundingClientRect;

  // Override play to return a resolved promise (jsdom default returns undefined)
  HTMLVideoElement.prototype.play = function (this: HTMLVideoElement) {
    return Promise.resolve();
  };

  // Override srcObject to handle MediaStream without causing React DOM errors
  Object.defineProperty(HTMLVideoElement.prototype, 'srcObject', {
    get: function (this: ExtendedHTMLVideoElement) {
      return this._mockSrcObject ?? null;
    },
    set: function (this: ExtendedHTMLVideoElement, stream: MediaStream | null) {
      // Store the stream but don't actually assign it
      // This prevents jsdom from throwing errors when React tries to render
      this._mockSrcObject = stream;

      // When a stream is set, simulate the video element having dimensions
      if (stream) {
        // Trigger loadedmetadata event asynchronously to simulate real behavior
        void Promise.resolve().then(() => {
          this.dispatchEvent(new Event('loadedmetadata'));
        });
      }
    },
    configurable: true,
  });

  // Override getBoundingClientRect to return proper dimensions for testing
  HTMLVideoElement.prototype.getBoundingClientRect = function () {
    // Return test dimensions for video element
    return {
      width: 640,
      height: 480,
      top: 0,
      left: 0,
      right: 640,
      bottom: 480,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    };
  };

  // Return cleanup function
  return () => {
    HTMLVideoElement.prototype.play = originalPlay;
    HTMLVideoElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
    if (originalSrcObject) {
      Object.defineProperty(HTMLVideoElement.prototype, 'srcObject', originalSrcObject);
    }
  };
}

/**
 * Mock video element with configurable dimensions
 * Useful for testing different video sizes
 */
export function createMockVideoElementWithDimensions(dimensions: { width: number; height: number }): () => void {
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const originalGetBoundingClientRect = HTMLVideoElement.prototype.getBoundingClientRect;

  HTMLVideoElement.prototype.getBoundingClientRect = function () {
    return {
      width: dimensions.width,
      height: dimensions.height,
      top: 0,
      left: 0,
      right: dimensions.width,
      bottom: dimensions.height,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    };
  };

  return () => {
    HTMLVideoElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
  };
}
