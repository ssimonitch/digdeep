/**
 * Frame Capture Service
 *
 * Provides frame extraction from video streams with memory-efficient buffering,
 * frame rate throttling, and comprehensive memory management for the DigDeep
 * powerlifting form analysis application.
 */

/**
 * Frame capture configuration
 */
export interface FrameCaptureConfig {
  /** Target frame rate for capture */
  targetFPS: number;
  /** Maximum frames to buffer */
  maxBufferSize: number;
  /** Frame quality (0-1) */
  quality: number;
  /** Output format for frames */
  format: 'imageData' | 'blob' | 'dataURL';
  /** Whether to enable automatic garbage collection */
  autoGC: boolean;
  /** Memory threshold for triggering cleanup (MB) */
  memoryThreshold: number;
}

/**
 * Captured frame data
 */
export interface CapturedFrame {
  /** Frame timestamp */
  timestamp: number;
  /** Frame sequence number */
  sequenceNumber: number;
  /** Frame data based on format */
  data: ImageData | Blob | string;
  /** Frame dimensions */
  dimensions: {
    width: number;
    height: number;
  };
  /** Frame size in bytes */
  size: number;
  /** Frame quality level */
  quality: number;
}

/**
 * Frame buffer statistics
 */
export interface FrameBufferStats {
  /** Current buffer size */
  currentSize: number;
  /** Maximum buffer size */
  maxSize: number;
  /** Total frames processed */
  totalFrames: number;
  /** Frames dropped due to buffer overflow */
  droppedFrames: number;
  /** Memory usage in MB */
  memoryUsage: number;
  /** Buffer utilization percentage */
  utilization: number;
  /** Average frame size */
  averageFrameSize: number;
  /** Current frame rate */
  currentFPS: number;
}

/**
 * Memory management statistics
 */
export interface MemoryStats {
  /** Current memory usage in MB */
  currentUsage: number;
  /** Peak memory usage in MB */
  peakUsage: number;
  /** Memory threshold in MB */
  threshold: number;
  /** Number of GC cycles performed */
  gcCycles: number;
  /** Last GC timestamp */
  lastGC: number;
  /** Frames cleaned up */
  framesCleanedUp: number;
}

/**
 * Frame capture events
 */
export interface FrameCaptureEvents {
  /** Frame captured successfully */
  frameCapture: (frame: CapturedFrame) => void;
  /** Frame dropped due to buffer overflow */
  frameDropped: (reason: string) => void;
  /** Buffer overflow detected */
  bufferOverflow: (stats: FrameBufferStats) => void;
  /** Memory threshold exceeded */
  memoryThresholdExceeded: (stats: MemoryStats) => void;
  /** Garbage collection performed */
  garbageCollected: (stats: MemoryStats) => void;
  /** Capture error occurred */
  captureError: (error: Error) => void;
}

/**
 * Frame capture service implementation
 */
export class FrameCaptureService {
  private canvas: HTMLCanvasElement | null = null;
  private context: CanvasRenderingContext2D | null = null;
  private frameBuffer: CapturedFrame[] = [];
  private config: FrameCaptureConfig;
  private isCapturing = false;
  private lastCaptureTime = 0;
  private frameSequence = 0;
  private captureInterval: number | null = null;
  private gcInterval: number | null = null;
  private listeners: Partial<FrameCaptureEvents> = {};

  // Performance tracking
  private stats: FrameBufferStats = {
    currentSize: 0,
    maxSize: 0,
    totalFrames: 0,
    droppedFrames: 0,
    memoryUsage: 0,
    utilization: 0,
    averageFrameSize: 0,
    currentFPS: 0,
  };

  private memoryStats: MemoryStats = {
    currentUsage: 0,
    peakUsage: 0,
    threshold: 0,
    gcCycles: 0,
    lastGC: 0,
    framesCleanedUp: 0,
  };

  private frameTimestamps: number[] = [];

  constructor(config: Partial<FrameCaptureConfig> = {}) {
    this.config = {
      targetFPS: 30,
      maxBufferSize: 10,
      quality: 0.8,
      format: 'imageData',
      autoGC: true,
      memoryThreshold: 100, // 100MB
      ...config,
    };

    this.stats.maxSize = this.config.maxBufferSize;
    this.memoryStats.threshold = this.config.memoryThreshold;

    this.initializeCanvas();
    this.setupGarbageCollection();
  }

