# Technology Decisions Log

This document serves as the single source of truth for all technology choices made in the DigDeep project, along with the rationale behind each decision.

## Core Technology Stack

### Frontend Framework

- **React 19.1.0** with **TypeScript 5.8.3**
- **Rationale**: Latest React with concurrent features, strict TypeScript for type safety
- **Decision Date**: Current (based on MVP implementation)

### Build Tooling

- **Vite 7.0.0** with **SWC**
- **Rationale**: Fastest compilation, optimized for development experience
- **Decision Date**: Current (based on MVP implementation)

### Styling & UI

- **Tailwind CSS 4.1.10**
- **Rationale**: Utility-first CSS, optimized for gym-specific design requirements
- **Decision Date**: Current (based on MVP implementation)

### State Management

- **Zustand 5.0.5**
- **Rationale**: Lightweight, feature-specific stores without boilerplate
- **Decision Date**: Current (based on MVP implementation)

## Machine Learning & Computer Vision

### Pose Detection

- **MediaPipe Pose (@mediapipe/tasks-vision 0.10.22)**
- **Rationale**: Superior real-time performance, 30+ FPS capability, no custom ML training required
- **Alternative Considered**: TensorFlow.js with MoveNet
- **Decision Date**: Finalized for MVP (supersedes earlier uncertainty)

### ML Processing Strategy

- **Rule-based analysis** on MediaPipe landmarks
- **Rationale**: Faster to implement, more reliable than custom ML for MVP
- **Future**: Custom ML models for advanced form scoring (post-MVP)

## Data Storage Strategy

### MVP Storage

- **Dexie** (IndexedDB wrapper) with **dexie-react-hooks**
- **Rationale**: Offline-first, no backend complexity, reactive data management
- **Decision Date**: Current MVP approach

### Post-MVP Backend

- **Supabase** (PostgreSQL + Auth + Realtime + Storage)
- **Rationale**: Free tier, comprehensive BaaS, easy data migration from Dexie
- **Migration Path**: Dexie → Supabase with offline-first sync queue

### Video Storage

- **Cloudinary** (25GB free tier)
- **Rationale**: Automatic optimization, CDN delivery, generous free tier
- **Decision Date**: Post-MVP (no recording in MVP)

## Performance & Infrastructure

### Web Workers

- **Native Web Workers** for ML processing
- **Rationale**: Keep main thread free for UI, enable 30+ FPS performance
- **Implementation**: `pose-detection.worker.ts`, `analysis-calculation.worker.ts`

### Deployment

- **Vercel**
- **Rationale**: Vite-optimized, edge functions, excellent developer experience
- **Alternative**: Netlify (also viable)

### Error Tracking

- **Sentry** (free tier)
- **Rationale**: Performance monitoring, error tracking, production insights
- **Decision Date**: Built into MVP architecture

## Development Tools

### Code Quality

- **ESLint 9.25.0** + **Prettier** + **Husky**
- **Rationale**: Consistent code style, pre-commit hooks for quality gates
- **Decision Date**: Current (based on MVP setup)

### Testing

- **Vitest 3.2.3** + **React Testing Library**
- **Rationale**: Fast test runner, user-focused testing methodology
- **Strategy**: Component tests, integration tests, no unit tests for implementation details

### Type Safety

- **TypeScript strict mode** with **project references**
- **Rationale**: Maximum type safety, modular compilation
- **Requirements**: Explicit types, no `any`, proper error typing

## Exercise Analysis Architecture

### MVP Approach

- **Direct SquatPoseAnalyzer** implementation
- **BasePoseDetector** foundation class
- **Rationale**: Simplest implementation for single exercise

### Post-MVP Architecture

- **Strategy Pattern** with **ExerciseAnalyzer** interface
- **Plugin Architecture** for dynamic exercise loading
- **Reference**: See [Exercise Analyzer Patterns](./reference/exercise_analyzer_patterns.md)

## Performance Requirements

### Real-Time Processing

- **30+ FPS** pose detection and analysis
- **< 33ms per frame** processing time
- **GPU acceleration** with CPU fallback

### Memory Management

- **Bounded history arrays** (max 30 entries)
- **Proper cleanup** in component unmount
- **Object pooling** for frequent calculations

## Camera & Recording

### MVP: No Recording

- **Real-time analysis only**
- **Rationale**: Simplifies implementation, faster to market
- **Wake Lock API** to prevent screen sleep

### Post-MVP: Recording

- **MediaRecorder API** with **VP9 codec**
- **2.5 Mbps bitrate** for quality/size balance
- **Frame-synced analysis data** storage

## Browser Compatibility

### Target Browsers

- **Chrome/Edge**: Primary target (MediaPipe optimized)
- **Safari**: Secondary support
- **Firefox**: Basic support
- **Rationale**: MediaPipe performance varies by browser

### Required APIs

- **MediaPipe WASM** support
- **WebRTC** for camera access
- **IndexedDB** for data storage
- **Web Workers** for ML processing

## Free Tier Strategy

### Cost Optimization

- **Client-side video compression** before upload
- **Selective storage** (PRs and form issues only)
- **Data retention policies** to manage storage limits
- **Pose detection optimization** (every 3-5 frames)

### Service Limits

- **Supabase**: 500MB database, 1GB bandwidth/month
- **Cloudinary**: 25GB storage, 25GB bandwidth/month
- **Vercel**: 100GB bandwidth/month

## Security Considerations

### Data Privacy

- **Local-first storage** (Dexie) for sensitive data
- **Optional cloud sync** with user consent
- **No personal data logging** in error tracking

### API Security

- **Row Level Security** in Supabase
- **Environment variable protection** for API keys
- **HTTPS only** in production

## Decision Change Log

### Resolved Decisions

1. **MediaPipe vs TensorFlow.js**: MediaPipe chosen for superior performance
2. **Backend timing**: MVP = Dexie only, Post-MVP = Supabase migration
3. **Recording strategy**: Excluded from MVP, core feature for Post-MVP
4. **Timeline approach**: Removed all time-based estimates, linear progress only

### Pending Decisions

- None (all major architectural decisions finalized)

## Version Compatibility Matrix

| Component  | Version | Compatibility  |
| ---------- | ------- | -------------- |
| React      | 19.1.0  | Latest stable  |
| TypeScript | 5.8.3   | Latest stable  |
| Vite       | 7.0.0   | Latest stable  |
| MediaPipe  | 0.10.22 | Latest stable  |
| Tailwind   | 4.1.10  | Latest stable  |
| Zustand    | 5.0.5   | Latest stable  |
| Dexie      | Latest  | Reactive hooks |

All versions are locked to latest stable releases to ensure optimal performance and feature availability.
