# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is DigDeep, a web-based powerlifting form analysis application that uses machine learning for real-time feedback and training progress tracking. The project is designed for personal use as both a learning project and training tool, using only free-tier services.

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
pnpm tsc --noEmit
```

## Architecture Overview

### Tech Stack
- **Frontend Framework**: React 19.1.0 with TypeScript 5.8.3
- **Build Tool**: Vite 7.0.0 with SWC for fast compilation
- **Styling**: Tailwind CSS 4.1.10
- **State Management**: Zustand 5.0.5
- **ML/Pose Detection**: MediaPipe Pose (to be integrated)
- **Backend**: Supabase (auth + database + storage) (to be integrated)
- **Video Storage**: Cloudinary (to be integrated)

### Project Structure
```
src/
├── components/       # React components
├── stores/          # Zustand state stores
├── hooks/           # Custom React hooks
├── utils/           # Utility functions
├── types/           # TypeScript type definitions
└── styles/          # CSS and styling files
```

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
   - Web-first approach (PWA capabilities)
   - Phone camera based (rear view for MVP)
   - Real-time processing with MediaPipe

### Component Library
The project has detailed component specifications in `docs/02_component_library_spec.md`. Key components include:
- Button (Primary, Secondary, Ghost variants)
- Card components
- Form controls optimized for gym use
- Feedback components (BalanceMeter, DepthIndicator)
- Video components (VideoRecorder, VideoPlayer)

### Development Phases
- **Phase 1 (MVP)**: Basic recording, pose detection, real-time feedback
- **Phase 2**: Workout logging, volume progression, bench & deadlift analysis
- **Phase 3**: Multi-angle recording, custom ML models, fatigue detection

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
- Use Vitest for unit and integration tests
- Test files should be colocated with components (`.test.tsx`)
- Focus on user behavior over implementation details

## Important Notes

1. **MediaPipe Integration**: When implementing pose detection, ensure proper cleanup of camera streams and MediaPipe resources to prevent memory leaks.

2. **Performance**: The app must maintain 30+ FPS during recording with pose detection. Use React.memo, useMemo, and useCallback appropriately.

3. **Mobile-First**: All UI decisions should prioritize mobile usability, especially in gym conditions (one-handed operation, glove-friendly).

4. **Free Tier Limits**: Be mindful of:
   - Cloudinary: 25GB storage
   - Supabase: Database row limits
   - Vercel/Netlify: Build minutes and bandwidth

5. **Privacy**: This is a personal project, but implement proper data handling practices as it deals with video recordings of workouts.

## Code Quality

- Always use semantic HTML to improve accessibility and maintainability