/**
 * MediaStream test mocks for jsdom compatibility
 * Provides minimal MediaStream implementation for testing
 */

/**
 * Minimal MediaStream mock for jsdom environments
 * For full-featured MediaStream testing, use MockMediaStream from
 * features/recording/hooks/__tests__/fixtures/camera-mocks.ts
 */
export class MinimalMediaStream implements MediaStream {
  active = true;
  id = 'minimal-stream-' + Math.random().toString(36).substring(7);

  // Required event handlers
  onaddtrack: ((this: MediaStream, ev: MediaStreamTrackEvent) => unknown) | null = null;
  onremovetrack: ((this: MediaStream, ev: MediaStreamTrackEvent) => unknown) | null = null;

  private tracks: MediaStreamTrack[] = [];

  constructor(tracks?: MediaStreamTrack[]) {
    this.tracks = tracks ?? [];
  }

  getTracks(): MediaStreamTrack[] {
    return [...this.tracks];
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
    if (!this.tracks.includes(track)) {
      this.tracks.push(track);
    }
  }

  removeTrack(track: MediaStreamTrack): void {
    const index = this.tracks.indexOf(track);
    if (index !== -1) {
      this.tracks.splice(index, 1);
    }
  }

  clone(): MediaStream {
    // Simple clone - doesn't clone tracks
    return new MinimalMediaStream([...this.tracks]);
  }

  addEventListener(): void {
    // No-op for testing
  }

  removeEventListener(): void {
    // No-op for testing
  }

  dispatchEvent(): boolean {
    return true;
  }
}

/**
 * Setup MediaStream mock globally for jsdom tests
 * Call this in test setup if MediaStream is not defined
 */
export function setupMediaStreamMock(): void {
  if (typeof MediaStream === 'undefined') {
    // @ts-expect-error - Mocking MediaStream for jsdom
    global.MediaStream = MinimalMediaStream;
  }
}

/**
 * Reset MediaStream mock
 * Call this in test cleanup if needed
 */
export function resetMediaStreamMock(): void {
  // Check if MediaStream was mocked by comparing constructor name
  if (global.MediaStream && global.MediaStream.name === 'MinimalMediaStream') {
    // @ts-expect-error - Removing mock
    delete global.MediaStream;
  }
}
