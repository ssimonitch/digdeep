# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is DigDeep, a web-based powerlifting form analysis application that uses machine learning for real-time feedback and training progress tracking. 

### Project Goals

- Designeded for personal use as both a learning project and powerlifting training tool
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
├── components/              # Shared UI components
├── features/               # Feature modules with co-located concerns
├── shared/                 # Cross-cutting concerns
├── services/               # Infrastructure integrations
└── workers/                # High-performance Web Workers
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
   - Web-first approach
   - Phone camera based (rear view for MVP)
   - Real-time processing with MediaPipe

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

**Core Principles**:
- Use Vitest for unit and integration tests
- Test files should be colocated with components (`.test.tsx`)
- Focus on user behavior over implementation details
- Test what the user sees and does, not internal component state

**React Testing Library Patterns**:
- Use `renderHook()` for custom hook testing
- Use `act()` for actions that trigger state updates
- Use `waitFor()` for async operations and state changes
- Use `screen.getByRole()`, `screen.getByText()` for component queries
- Avoid testing implementation details (internal state, component methods)

**Mock Patterns**:
- Use `vi.mock()` for module mocking
- Create test-specific service instances for isolation
- Use `createMock*` utilities from `@/test/test-utils` for consistent test data

**Error Testing**:
- Use try/catch blocks instead of `expect().rejects.toThrow()` to avoid race conditions
- Test error states through user interactions, not direct error throwing

**Documentation References**:
- Vitest API: https://vitest.dev/api/
- React Testing Library: https://testing-library.com/docs/react-testing-library/intro/
- Testing Library Queries: https://testing-library.com/docs/queries/about

**Test Organization**:
- Group related tests with `describe()` blocks
- Use descriptive test names that explain user scenarios
- Keep setup/teardown in `beforeEach()`/`afterEach()` hooks

## Feature Implementation System Guidelines

### Feature Implementation Priority Rules
- IMMEDIATE EXECUTION: Launch parallel Tasks immediately upon feature requests
- NO CLARIFICATION: Skip asking what type of implementation unless absolutely critical
- PARALLEL BY DEFAULT: Always use 7-parallel-Task method for efficiency

### Parallel Feature Implementation Workflow
1. **Component**: Create main component file
2. **Styles**: Create component styles/CSS
3. **Tests**: Create test files  
4. **Types**: Create type definitions
5. **Hooks**: Create custom hooks/utilities
6. **Integration**: Update routing, imports, exports
7. **Remaining**: Update package.json, documentation, configuration files
8. **Review and Validation**: Coordinate integration, run tests, verify build, check for conflicts

### Context Optimization Rules
- Strip out all comments when reading code files for analysis
- Each task handles ONLY specified files or file types
- Task 7 combines small config/doc updates to prevent over-splitting

### Feature Implementation Guidelines
- **CRITICAL**: Make MINIMAL CHANGES to existing patterns and structures
- **CRITICAL**: Preserve existing naming conventions and file organization
- Follow project's established architecture and component patterns
- Use existing utility functions and avoid duplicating functionality

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

## Code Quality and Linting Standards

### ESLint and TypeScript Rule Management

**CRITICAL**: Never disable eslint or TypeScript rules without explicit user approval.

#### Process for Handling Linting/TypeScript Errors:

1. **First Attempt**: Research appropriate documentation to understand why the error is occurring
2. **Second Attempt**: Look for proper TypeScript patterns or alternative approaches that satisfy the linting rules
3. **Third Attempt**: Investigate if there's a configuration issue or if the rule is incorrectly applied
4. **Only if no solution exists**: 
   - Explain the issue to the user
   - Propose the specific rule disable with justification
   - Request explicit permission before adding any `eslint-disable` comments
   - Provide the reasoning why the disable is necessary

**Remember**: The goal is to write type-safe, maintainable code that follows project standards, not to bypass them.