import { z } from 'zod';

/**
 * Camera configuration validation schema.
 * Ensures all camera settings are within valid ranges and properly typed.
 *
 * Using Zod provides:
 * - Runtime type validation with helpful error messages
 * - Type inference for TypeScript
 * - Automatic validation of user inputs
 * - Protection against invalid configurations that could crash the camera
 */

// Valid camera facing modes
export const CAMERA_FACING_MODES = ['user', 'environment'] as const;

// Valid video codecs we support
export const CAMERA_CODECS = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'] as const;

// Camera constraints based on common device capabilities
export const CAMERA_CONSTRAINTS = {
  MIN_WIDTH: 320,
  MAX_WIDTH: 3840, // 4K
  MIN_HEIGHT: 240,
  MAX_HEIGHT: 2160, // 4K
  MIN_FRAME_RATE: 1,
  MAX_FRAME_RATE: 60,
  DEFAULT_WIDTH: 1280,
  DEFAULT_HEIGHT: 720,
  DEFAULT_FRAME_RATE: 30,
} as const;

/**
 * Camera configuration schema for runtime validation.
 * Validates all camera settings to ensure they're within acceptable ranges.
 */
export const cameraConfigSchema = z.object({
  width: z
    .number()
    .int('Width must be an integer')
    .min(CAMERA_CONSTRAINTS.MIN_WIDTH, `Width must be at least ${CAMERA_CONSTRAINTS.MIN_WIDTH}px`)
    .max(CAMERA_CONSTRAINTS.MAX_WIDTH, `Width cannot exceed ${CAMERA_CONSTRAINTS.MAX_WIDTH}px`),

  height: z
    .number()
    .int('Height must be an integer')
    .min(CAMERA_CONSTRAINTS.MIN_HEIGHT, `Height must be at least ${CAMERA_CONSTRAINTS.MIN_HEIGHT}px`)
    .max(CAMERA_CONSTRAINTS.MAX_HEIGHT, `Height cannot exceed ${CAMERA_CONSTRAINTS.MAX_HEIGHT}px`),

  frameRate: z
    .number()
    .min(CAMERA_CONSTRAINTS.MIN_FRAME_RATE, `Frame rate must be at least ${CAMERA_CONSTRAINTS.MIN_FRAME_RATE} FPS`)
    .max(CAMERA_CONSTRAINTS.MAX_FRAME_RATE, `Frame rate cannot exceed ${CAMERA_CONSTRAINTS.MAX_FRAME_RATE} FPS`),

  facingMode: z.enum(CAMERA_FACING_MODES, {
    errorMap: () => ({ message: `Facing mode must be either 'user' or 'environment'` }),
  }),

  codec: z
    .enum(CAMERA_CODECS, {
      errorMap: () => ({ message: `Codec must be one of: ${CAMERA_CODECS.join(', ')}` }),
    })
    .optional(),

  deviceId: z.string().optional(),
});

/**
 * Partial camera configuration schema for updates.
 * Allows any subset of camera settings to be validated.
 */
export const partialCameraConfigSchema = cameraConfigSchema.partial();

/**
 * Type inference from schemas
 */
export type ValidatedCameraConfig = z.infer<typeof cameraConfigSchema>;
export type PartialCameraConfig = z.infer<typeof partialCameraConfigSchema>;

/**
 * Result type for safe camera config creation
 */
export interface SafeCameraConfigResult {
  /** Always returns a valid config (with defaults for invalid values) */
  config: ValidatedCameraConfig;
  /** Validation errors if the input was invalid */
  errors?: {
    field: string;
    message: string;
  }[];
}

/**
 * Creates a safe camera config by validating input and merging with defaults.
 * Always returns a valid config, even if the input is invalid.
 *
 * @param partialConfig - Optional partial config to validate and merge
 * @returns Object with valid config and any validation errors
 */
export function createSafeCameraConfig(partialConfig?: Partial<ValidatedCameraConfig>): SafeCameraConfigResult {
  const defaultConfig: ValidatedCameraConfig = {
    width: CAMERA_CONSTRAINTS.DEFAULT_WIDTH,
    height: CAMERA_CONSTRAINTS.DEFAULT_HEIGHT,
    frameRate: CAMERA_CONSTRAINTS.DEFAULT_FRAME_RATE,
    facingMode: 'environment',
    codec: 'video/webm;codecs=vp9',
  };

  if (!partialConfig) {
    return { config: defaultConfig };
  }

  // Validate the partial config using Zod's safeParse
  const result = partialCameraConfigSchema.safeParse(partialConfig);

  if (result.success) {
    // Merge validated partial config with defaults
    return {
      config: { ...defaultConfig, ...result.data },
    };
  }

  // Validation failed - return defaults with errors
  const errors = result.error.errors.map((err) => ({
    field: err.path.join('.'),
    message: err.message,
  }));

  // Log in development
  if (process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line no-console
    console.warn('Invalid camera config provided, using defaults:', errors);
  }

  return {
    config: defaultConfig,
    errors,
  };
}
