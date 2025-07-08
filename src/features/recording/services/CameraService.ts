/**
 * Camera Service
 *
 * Manages camera configuration and provides utility functions for the camera system.
 * Handles device enumeration, capability detection, configuration validation,
 * and optimal constraint generation for camera devices.
 */

import { errorMonitor } from '@/shared/services/error-monitor.service';

import type {
  CameraCapabilities,
  CameraConfig,
  CameraDevice,
  ConfigValidationResult,
  ResolutionPreset,
} from '../types';

/**
 * Predefined resolution presets for common recording scenarios
 */
const RESOLUTION_PRESETS: ResolutionPreset[] = [
  {
    name: 'hd',
    label: 'HD (720p)',
    width: 1280,
    height: 720,
    aspectRatio: '16:9',
    frameRate: 30,
  },
  {
    name: 'fullhd',
    label: 'Full HD (1080p)',
    width: 1920,
    height: 1080,
    aspectRatio: '16:9',
    frameRate: 30,
  },
  {
    name: '4k',
    label: '4K (2160p)',
    width: 3840,
    height: 2160,
    aspectRatio: '16:9',
    frameRate: 30,
  },
  {
    name: 'vga',
    label: 'VGA (480p)',
    width: 640,
    height: 480,
    aspectRatio: '4:3',
    frameRate: 30,
  },
  {
    name: 'qhd',
    label: 'QHD (1440p)',
    width: 2560,
    height: 1440,
    aspectRatio: '16:9',
    frameRate: 30,
  },
];

/**
 * CameraService class for managing camera devices and configurations
 */
export class CameraService {
  private static instance: CameraService | null = null;
  private deviceCache: CameraDevice[] = [];
  private capabilityCache = new Map<string, CameraCapabilities>();
  private cacheExpiry = 0;
  private readonly CACHE_DURATION = 30000; // 30 seconds

  /**
   * Get singleton instance of CameraService
   */
  public static getInstance(): CameraService {
    CameraService.instance ??= new CameraService();
    return CameraService.instance;
  }

