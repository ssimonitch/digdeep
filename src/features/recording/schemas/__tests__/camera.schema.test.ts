/**
 * Camera Schema Tests
 *
 * Tests for Zod validation schemas including:
 * - Valid configuration validation
 * - Invalid configuration handling
 * - createSafeCameraConfig function
 * - Error message formatting
 */

import { describe, expect, it } from 'vitest';

import {
  CAMERA_CODECS,
  CAMERA_CONSTRAINTS,
  CAMERA_FACING_MODES,
  cameraConfigSchema,
  createSafeCameraConfig,
  partialCameraConfigSchema,
  type SafeCameraConfigResult,
  type ValidatedCameraConfig,
} from '../camera.schema';

describe('camera.schema', () => {
  describe('Constants', () => {
    it('should define valid camera facing modes', () => {
      expect(CAMERA_FACING_MODES).toEqual(['user', 'environment']);
    });

    it('should define valid camera codecs', () => {
      expect(CAMERA_CODECS).toEqual(['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4']);
    });

    it('should define camera constraints with proper ranges', () => {
      expect(CAMERA_CONSTRAINTS.MIN_WIDTH).toBe(320);
      expect(CAMERA_CONSTRAINTS.MAX_WIDTH).toBe(3840);
      expect(CAMERA_CONSTRAINTS.MIN_HEIGHT).toBe(240);
      expect(CAMERA_CONSTRAINTS.MAX_HEIGHT).toBe(2160);
      expect(CAMERA_CONSTRAINTS.MIN_FRAME_RATE).toBe(1);
      expect(CAMERA_CONSTRAINTS.MAX_FRAME_RATE).toBe(60);
      expect(CAMERA_CONSTRAINTS.DEFAULT_WIDTH).toBe(1280);
      expect(CAMERA_CONSTRAINTS.DEFAULT_HEIGHT).toBe(720);
      expect(CAMERA_CONSTRAINTS.DEFAULT_FRAME_RATE).toBe(30);
    });
  });

  describe('cameraConfigSchema', () => {
    describe('Valid configurations', () => {
      it('should validate a complete valid configuration', () => {
        const config: ValidatedCameraConfig = {
          width: 1920,
          height: 1080,
          frameRate: 30,
          facingMode: 'environment',
          codec: 'video/webm;codecs=vp9',
          deviceId: 'some-device-id',
        };

        const result = cameraConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toEqual(config);
        }
      });

      it('should validate configuration without optional fields', () => {
        const config = {
          width: 1280,
          height: 720,
          frameRate: 30,
          facingMode: 'user',
        };

        const result = cameraConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toEqual(config);
        }
      });

      it('should accept minimum valid values', () => {
        const config = {
          width: CAMERA_CONSTRAINTS.MIN_WIDTH,
          height: CAMERA_CONSTRAINTS.MIN_HEIGHT,
          frameRate: CAMERA_CONSTRAINTS.MIN_FRAME_RATE,
          facingMode: 'environment',
        };

        const result = cameraConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
      });

      it('should accept maximum valid values', () => {
        const config = {
          width: CAMERA_CONSTRAINTS.MAX_WIDTH,
          height: CAMERA_CONSTRAINTS.MAX_HEIGHT,
          frameRate: CAMERA_CONSTRAINTS.MAX_FRAME_RATE,
          facingMode: 'user',
        };

        const result = cameraConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
      });

      it('should accept all valid codec values', () => {
        CAMERA_CODECS.forEach((codec) => {
          const config = {
            width: 1280,
            height: 720,
            frameRate: 30,
            facingMode: 'environment',
            codec,
          };

          const result = cameraConfigSchema.safeParse(config);
          expect(result.success).toBe(true);
        });
      });
    });

    describe('Invalid configurations', () => {
      it('should reject negative width', () => {
        const config = {
          width: -100,
          height: 720,
          frameRate: 30,
          facingMode: 'environment',
        };

        const result = cameraConfigSchema.safeParse(config);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.errors[0].message).toContain('Width must be at least 320px');
        }
      });

      it('should reject width exceeding maximum', () => {
        const config = {
          width: 5000,
          height: 720,
          frameRate: 30,
          facingMode: 'environment',
        };

        const result = cameraConfigSchema.safeParse(config);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.errors[0].message).toContain('Width cannot exceed 3840px');
        }
      });

      it('should reject non-integer width', () => {
        const config = {
          width: 1280.5,
          height: 720,
          frameRate: 30,
          facingMode: 'environment',
        };

        const result = cameraConfigSchema.safeParse(config);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.errors[0].message).toContain('Width must be an integer');
        }
      });

      it('should reject invalid height values', () => {
        const invalidHeights = [
          { value: -1, error: 'Height must be at least 240px' },
          { value: 3000, error: 'Height cannot exceed 2160px' },
          { value: 720.5, error: 'Height must be an integer' },
        ];

        invalidHeights.forEach(({ value, error }) => {
          const config = {
            width: 1280,
            height: value,
            frameRate: 30,
            facingMode: 'environment',
          };

          const result = cameraConfigSchema.safeParse(config);
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error.errors[0].message).toContain(error);
          }
        });
      });

      it('should reject invalid frameRate values', () => {
        const invalidFrameRates = [
          { value: 0, error: 'Frame rate must be at least 1 FPS' },
          { value: 120, error: 'Frame rate cannot exceed 60 FPS' },
          { value: -30, error: 'Frame rate must be at least 1 FPS' },
        ];

        invalidFrameRates.forEach(({ value, error }) => {
          const config = {
            width: 1280,
            height: 720,
            frameRate: value,
            facingMode: 'environment',
          };

          const result = cameraConfigSchema.safeParse(config);
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error.errors[0].message).toContain(error);
          }
        });
      });

      it('should reject invalid facingMode', () => {
        const config = {
          width: 1280,
          height: 720,
          frameRate: 30,
          facingMode: 'invalid',
        };

        const result = cameraConfigSchema.safeParse(config);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.errors[0].message).toContain("Facing mode must be either 'user' or 'environment'");
        }
      });

      it('should reject invalid codec', () => {
        const config = {
          width: 1280,
          height: 720,
          frameRate: 30,
          facingMode: 'environment',
          codec: 'invalid/codec',
        };

        const result = cameraConfigSchema.safeParse(config);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.errors[0].message).toContain('Codec must be one of:');
        }
      });

      it('should reject missing required fields', () => {
        const configs = [
          { height: 720, frameRate: 30, facingMode: 'environment' }, // missing width
          { width: 1280, frameRate: 30, facingMode: 'environment' }, // missing height
          { width: 1280, height: 720, facingMode: 'environment' }, // missing frameRate
          { width: 1280, height: 720, frameRate: 30 }, // missing facingMode
        ];

        configs.forEach((config) => {
          const result = cameraConfigSchema.safeParse(config);
          expect(result.success).toBe(false);
        });
      });
    });
  });

  describe('partialCameraConfigSchema', () => {
    it('should accept empty object', () => {
      const result = partialCameraConfigSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should accept partial configurations', () => {
      const partials = [
        { width: 1920 },
        { height: 1080 },
        { frameRate: 60 },
        { facingMode: 'user' },
        { codec: 'video/mp4' },
        { width: 1920, height: 1080 },
        { frameRate: 30, facingMode: 'environment' },
      ];

      partials.forEach((partial) => {
        const result = partialCameraConfigSchema.safeParse(partial);
        expect(result.success).toBe(true);
      });
    });

    it('should still validate individual field constraints', () => {
      const invalid = {
        width: -100, // Invalid even in partial
      };

      const result = partialCameraConfigSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('createSafeCameraConfig', () => {
    it('should return default config when called with no arguments', () => {
      const result = createSafeCameraConfig();

      expect(result.config).toEqual({
        width: CAMERA_CONSTRAINTS.DEFAULT_WIDTH,
        height: CAMERA_CONSTRAINTS.DEFAULT_HEIGHT,
        frameRate: CAMERA_CONSTRAINTS.DEFAULT_FRAME_RATE,
        facingMode: 'environment',
        codec: 'video/webm;codecs=vp9',
      });
      expect(result.errors).toBeUndefined();
    });

    it('should return default config when called with undefined', () => {
      const result = createSafeCameraConfig(undefined);

      expect(result.config).toEqual({
        width: CAMERA_CONSTRAINTS.DEFAULT_WIDTH,
        height: CAMERA_CONSTRAINTS.DEFAULT_HEIGHT,
        frameRate: CAMERA_CONSTRAINTS.DEFAULT_FRAME_RATE,
        facingMode: 'environment',
        codec: 'video/webm;codecs=vp9',
      });
      expect(result.errors).toBeUndefined();
    });

    it('should merge valid partial config with defaults', () => {
      const partial = {
        width: 1920,
        height: 1080,
      };

      const result = createSafeCameraConfig(partial);

      expect(result.config).toEqual({
        width: 1920,
        height: 1080,
        frameRate: CAMERA_CONSTRAINTS.DEFAULT_FRAME_RATE,
        facingMode: 'environment',
        codec: 'video/webm;codecs=vp9',
      });
      expect(result.errors).toBeUndefined();
    });

    it('should override all default values when provided', () => {
      const config: Partial<ValidatedCameraConfig> = {
        width: 640,
        height: 480,
        frameRate: 15,
        facingMode: 'user',
        codec: 'video/mp4',
        deviceId: 'custom-device',
      };

      const result = createSafeCameraConfig(config);

      expect(result.config).toEqual(config);
      expect(result.errors).toBeUndefined();
    });

    it('should return default config with errors for invalid values', () => {
      const invalid = {
        width: -100,
        height: 5000,
        frameRate: 0,
      };

      const result = createSafeCameraConfig(invalid);

      // Should return default config
      expect(result.config).toEqual({
        width: CAMERA_CONSTRAINTS.DEFAULT_WIDTH,
        height: CAMERA_CONSTRAINTS.DEFAULT_HEIGHT,
        frameRate: CAMERA_CONSTRAINTS.DEFAULT_FRAME_RATE,
        facingMode: 'environment',
        codec: 'video/webm;codecs=vp9',
      });

      // Should include errors
      expect(result.errors).toBeDefined();
      expect(result.errors).toHaveLength(3);
      expect(result.errors?.[0]).toHaveProperty('field');
      expect(result.errors?.[0]).toHaveProperty('message');
    });

    it('should provide specific error messages for each invalid field', () => {
      const invalid = {
        width: -100,
        facingMode: 'invalid' as unknown as 'user',
        codec: 'unsupported/codec' as unknown as 'video/webm;codecs=vp9',
      };

      const result = createSafeCameraConfig(invalid);

      expect(result.errors).toBeDefined();
      expect(result.errors).toHaveLength(3);

      const errorMap = new Map(result.errors?.map((e) => [e.field, e.message]));
      expect(errorMap.get('width')).toContain('Width must be at least 320px');
      expect(errorMap.get('facingMode')).toContain("Facing mode must be either 'user' or 'environment'");
      expect(errorMap.get('codec')).toContain('Codec must be one of:');
    });

    it('should handle mix of valid and invalid values', () => {
      const mixed = {
        width: 1920, // valid
        height: -100, // invalid
        frameRate: 60, // valid
        facingMode: 'user' as unknown as 'user', // valid
      };

      const result = createSafeCameraConfig(mixed);

      // Current implementation returns all defaults when any validation fails
      expect(result.config.width).toBe(CAMERA_CONSTRAINTS.DEFAULT_WIDTH);
      expect(result.config.height).toBe(CAMERA_CONSTRAINTS.DEFAULT_HEIGHT);
      expect(result.config.frameRate).toBe(CAMERA_CONSTRAINTS.DEFAULT_FRAME_RATE);
      expect(result.config.facingMode).toBe('environment');

      // Should report only the invalid field
      expect(result.errors).toHaveLength(1);
      expect(result.errors?.[0].field).toBe('height');
    });

    it('should always return a usable config object', () => {
      const testCases = [
        null,
        undefined,
        {},
        { width: 1920 },
        { invalid: 'field' } as unknown as { invalid: string },
        { width: 'not a number' } as unknown as { width: string },
        { width: -1000, height: -1000, frameRate: -1000 },
      ];

      testCases.forEach((testCase) => {
        const result = createSafeCameraConfig(testCase as unknown as Partial<ValidatedCameraConfig>);

        // Always has required fields
        expect(result.config).toHaveProperty('width');
        expect(result.config).toHaveProperty('height');
        expect(result.config).toHaveProperty('frameRate');
        expect(result.config).toHaveProperty('facingMode');
        expect(result.config).toHaveProperty('codec');

        // Always valid values
        expect(result.config.width).toBeGreaterThanOrEqual(CAMERA_CONSTRAINTS.MIN_WIDTH);
        expect(result.config.width).toBeLessThanOrEqual(CAMERA_CONSTRAINTS.MAX_WIDTH);
        expect(result.config.height).toBeGreaterThanOrEqual(CAMERA_CONSTRAINTS.MIN_HEIGHT);
        expect(result.config.height).toBeLessThanOrEqual(CAMERA_CONSTRAINTS.MAX_HEIGHT);
        expect(result.config.frameRate).toBeGreaterThanOrEqual(CAMERA_CONSTRAINTS.MIN_FRAME_RATE);
        expect(result.config.frameRate).toBeLessThanOrEqual(CAMERA_CONSTRAINTS.MAX_FRAME_RATE);
        expect(['user', 'environment']).toContain(result.config.facingMode);
        expect(CAMERA_CODECS).toContain(result.config.codec);
      });
    });

    it('should return consistent error structure', () => {
      const invalid = {
        width: -100,
        height: 5000,
      };

      const result = createSafeCameraConfig(invalid);

      expect(result.errors).toBeDefined();
      result.errors?.forEach((error) => {
        expect(error).toHaveProperty('field');
        expect(error).toHaveProperty('message');
        expect(typeof error.field).toBe('string');
        expect(typeof error.message).toBe('string');
        expect(error.field).toBeTruthy(); // Not empty
        expect(error.message).toBeTruthy(); // Not empty
      });
    });

    it('should handle edge case codec values', () => {
      const config = {
        codec: undefined, // Should use default
      };

      const result = createSafeCameraConfig(config);
      // When providing codec: undefined, it merges and undefined overrides the default
      expect(result.config).toEqual({
        width: CAMERA_CONSTRAINTS.DEFAULT_WIDTH,
        height: CAMERA_CONSTRAINTS.DEFAULT_HEIGHT,
        frameRate: CAMERA_CONSTRAINTS.DEFAULT_FRAME_RATE,
        facingMode: 'environment',
        codec: undefined, // undefined is a valid value for optional field
      });
      expect(result.errors).toBeUndefined();
    });
  });

  describe('Type safety', () => {
    it('should enforce proper types at compile time', () => {
      // This test verifies TypeScript compilation rather than runtime behavior
      const validConfig: ValidatedCameraConfig = {
        width: 1280,
        height: 720,
        frameRate: 30,
        facingMode: 'environment',
        codec: 'video/webm;codecs=vp9',
      };

      const result: SafeCameraConfigResult = createSafeCameraConfig(validConfig);

      // Type assertions to ensure proper typing
      const width: number = result.config.width;
      const facingMode: 'user' | 'environment' = result.config.facingMode;
      const errors: { field: string; message: string }[] | undefined = result.errors;

      expect(width).toBe(1280);
      expect(facingMode).toBe('environment');
      expect(errors).toBeUndefined();
    });
  });
});