  /**
   * Initialize canvas for frame capture
   */
  private initializeCanvas(): void {
    this.canvas = document.createElement('canvas');
    this.context = this.canvas.getContext('2d', {
      willReadFrequently: true,
      alpha: false,
    });

    if (!this.context) {
      throw new Error('Failed to initialize canvas context for frame capture');
    }
  }

  /**
   * Setup automatic garbage collection
   */
  private setupGarbageCollection(): void {
    if (this.config.autoGC) {
      this.gcInterval = window.setInterval(() => {
        this.performGarbageCollection();
      }, 5000); // Check every 5 seconds
    }
  }

  /**
   * Start frame capture from video element
   */
  startCapture(videoElement: HTMLVideoElement): void {
    if (this.isCapturing) {
      return;
    }

    this.isCapturing = true;
    this.frameSequence = 0;
    this.lastCaptureTime = 0;
    this.frameTimestamps = [];

    // Setup canvas dimensions
    if (this.canvas && videoElement.videoWidth && videoElement.videoHeight) {
      this.canvas.width = videoElement.videoWidth;
      this.canvas.height = videoElement.videoHeight;
    }

    // Start capture loop
    const captureFrame = () => {
      if (!this.isCapturing) return;

      const now = performance.now();
      const deltaTime = now - this.lastCaptureTime;
      const targetInterval = 1000 / this.config.targetFPS;

      if (deltaTime >= targetInterval) {
        this.captureVideoFrame(videoElement);
        this.lastCaptureTime = now;
      }

      requestAnimationFrame(captureFrame);
    };

    requestAnimationFrame(captureFrame);
  }

  /**
   * Stop frame capture
   */
  stopCapture(): void {
    this.isCapturing = false;
    if (this.captureInterval) {
      clearInterval(this.captureInterval);
      this.captureInterval = null;
    }
  }

  /**
   * Capture frame from video element
   */
  private captureVideoFrame(videoElement: HTMLVideoElement): void {
    if (!this.canvas || !this.context) {
      this.emitError(new Error('Canvas not initialized'));
      return;
    }

    try {
      // Check if buffer is full
      if (this.frameBuffer.length >= this.config.maxBufferSize) {
        this.handleBufferOverflow();
        return;
      }

      // Draw video frame to canvas
      this.context.drawImage(videoElement, 0, 0, this.canvas.width, this.canvas.height);

      // Create frame data based on format
      const frameData = this.createFrameData();
      const frameSize = this.calculateFrameSize(frameData);

      // Create captured frame
      const capturedFrame: CapturedFrame = {
        timestamp: performance.now(),
        sequenceNumber: this.frameSequence++,
        data: frameData,
        dimensions: {
          width: this.canvas.width,
          height: this.canvas.height,
        },
        size: frameSize,
        quality: this.config.quality,
      };

      // Add to buffer
      this.frameBuffer.push(capturedFrame);
      this.updateStats();
      this.updateFPS();

      // Emit frame capture event
      this.listeners.frameCapture?.(capturedFrame);

      // Check memory usage
      this.checkMemoryUsage();
    } catch (error) {
      this.emitError(error as Error);
    }
  }

  /**
   * Create frame data based on configured format
   */
  private createFrameData(): ImageData | Blob | string {
    if (!this.canvas || !this.context) {
      throw new Error('Canvas not initialized');
    }

    switch (this.config.format) {
      case 'imageData':
        return this.context.getImageData(0, 0, this.canvas.width, this.canvas.height);

      case 'blob': {
        // For blob format, we need to handle this synchronously by returning a placeholder
        // This is a limitation of the current architecture - real blob creation is async
        const canvas = this.canvas;
        const quality = this.config.quality;

        // Create a deferred blob that will be resolved later
        const deferredBlob = {
          size: canvas.width * canvas.height * 4, // Estimate size
          type: 'image/jpeg',
          canvas,
          quality,
          async toBlob(): Promise<Blob> {
            return new Promise<Blob>((resolve, reject) => {
              canvas.toBlob(
                (blob) => {
                  if (blob) {
                    resolve(blob);
                  } else {
                    reject(new Error('Failed to create blob from canvas'));
                  }
                },
                'image/jpeg',
                quality,
              );
            });
          },
        };

        // Return the deferred blob object
        return deferredBlob as unknown as Blob;
      }

      case 'dataURL':
        return this.canvas.toDataURL('image/jpeg', this.config.quality);

      default: {
        const _exhaustiveCheck: never = this.config.format;
        throw new Error(`Unsupported frame format: ${String(_exhaustiveCheck)}`);
      }
    }
  }

