import { LandmarkValidator } from './src/shared/utils/landmark-validator.js';

const validator = new LandmarkValidator();
const landmarks = Array(20).fill(null).map(() => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.4 }));
const result = validator.validatePose(landmarks, 'squat');

console.log('Messages:', result.messages);
console.log('Missing indices:', result.completeness.missingIndices.length);