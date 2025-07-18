/**
 * Test setup for ActiveAnalysisScreen tests
 * Handles jsdom compatibility issues with video elements and MediaStream
 */

// Mock HTMLVideoElement to prevent jsdom appendChild errors with MediaStream
// jsdom doesn't properly handle video.srcObject = stream assignments
interface ExtendedHTMLVideoElement extends HTMLVideoElement {
  _mockSrcObject?: MediaStream | null;
}

export function setupVideoElementMock() {
  // Store the original play method
  const originalPlay = HTMLVideoElement.prototype.play.bind(HTMLVideoElement.prototype);

  // Override play to return a resolved promise (jsdom default returns undefined)
  HTMLVideoElement.prototype.play = function (this: HTMLVideoElement) {
    return Promise.resolve();
  };

  // Store original properties for restoration
  const originalSrcObject = Object.getOwnPropertyDescriptor(HTMLVideoElement.prototype, 'srcObject');

  // Override srcObject to handle MediaStream without causing React DOM errors
  Object.defineProperty(HTMLVideoElement.prototype, 'srcObject', {
    get: function (this: ExtendedHTMLVideoElement) {
      return this._mockSrcObject ?? null;
    },
    set: function (this: ExtendedHTMLVideoElement, stream: MediaStream | null) {
      // Store the stream but don't actually assign it
      // This prevents jsdom from throwing errors when React tries to render
      this._mockSrcObject = stream;
    },
    configurable: true,
  });

  // Return cleanup function
  return () => {
    HTMLVideoElement.prototype.play = originalPlay;
    if (originalSrcObject) {
      Object.defineProperty(HTMLVideoElement.prototype, 'srcObject', originalSrcObject);
    }
  };
}