  /**
   * Calculate frame size in bytes
   */
  private calculateFrameSize(frameData: ImageData | Blob | string): number {
    if (frameData instanceof ImageData) {
      return frameData.data.byteLength;
    } else if (frameData instanceof Blob) {
      return frameData.size;
    } else {
      // Rough estimate for base64 string
      return frameData.length * 0.75; // Base64 is ~33% overhead
    }
  }

  /**
   * Handle buffer overflow
   */
  private handleBufferOverflow(): void {
    // Remove oldest frame
    const removedFrame = this.frameBuffer.shift();
    if (removedFrame) {
      this.stats.droppedFrames++;
      this.listeners.frameDropped?.('Buffer overflow');
    }

    this.listeners.bufferOverflow?.(this.stats);
  }

  /**
   * Update frame capture statistics
   */
  private updateStats(): void {
    this.stats.currentSize = this.frameBuffer.length;
    this.stats.totalFrames++;
    this.stats.utilization = (this.frameBuffer.length / this.config.maxBufferSize) * 100;

    // Update average frame size
    const totalSize = this.frameBuffer.reduce((sum, f) => sum + f.size, 0);
    this.stats.averageFrameSize = this.frameBuffer.length > 0 ? totalSize / this.frameBuffer.length : 0;

    // Update memory usage
    this.stats.memoryUsage = totalSize / (1024 * 1024); // Convert to MB
    this.memoryStats.currentUsage = this.stats.memoryUsage;
    this.memoryStats.peakUsage = Math.max(this.memoryStats.peakUsage, this.stats.memoryUsage);
  }

  /**
   * Update FPS calculation
   */
  private updateFPS(): void {
    const now = performance.now();
    this.frameTimestamps.push(now);

    // Keep only last second of timestamps
    const oneSecondAgo = now - 1000;
    this.frameTimestamps = this.frameTimestamps.filter((t) => t > oneSecondAgo);

    this.stats.currentFPS = this.frameTimestamps.length;
  }

  /**
   * Check memory usage and trigger cleanup if needed
   */
  private checkMemoryUsage(): void {
    if (this.memoryStats.currentUsage > this.config.memoryThreshold) {
      this.listeners.memoryThresholdExceeded?.(this.memoryStats);

      if (this.config.autoGC) {
        this.performGarbageCollection();
      }
    }
  }

  /**
   * Perform garbage collection
   */
  performGarbageCollection(): void {
    const initialSize = this.frameBuffer.length;
    const targetSize = Math.floor(this.config.maxBufferSize * 0.5); // Keep 50% of buffer

    if (initialSize > targetSize) {
      // Remove oldest frames
      const framesToRemove = initialSize - targetSize;
      this.frameBuffer.splice(0, framesToRemove);

      this.memoryStats.gcCycles++;
      this.memoryStats.lastGC = performance.now();
      this.memoryStats.framesCleanedUp += framesToRemove;

      // Update stats
      this.stats.currentSize = this.frameBuffer.length;
      const totalSize = this.frameBuffer.reduce((sum, f) => sum + f.size, 0);
      this.stats.memoryUsage = totalSize / (1024 * 1024);
      this.memoryStats.currentUsage = this.stats.memoryUsage;

      this.listeners.garbageCollected?.(this.memoryStats);
    }
  }

  /**
   * Get current frame capture configuration
   */
  getConfig(): FrameCaptureConfig {
    return { ...this.config };
  }