  /**
   * Get list of available camera devices
   * @returns Promise<CameraDevice[]> Array of available camera devices
   */
  public async getAvailableCameras(): Promise<CameraDevice[]> {
    try {
      // Check cache validity
      if (this.deviceCache.length > 0 && Date.now() < this.cacheExpiry) {
        return this.deviceCache;
      }

      // Request permissions first to get device labels
      await navigator.mediaDevices
        .getUserMedia({ video: true })
        .then((stream) => {
          stream.getTracks().forEach((track) => track.stop());
        })
        .catch(() => {
          // Permission denied, we'll get devices without labels
        });

      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameraDevices: CameraDevice[] = devices
        .filter((device) => device.kind === 'videoinput')
        .map((device) => ({
          deviceId: device.deviceId,
          label: device.label || `Camera ${device.deviceId.slice(0, 8)}`,
          groupId: device.groupId,
          kind: 'videoinput' as const,
          facingMode: this.inferFacingMode(device.label),
        }));

      // Update cache
      this.deviceCache = cameraDevices;
      this.cacheExpiry = Date.now() + this.CACHE_DURATION;

      return cameraDevices;
    } catch (error) {
      errorMonitor.reportError(
        `Failed to enumerate camera devices: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'custom',
        'high',
        { error: error instanceof Error ? error.message : String(error) },
      );
      throw new Error('Unable to access camera devices');
    }
  }

  /**
   * Get camera capabilities for a specific device
   * @param deviceId - Device identifier
   * @returns Promise<CameraCapabilities> Camera capabilities
   */
  public async getCameraCapabilities(deviceId: string): Promise<CameraCapabilities> {
    try {
      // Check cache first
      if (this.capabilityCache.has(deviceId)) {
        return this.capabilityCache.get(deviceId)!;
      }

      // Get media track capabilities
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId } },
      });

      const track = stream.getVideoTracks()[0];
      const capabilities = track.getCapabilities();

      // Clean up stream
      track.stop();

      // Parse capabilities
      const cameraCapabilities: CameraCapabilities = {
        deviceId,
        resolutions: this.parseResolutions(capabilities),
        frameRates: this.parseFrameRates(capabilities),
        facingModes: this.parseFacingModes(capabilities),
        maxResolution: {
          width: capabilities.width?.max ?? 1920,
          height: capabilities.height?.max ?? 1080,
        },
        minResolution: {
          width: capabilities.width?.min ?? 320,
          height: capabilities.height?.min ?? 240,
        },
        aspectRatios: this.calculateAspectRatios(this.parseResolutions(capabilities)),
      };

      // Cache capabilities
      this.capabilityCache.set(deviceId, cameraCapabilities);

      return cameraCapabilities;
    } catch (error) {
      errorMonitor.reportError(
        `Failed to get capabilities for device ${deviceId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'custom',
        'high',
        { deviceId, error: error instanceof Error ? error.message : String(error) },
      );
      throw new Error('Unable to determine camera capabilities');
    }
  }

  /**
   * Generate optimal constraints based on configuration and device capabilities
   * @param config - Desired camera configuration
   * @param capabilities - Device capabilities
   * @returns MediaTrackConstraints Optimal constraints for getUserMedia
   */
  public generateOptimalConstraints(config: CameraConfig, capabilities: CameraCapabilities): MediaTrackConstraints {
    const constraints: MediaTrackConstraints = {
      deviceId: config.deviceId ? { exact: config.deviceId } : undefined,
      facingMode: config.facingMode,
    };

    // Find best supported resolution
    const targetResolution = this.findBestResolution(
      { width: config.width, height: config.height },
      capabilities.resolutions,
    );

    if (targetResolution) {
      constraints.width = { ideal: targetResolution.width };
      constraints.height = { ideal: targetResolution.height };
    } else {
      // Fall back to exact constraints if no close match found
      constraints.width = { ideal: config.width, max: capabilities.maxResolution.width };
      constraints.height = { ideal: config.height, max: capabilities.maxResolution.height };
    }

    // Find best supported frame rate
    const targetFrameRate = this.findBestFrameRate(config.frameRate, capabilities.frameRates);
    if (targetFrameRate) {
      constraints.frameRate = { ideal: targetFrameRate };
    }

    return constraints;
  }

  /**
   * Validate camera configuration against device capabilities
   * @param config - Camera configuration to validate
   * @returns Promise<ConfigValidationResult> Validation result
   */
  public async validateConfiguration(config: CameraConfig): Promise<ConfigValidationResult> {
    const result: ConfigValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      suggestions: {},
    };

    try {
      // Check if device ID is specified and exists
      if (config.deviceId) {
        const availableCameras = await this.getAvailableCameras();
        const deviceExists = availableCameras.some((device) => device.deviceId === config.deviceId);

        if (!deviceExists) {
          result.errors.push(`Device with ID ${config.deviceId} not found`);
          result.valid = false;
          return result;
        }

        // Get device capabilities
        const capabilities = await this.getCameraCapabilities(config.deviceId);

        // Validate resolution
        const resolutionSupported = capabilities.resolutions.some(
          (res) => res.width === config.width && res.height === config.height,
        );

        if (!resolutionSupported) {
          const closestResolution = this.findBestResolution(
            { width: config.width, height: config.height },
            capabilities.resolutions,
          );

          if (closestResolution) {
            result.warnings.push(`Exact resolution ${config.width}x${config.height} not supported`);
            result.suggestions!.width = closestResolution.width;
            result.suggestions!.height = closestResolution.height;
          } else {
            result.errors.push(`No suitable resolution found for ${config.width}x${config.height}`);
            result.valid = false;
          }
        }

        // Validate frame rate
        const frameRateSupported = capabilities.frameRates.includes(config.frameRate);
        if (!frameRateSupported) {
          const closestFrameRate = this.findBestFrameRate(config.frameRate, capabilities.frameRates);
          if (closestFrameRate) {
            result.warnings.push(`Frame rate ${config.frameRate}fps not supported`);
            result.suggestions!.frameRate = closestFrameRate;
          } else {
            result.errors.push(`No suitable frame rate found for ${config.frameRate}fps`);
            result.valid = false;
          }
        }

        // Validate facing mode
        const facingModeSupported = capabilities.facingModes.includes(config.facingMode);
        if (!facingModeSupported) {
          result.warnings.push(`Facing mode '${config.facingMode}' not supported`);
          result.suggestions!.facingMode = capabilities.facingModes[0];
        }
      }

      // General validation
      if (config.width <= 0 || config.height <= 0) {
        result.errors.push('Resolution must be greater than 0');
        result.valid = false;
      }

      if (config.frameRate <= 0) {
        result.errors.push('Frame rate must be greater than 0');
        result.valid = false;
      }

      if (config.width > 7680 || config.height > 4320) {
        result.warnings.push('Very high resolution may cause performance issues');
      }

      if (config.frameRate > 60) {
        result.warnings.push('High frame rate may cause performance issues');
      }
    } catch (error) {
      result.errors.push(`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      result.valid = false;
    }

    return result;
  }

  /**
   * Get predefined resolution presets
   * @returns ResolutionPreset[] Array of resolution presets
   */
  public getResolutionPresets(): ResolutionPreset[] {
    return [...RESOLUTION_PRESETS];
  }

  /**
   * Get resolution preset by name
   * @param name - Preset name
   * @returns ResolutionPreset | undefined
   */
  public getResolutionPreset(name: string): ResolutionPreset | undefined {
    return RESOLUTION_PRESETS.find((preset) => preset.name === name);
  }

  /**
   * Create camera configuration from resolution preset
   * @param preset - Resolution preset
   * @param overrides - Configuration overrides
   * @returns CameraConfig
   */
  public createConfigFromPreset(preset: ResolutionPreset, overrides: Partial<CameraConfig> = {}): CameraConfig {
    return {
      width: preset.width,
      height: preset.height,
      frameRate: preset.frameRate,
      facingMode: 'environment',
      ...overrides,
    };
  }

  /**
   * Clear cached data
   */
  public clearCache(): void {
    this.deviceCache = [];
    this.capabilityCache.clear();
    this.cacheExpiry = 0;
  }

  // Private helper methods

  /**
   * Infer facing mode from device label
   */
  private inferFacingMode(label: string): 'user' | 'environment' | undefined {
    const lowerLabel = label.toLowerCase();
    if (lowerLabel.includes('front') || lowerLabel.includes('user')) {
      return 'user';
    }
    if (lowerLabel.includes('back') || lowerLabel.includes('rear') || lowerLabel.includes('environment')) {
      return 'environment';
    }
    return undefined;
  }

  /**
   * Parse resolutions from MediaTrackCapabilities
   */
  private parseResolutions(capabilities: MediaTrackCapabilities): { width: number; height: number }[] {
    const resolutions: { width: number; height: number }[] = [];

    // Common resolutions to check
    const commonResolutions = [
      { width: 320, height: 240 }, // QVGA
      { width: 640, height: 480 }, // VGA
      { width: 1280, height: 720 }, // HD
      { width: 1920, height: 1080 }, // Full HD
      { width: 2560, height: 1440 }, // QHD
      { width: 3840, height: 2160 }, // 4K
    ];

    // Check which resolutions are supported
    for (const res of commonResolutions) {
      if (capabilities.width && capabilities.height) {
        const withinWidthRange =
          res.width >= (capabilities.width.min ?? 0) && res.width <= (capabilities.width.max ?? Infinity);
        const withinHeightRange =
          res.height >= (capabilities.height.min ?? 0) && res.height <= (capabilities.height.max ?? Infinity);

        if (withinWidthRange && withinHeightRange) {
          resolutions.push(res);
        }
      }
    }

    return resolutions;
  }

  /**
   * Parse frame rates from MediaTrackCapabilities
   */
  private parseFrameRates(capabilities: MediaTrackCapabilities): number[] {
    const frameRates: number[] = [];
    const commonFrameRates = [15, 24, 30, 60];

    for (const rate of commonFrameRates) {
      if (capabilities.frameRate) {
        const withinRange =
          rate >= (capabilities.frameRate.min ?? 0) && rate <= (capabilities.frameRate.max ?? Infinity);
        if (withinRange) {
          frameRates.push(rate);
        }
      }
    }

    return frameRates.length > 0 ? frameRates : [30]; // Default to 30fps if none found
  }

  /**
   * Parse facing modes from MediaTrackCapabilities
   */
  private parseFacingModes(capabilities: MediaTrackCapabilities): ('user' | 'environment')[] {
    const facingModes: ('user' | 'environment')[] = [];

    if (capabilities.facingMode) {
      for (const mode of capabilities.facingMode) {
        if (mode === 'user' || mode === 'environment') {
          facingModes.push(mode);
        }
      }
    }

    return facingModes.length > 0 ? facingModes : ['environment']; // Default to environment
  }

  /**
   * Calculate aspect ratios from resolutions
   */
  private calculateAspectRatios(resolutions: { width: number; height: number }[]): string[] {
    const ratios = new Set<string>();

    for (const res of resolutions) {
      const gcd = this.calculateGCD(res.width, res.height);
      const aspectRatio = `${res.width / gcd}:${res.height / gcd}`;
      ratios.add(aspectRatio);
    }

    return Array.from(ratios);
  }

  /**
   * Calculate greatest common divisor
   */
  private calculateGCD(a: number, b: number): number {
    return b === 0 ? a : this.calculateGCD(b, a % b);
  }

  /**
   * Find best matching resolution
   */
  private findBestResolution(
    target: { width: number; height: number },
    available: { width: number; height: number }[],
  ): { width: number; height: number } | null {
    if (available.length === 0) return null;

    // Calculate scores for each resolution
    const scored = available.map((res) => ({
      resolution: res,
      score: this.calculateResolutionScore(target, res),
    }));

    // Sort by score (lower is better)
    scored.sort((a, b) => a.score - b.score);

    return scored[0].resolution;
  }

  /**
   * Calculate resolution matching score
   */
  private calculateResolutionScore(
    target: { width: number; height: number },
    candidate: { width: number; height: number },
  ): number {
    const widthDiff = Math.abs(target.width - candidate.width);
    const heightDiff = Math.abs(target.height - candidate.height);

    // Prefer resolutions that are close in both dimensions
    return Math.sqrt(widthDiff * widthDiff + heightDiff * heightDiff);
  }

  /**
   * Find best matching frame rate
   */
  private findBestFrameRate(target: number, available: number[]): number | null {
    if (available.length === 0) return null;

    // Find closest frame rate
    return available.reduce((closest, current) => {
      return Math.abs(current - target) < Math.abs(closest - target) ? current : closest;
    });
  }
}

// Export singleton instance
export const cameraService = CameraService.getInstance();
