import { beforeEach, describe, expect, it } from 'vitest';

import { LANDMARK_INDICES } from '../fixtures/landmark-fixtures';
import {
  createFailedDetectionResult,
  createLowConfidenceResult,
  createMockVideoElement,
  createPartialDetectionResult,
  MockFilesetResolver,
  MockHTMLVideoElement,
  MockPoseLandmarker,
  resetMockMediaPipeConfig,
  setMockMediaPipeConfig,
} from './mediapipe-mocks';

describe('MediaPipe Mocks', () => {
  beforeEach(() => {
    resetMockMediaPipeConfig();
    MockPoseLandmarker.closeAll();
  });

  describe('MockFilesetResolver', () => {
    it('should resolve vision tasks with correct paths', async () => {
      const wasmPath = 'https://cdn.example.com/wasm';
      const vision = await MockFilesetResolver.forVisionTasks(wasmPath);

      expect(vision.wasmLoaderPath).toBe(`${wasmPath}/vision_wasm_internal.js`);
      expect(vision.wasmBinaryPath).toBe(`${wasmPath}/vision_wasm_internal.wasm`);
      expect(vision.assetLoaderPath).toBe(`${wasmPath}/vision_wasm_internal.data`);
    });

    it('should fail when configured to fail initialization', async () => {
      setMockMediaPipeConfig({
        shouldFailInit: true,
        initFailureMessage: 'Network error loading WASM',
      });

      await expect(MockFilesetResolver.forVisionTasks('path')).rejects.toThrow('Network error loading WASM');
    });
  });

  describe('MockPoseLandmarker', () => {
    it('should create instance with options', async () => {
      const vision = await MockFilesetResolver.forVisionTasks('path');
      const options = {
        baseOptions: { modelAssetPath: 'model.task' },
        runningMode: 'VIDEO',
        numPoses: 1,
      };

      const landmarker = await MockPoseLandmarker.createFromOptions(vision, options);

      expect(landmarker).toBeInstanceOf(MockPoseLandmarker);
      expect(landmarker.getOptions()).toEqual(options);
    });

    it('should detect poses for video', async () => {
      const vision = await MockFilesetResolver.forVisionTasks('path');
      const landmarker = await MockPoseLandmarker.createFromOptions(vision, {});
      const video = createMockVideoElement();

      const result = landmarker.detectForVideo(video, 1000);

      expect(result.landmarks).toHaveLength(1);
      expect(result.landmarks[0]).toHaveLength(33);

      // Check landmark structure
      const firstLandmark = result.landmarks[0][0];
      expect(firstLandmark).toHaveProperty('x');
      expect(firstLandmark).toHaveProperty('y');
      expect(firstLandmark).toHaveProperty('z');
      expect(firstLandmark).toHaveProperty('visibility');
    });

    it('should generate different landmarks for different timestamps', async () => {
      const vision = await MockFilesetResolver.forVisionTasks('path');
      const landmarker = await MockPoseLandmarker.createFromOptions(vision, {});
      const video = createMockVideoElement();

      const result1 = landmarker.detectForVideo(video, 1000);
      const result2 = landmarker.detectForVideo(video, 2000);

      // Landmarks should be different due to timestamp-based variation
      const landmark1 = result1.landmarks[0][0];
      const landmark2 = result2.landmarks[0][0];

      expect(landmark1.x).not.toBe(landmark2.x);
      expect(landmark1.y).not.toBe(landmark2.y);
    });

    it('should return custom result when configured', async () => {
      const customResult = createLowConfidenceResult();
      setMockMediaPipeConfig({ customResult });

      const vision = await MockFilesetResolver.forVisionTasks('path');
      const landmarker = await MockPoseLandmarker.createFromOptions(vision, {});
      const video = createMockVideoElement();

      const result = landmarker.detectForVideo(video, 1000);

      expect(result).toBe(customResult);
    });

    it('should fail detection when configured', async () => {
      setMockMediaPipeConfig({
        shouldFail: true,
        failureMessage: 'GPU memory error',
      });

      const vision = await MockFilesetResolver.forVisionTasks('path');
      const landmarker = await MockPoseLandmarker.createFromOptions(vision, {});
      const video = createMockVideoElement();

      expect(() => landmarker.detectForVideo(video, 1000)).toThrow('GPU memory error');
    });

    it('should properly close and cleanup', async () => {
      const vision = await MockFilesetResolver.forVisionTasks('path');
      const landmarker = await MockPoseLandmarker.createFromOptions(vision, {});

      expect(landmarker.getIsClosed()).toBe(false);

      landmarker.close();

      expect(landmarker.getIsClosed()).toBe(true);

      // Should throw when trying to use after closing
      const video = createMockVideoElement();
      expect(() => landmarker.detectForVideo(video, 1000)).toThrow('PoseLandmarker is closed');
    });
  });

  describe('MockHTMLVideoElement', () => {
    it('should create with default properties', () => {
      const video = new MockHTMLVideoElement();

      expect(video.videoWidth).toBe(640);
      expect(video.videoHeight).toBe(480);
      expect(video.readyState).toBe(4); // HAVE_ENOUGH_DATA
      expect(video.paused).toBe(false);
      expect(video.currentTime).toBe(0);
    });

    it('should create with custom properties', () => {
      const video = new MockHTMLVideoElement(1920, 1080, 2);

      expect(video.videoWidth).toBe(1920);
      expect(video.videoHeight).toBe(1080);
      expect(video.readyState).toBe(2);
    });

    it('should handle play/pause operations', async () => {
      const video = new MockHTMLVideoElement();

      expect(video.paused).toBe(false);

      video.pause();
      expect(video.paused).toBe(true);

      await video.play();
      expect(video.paused).toBe(false);
    });
  });

  describe('Utility Functions', () => {
    it('should create mock video element', () => {
      const video = createMockVideoElement(1280, 720, 3);

      expect(video).toBeDefined();
      expect(video.videoWidth).toBe(1280);
      expect(video.videoHeight).toBe(720);
      expect(video.readyState).toBe(3);
    });

    it('should create failed detection result', () => {
      const result = createFailedDetectionResult();

      expect(result.landmarks).toEqual([]);
      expect(result.worldLandmarks).toEqual([]);
      expect(result.segmentationMasks).toBeUndefined();
      expect(result.close).toBeDefined();
    });

    it('should create low confidence result', () => {
      const result = createLowConfidenceResult();

      expect(result.landmarks).toHaveLength(1);
      expect(result.landmarks[0]).toHaveLength(33);

      // All landmarks should have low visibility
      result.landmarks[0].forEach((landmark) => {
        expect(landmark.visibility).toBeLessThanOrEqual(0.3);
      });
    });

    it('should create partial detection result', () => {
      const landmarkCount = 20;
      const result = createPartialDetectionResult(landmarkCount);

      expect(result.landmarks).toHaveLength(1);
      expect(result.landmarks[0]).toHaveLength(landmarkCount);

      // Landmarks should have good visibility
      result.landmarks[0].forEach((landmark) => {
        expect(landmark.visibility).toBeGreaterThanOrEqual(0.8);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle landmarks with all 33 expected indices', async () => {
      const vision = await MockFilesetResolver.forVisionTasks('path');
      const landmarker = await MockPoseLandmarker.createFromOptions(vision, {});
      const video = createMockVideoElement();

      const result = landmarker.detectForVideo(video, 1000);

      // Verify we can access all expected landmark indices
      const landmarks = result.landmarks[0];
      expect(landmarks[LANDMARK_INDICES.LEFT_SHOULDER]).toBeDefined();
      expect(landmarks[LANDMARK_INDICES.RIGHT_HIP]).toBeDefined();
      expect(landmarks[LANDMARK_INDICES.LEFT_KNEE]).toBeDefined();
      expect(landmarks[LANDMARK_INDICES.RIGHT_ANKLE]).toBeDefined();
    });

    it('should handle multiple detections', async () => {
      const vision = await MockFilesetResolver.forVisionTasks('path');
      const landmarker = await MockPoseLandmarker.createFromOptions(vision, {});
      const video = createMockVideoElement();

      const result1 = landmarker.detectForVideo(video, 1000);
      const result2 = landmarker.detectForVideo(video, 2000);
      const result3 = landmarker.detectForVideo(video, 3000);

      expect(result1.landmarks).toHaveLength(1);
      expect(result2.landmarks).toHaveLength(1);
      expect(result3.landmarks).toHaveLength(1);
    });
  });
});