  /**
   * Get current frame buffer
   */
  getFrameBuffer(): CapturedFrame[] {
    return [...this.frameBuffer];
  }

  /**
   * Get latest frame
   */
  getLatestFrame(): CapturedFrame | null {
    return this.frameBuffer[this.frameBuffer.length - 1] ?? null;
  }

  /**
   * Get frame by sequence number
   */
  getFrameBySequence(sequenceNumber: number): CapturedFrame | null {
    return this.frameBuffer.find((f) => f.sequenceNumber === sequenceNumber) ?? null;
  }

  /**
   * Get buffer statistics
   */
  getStats(): FrameBufferStats {
    return { ...this.stats };
  }

  /**
   * Get memory statistics
   */
  getMemoryStats(): MemoryStats {
    return { ...this.memoryStats };
  }

  /**
   * Clear frame buffer
   */
  clearBuffer(): void {
    this.frameBuffer = [];
    this.stats.currentSize = 0;
    this.stats.memoryUsage = 0;
    this.memoryStats.currentUsage = 0;
  }

  /**
   * Update capture configuration
   */
  updateConfig(newConfig: Partial<FrameCaptureConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.stats.maxSize = this.config.maxBufferSize;
    this.memoryStats.threshold = this.config.memoryThreshold;
  }

  /**
   * Convert frame to MediaPipe format
   */
  convertToMediaPipeFormat(frame: CapturedFrame): ImageData | null {
    if (frame.data instanceof ImageData) {
      return frame.data;
    }

    // For other formats, we need to convert back to ImageData
    // This is a simplified implementation - in practice you might want to cache this
    return null;
  }

  /**
   * Adjust frame quality
   */
  adjustFrameQuality(quality: number): void {
    this.config.quality = Math.max(0, Math.min(1, quality));
  }

  /**
   * Register event listener
   */
  on<K extends keyof FrameCaptureEvents>(event: K, listener: FrameCaptureEvents[K]): void {
    this.listeners[event] = listener;
  }

  /**
   * Unregister event listener
   */
  off<K extends keyof FrameCaptureEvents>(event: K): void {
    delete this.listeners[event];
  }

  /**
   * Emit error event
   */
  private emitError(error: Error): void {
    this.listeners.captureError?.(error);
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.stopCapture();

    if (this.gcInterval) {
      clearInterval(this.gcInterval);
      this.gcInterval = null;
    }

    this.clearBuffer();
    this.listeners = {};

    if (this.canvas) {
      this.canvas.remove();
      this.canvas = null;
      this.context = null;
    }
  }
}

/**
 * Frame format conversion utilities
 */
export class FrameFormatConverter {
  /**
   * Convert ImageData to Blob
   */
  static async imageDataToBlob(imageData: ImageData, quality = 0.8): Promise<Blob> {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Failed to create canvas context');
    }

    canvas.width = imageData.width;
    canvas.height = imageData.height;
    ctx.putImageData(imageData, 0, 0);

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to convert ImageData to Blob'));
          }
        },
        'image/jpeg',
        quality,
      );
    });
  }

  /**
   * Convert Blob to ImageData
   */
  static async blobToImageData(blob: Blob): Promise<ImageData> {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Failed to create canvas context');
    }

    return new Promise((resolve, reject) => {
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        resolve(imageData);
      };

      img.onerror = () => reject(new Error('Failed to load image from blob'));
      img.src = URL.createObjectURL(blob);
    });
  }

  /**
   * Convert ImageData to data URL
   */
  static imageDataToDataURL(imageData: ImageData, quality = 0.8): string {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Failed to create canvas context');
    }

    canvas.width = imageData.width;
    canvas.height = imageData.height;
    ctx.putImageData(imageData, 0, 0);

    return canvas.toDataURL('image/jpeg', quality);
  }

  /**
   * Convert data URL to ImageData
   */
  static async dataURLToImageData(dataURL: string): Promise<ImageData> {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Failed to create canvas context');
    }

    return new Promise((resolve, reject) => {
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        resolve(imageData);
      };

      img.onerror = () => reject(new Error('Failed to load image from data URL'));
      img.src = dataURL;
    });
  }
}
