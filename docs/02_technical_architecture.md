# DigDeep - Unified Technical Architecture

## Executive Summary

This document defines the complete technical architecture for DigDeep, a web-based powerlifting form analysis application. The architecture prioritizes **30+ FPS real-time performance**, **implementation-first guidance**, and **scalable feature-based organization** while maintaining solo development efficiency.

### Key Success Factors

1. **Performance-First Design**: Every component optimized for 30+ FPS real-time processing
2. **Scalable Feature Architecture**: Room for growth without architectural debt
3. **Production Quality**: Security, monitoring, and error handling built-in
4. **Solo Development Optimized**: Balanced complexity for efficient solo implementation

---

## Technology Stack

### Frontend (Unified)

- **Build Tool**: Vite 7.0.0 with SWC (fastest compilation)
- **Framework**: React 19.1.0 with TypeScript 5.8.3 (strict mode)
- **Styling**: Tailwind CSS 4.1.10 with CSS-in-JS for dynamic styles
- **State Management**: Zustand 5.0.5 with feature-specific stores
- **ML/Pose Detection**: @mediapipe/tasks-vision 0.10.22 (latest stable)
- **Video Processing**: Web APIs + Web Workers for 30+ FPS
- **UI Components**: Radix UI + custom gym-optimized components

### Backend & Services

- **BaaS**: Supabase 2.50.0 (PostgreSQL + Auth + Realtime + Storage)
- **Video Storage**: Cloudinary (25GB free, automatic optimization)
- **Deployment**: Vercel (Vite optimized, edge functions)
- **Error Tracking**: Sentry (free tier, performance monitoring)

### Development Tools

- **Code Quality**: ESLint 9.25.0 + Prettier + Husky
- **Testing**: Vitest 3.2.3 + @vitest/browser + React Testing Library
- **Type Safety**: TypeScript strict mode with project references
- **Performance**: Chrome DevTools + Lighthouse CI

---

## Project Structure

### Enhanced Feature-Based Architecture

```
src/
├── components/              # Shared UI components
│   ├── ui/                 # Base Radix components (Button, Card, etc.)
│   └── common/             # App-specific shared components
├── features/               # Feature modules with co-located concerns
│   ├── recording/
│   │   ├── components/     # Recording-specific UI
│   │   ├── hooks/          # useCamera, useRecording
│   │   ├── services/       # CameraService, MediaRecorderService
│   │   ├── stores/         # recordingStore.ts
│   │   ├── workers/        # Video processing workers
│   │   └── types.ts        # Recording domain types
│   ├── analysis/
│   │   ├── components/     # Real-time feedback UI
│   │   ├── hooks/          # usePoseDetection, useFormAnalysis
│   │   ├── services/       # MediaPipeService, AnalysisEngine
│   │   ├── stores/         # analysisStore.ts
│   │   ├── workers/        # ML processing workers
│   │   └── algorithms/     # Form analysis calculations
│   ├── workouts/
│   │   ├── components/     # Session management UI
│   │   ├── hooks/          # useWorkoutSession, useExercises
│   │   ├── services/       # WorkoutService, ProgressTracker
│   │   ├── stores/         # workoutStore.ts
│   │   └── types.ts        # Workout domain types
│   ├── feedback/
│   │   ├── components/     # Audio/Visual feedback UI
│   │   ├── hooks/          # useRealTimeFeedback, useAudioCues
│   │   ├── services/       # FeedbackEngine, AudioService
│   │   └── stores/         # feedbackStore.ts
│   └── auth/
│       ├── components/     # Authentication UI
│       ├── hooks/          # useAuth, useProfile
│       ├── services/       # AuthService
│       └── stores/         # authStore.ts
├── shared/                 # Cross-cutting concerns
│   ├── lib/                # Utility functions
│   ├── types/              # Common types and interfaces
│   ├── events/             # Simple event bus for feature communication
│   ├── constants/          # App-wide constants
│   └── hooks/              # Global hooks (useLocalStorage, etc.)
├── services/               # Infrastructure integrations
│   ├── supabase/           # Database client and queries
│   ├── cloudinary/         # Media storage client
│   └── mediapipe/          # ML model loader and manager
└── workers/                # High-performance Web Workers
    ├── pose-detection.worker.ts
    ├── video-processing.worker.ts
    └── analysis-calculation.worker.ts
```
