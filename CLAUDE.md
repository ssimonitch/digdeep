# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is DigDeep, a web-based powerlifting form analysis application that uses machine learning for real-time feedback and training progress tracking.

### Project Goals

- Designed for personal use as both a learning project and powerlifting training tool
- Solo-development using only free-tier services
- Showcase developer's knowledge of fullstack web development, applied machine learning, and technical architecture

## Development Commands

### Package Management

- **Package Manager**: pnpm v10.12.2
- **Install dependencies**: `pnpm install`
- **Add a package**: `pnpm add <package-name>`
- **Add a dev dependency**: `pnpm add -D <package-name>`

### Core Development Commands

```bash
# Start development server
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview

# Run ESLint
pnpm lint

# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Type checking
pnpm run typecheck
```

## Architecture Overview

### Tech Stack

- **Frontend Framework**: React 19.1.0 with TypeScript 5.8.3
- **Build Tool**: Vite 7.0.0 with SWC for fast compilation
- **Styling**: Tailwind CSS 4.1.10
- **State Management**: Zustand 5.0.5
- **ML/Pose Detection**: MediaPipe Pose (@mediapipe/tasks-vision 0.10.22)
- **Storage (MVP)**: Dexie (IndexedDB) for offline-first data
- **Backend (Post-MVP)**: Supabase (auth + database + storage)
- **Video Storage (Post-MVP)**: Cloudinary

### Project Structure

```
src/
├── components/              # Shared UI components
├── features/               # Feature modules with co-located concerns
├── shared/                 # Cross-cutting concerns
├── services/               # Infrastructure integrations
└── workers/                # High-performance Web Workers
```

### Current Architecture Status

- **BasePoseDetector**: Foundation class implemented for all exercise analyzers
- **SquatPoseAnalyzer**: Currently being refactored to use BasePoseDetector pattern
- **Exercise Analyzer Pattern**: Established for future multi-exercise support
- **Performance Target**: 30+ FPS real-time processing with Web Workers
- **Data Layer**: Dexie (MVP) → Supabase migration (Post-MVP)

### Module Aliases

- `@/*` maps to `src/*` - Use this for all imports within the src directory

## Key Project Requirements

### Primary Features

1. **Real-time Squat Form Analysis**:

   - Bar path tracking
   - Depth achievement detection
   - Lateral imbalance detection (especially "in the hole")
   - Joint angle measurements
   - Tempo tracking

2. **Design Constraints**:

   - Gym-first UI design (large touch targets, high contrast)
   - Dark mode optimized
   - Works in poor lighting conditions
   - Handles sweaty hands/gym environment

3. **Technical Constraints**:
   - Must use only free-tier services
   - Web-first approach
   - Phone camera based (rear view for MVP)
   - Real-time processing with MediaPipe

### Storage Strategy

**MVP Approach (Current)**:

- **Dexie** (IndexedDB wrapper) for offline-first data storage
- **No backend dependencies** - purely client-side for faster development
- **Local analysis data** stored with reactive updates via dexie-react-hooks

**Post-MVP Migration**:

- **Supabase integration** for multi-device sync and collaboration
- **Data migration path** from Dexie to Supabase with offline-first sync queue
- **Cloudinary** for video storage and optimization
- **Row Level Security** for data privacy and multi-user support

## Performance-First Development

### Critical Performance Requirements

- **30+ FPS target**: All real-time processing must maintain 30+ frames per second
- **< 33ms per frame**: Maximum processing time per frame to maintain target FPS
- **Web Workers**: Use for all ML processing to keep main thread free for UI
- **Memory management**: Bounded arrays (max 30 entries), proper cleanup, object pooling

### MediaPipe Optimization

```typescript
// Optimized MediaPipe configuration for real-time performance
{
  modelAssetPath: 'pose_landmarker_lite.task', // Best balance for real-time
  delegate: 'GPU', // with CPU fallback
  runningMode: 'VIDEO',
  numPoses: 1,
  minPoseDetectionConfidence: 0.7,
  minPosePresenceConfidence: 0.7,
  minTrackingConfidence: 0.7,
  outputSegmentationMasks: false // Not needed, saves processing
}
```

### Performance Monitoring

- **Always measure**: Use PerformanceMonitor for FPS tracking and processing times
- **Performance grades**: Excellent (>30 FPS), Good (25-30), Fair (20-25), Poor (<20)
- **Memory tracking**: Monitor heap usage and detect memory leaks
- **Graceful degradation**: Reduce processing frequency if performance drops

### Web Workers Strategy

```typescript
// Pattern for ML processing in workers
const poseWorker = new Worker('./pose-detection.worker.ts');
const analysisWorker = new Worker('./analysis-calculation.worker.ts');

// Keep main thread free for UI responsiveness
// Process ML in parallel with UI updates
```

## Code Standards

### TypeScript

- Strict mode enabled
- Use type imports: `import type { ... }`
- Define explicit return types for functions
- Use Zod for runtime validation of external data

### React Patterns

- Functional components only
- Use custom hooks for business logic
- Keep components focused and single-purpose
- Implement proper error boundaries

### State Management

- Use Zustand for global state
- Keep stores small and focused
- Use immer for complex state updates if needed

### Testing

**Testing Framework**: Vitest with React Testing Library for component testing

**Core Testing Philosophy**:
Following React Testing Library's principle: "The more your tests resemble the way your software is used, the more confidence they can give you."

**Primary Test Types**:

1. **Component Tests**: Test user-facing behavior through component rendering and interaction
2. **Integration Tests**: Test complete user workflows and business logic flows
3. **Service Tests**: Test data layer and business logic directly (no UI)

**Testing Priorities**:

- ✅ **Test user interactions**: clicking buttons, form submissions, navigation
- ✅ **Test rendered output**: what users see on screen
- ✅ **Test integration workflows**: complete user journeys
- ❌ **Avoid testing implementation details**: hooks in isolation, internal state, component methods

**React Testing Library Patterns**:

- Use `render()` for component testing with user interactions
- Use `screen.getByRole()`, `screen.getByText()` for element queries
- Use `user.click()`, `user.type()` for simulating user actions
- Use `act()` only when testing causes React state updates
- Use `waitFor()` for async operations and state changes
- Focus on accessibility with role-based queries

**Documentation References**:

- Vitest API: https://vitest.dev/api/
- React Testing Library: https://testing-library.com/docs/react-testing-library/intro/
- Testing Library Queries: https://testing-library.com/docs/queries/about
- RTL Philosophy: https://testing-library.com/docs/guiding-principles/

## Working with Project Documentation

### Navigation Guide

- **Current Development**: Use [MVP Implementation Plan](./docs/03_mvp_implementation_plan.md) for immediate tasks
- **Future Planning**: Reference [Post-MVP Roadmap](./docs/04_post_mvp_roadmap.md) for architectural considerations
- **Technology Questions**: Check [Technology Decisions](./docs/technology_decisions.md) for stack choices and rationale
- **Implementation Patterns**: Use [Exercise Analyzer Patterns](./docs/reference/exercise_analyzer_patterns.md) for proven architectures
- **Technical Deep-Dive**: Reference [Pose Detection Analysis](./docs/reference/pose_detection_analysis.md) for TDD methodology

### Documentation Usage Priority

1. **For immediate development tasks**: MVP Implementation Plan
2. **For architecture decisions**: Post-MVP Roadmap "Don't Close Doors" section + Exercise Analyzer Patterns
3. **For technology choices**: Technology Decisions log
4. **For testing methodology**: Pose Detection Analysis TDD guidance

### Development Workflow

#### Task Management

- **Always use TodoWrite tool** for complex multi-step tasks to track progress and provide user visibility
- **Mark tasks as in_progress** before starting work, **completed** immediately when finished
- **Only have one task in_progress** at a time for focused development

#### Architecture Pattern Usage

- **Follow Exercise Analyzer Patterns** for any pose detection/analysis work
- **Reference BasePoseDetector** foundation for consistent implementation
- **Use established confidence calculation patterns** for exercise-specific detection
- **Implement singleton pattern** for analyzer instances (memory efficiency)

#### File Organization

- **Use feature-based structure** for new components (co-locate concerns)
- **Prefer editing existing files** over creating new ones unless explicitly required
- **Use barrel exports** (`index.ts`) for clean module boundaries
- **Never create documentation files** unless explicitly requested

## Code Quality and Linting Standards

### Core Principles

- Always use semantic HTML to improve accessibility and maintainability
- **CRITICAL**: Never disable eslint or TypeScript rules without explicit user approval.
- Use proper error handling patterns with the existing ErrorMonitor service

### TypeScript Best Practices

- **Explicit Typing**: Always use explicit types, avoid `any` and implicit types
- **Error Handling**: Use try/catch blocks with proper error typing (`error instanceof Error`)
- **Nullish Coalescing**: Prefer `??` over `||` for safer null/undefined handling
- **Unused Variables**: Prefix with `_` if unavoidable (e.g., `_error` in catch blocks)
- **Async Functions**: Only use `async` when actually using `await` inside the function

### Imports and Exports

- **Module Boundaries**: Properly type imports and exports, use barrel exports (`index.ts`)
- **Type-only Imports**: Use `import type` for type-only imports

### Error Handling and Logging

- **Never use console.log**: Use the ErrorMonitor service instead

  ```typescript
  // ❌ Don't do this
  console.error('Something failed:', error);

  // ✅ Do this
  errorMonitor.reportError(
    'Description of what failed',
    'custom',
    'high', // severity: low, medium, high, critical
    { context: 'additional context data' },
  );
  ```

- **Error Classifications**:
  - `critical`: System-breaking errors (MediaPipe initialization failure, Web Workers crash)
  - `high`: Feature-breaking errors (camera fails, pose detection stops, performance degradation)
  - `medium`: Recoverable errors (permission issues, network timeouts, confidence drops)
  - `low`: Informational/debugging (successful operations, warnings, frame skips)

### Performance & ML-Specific Error Handling

```typescript
// Performance degradation monitoring
if (frameProcessingTime > 33) {
  errorMonitor.reportError(`Frame processing exceeded 33ms target: ${frameProcessingTime}ms`, 'performance', 'high', {
    processingTime: frameProcessingTime,
    targetFPS: 30,
    currentFPS: performanceMonitor.getCurrentFPS(),
  });
}

// Pose detection confidence monitoring
if (poseConfidence < 0.5) {
  errorMonitor.reportError('Pose detection confidence below threshold', 'pose-detection', 'medium', {
    confidence: poseConfidence,
    threshold: 0.5,
    landmark_count: landmarks.length,
  });
}

// Web Worker communication errors
worker.onerror = (error) => {
  errorMonitor.reportError('Web Worker processing failed', 'worker', 'critical', {
    workerType: 'pose-detection',
    errorMessage: error.message,
    filename: error.filename,
    lineno: error.lineno,
  });
};
```
