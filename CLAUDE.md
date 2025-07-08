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

**Service Layer Testing**:
- Test services directly for business logic validation
- Create test-specific database instances for isolation
- Use `createMock*` utilities from `@/test/test-utils` for consistent test data
- Test error handling through service methods, not UI

**Mock Patterns**:
- Minimize mocking - prefer real implementations when possible
- Use `vi.mock()` only for external dependencies (APIs, third-party libraries)
- Mock at the service boundary, not internal application code
- Create integration test databases instead of mocking data access

**Error Testing**:
- Test error states through user interactions that trigger errors
- Use try/catch blocks instead of `expect().rejects.toThrow()` to avoid race conditions
- Test error messages and recovery flows that users actually experience

**Test Structure**:
```typescript
// ✅ Good - Test user behavior
it('should display error when form submission fails', async () => {
  render(<WorkoutForm />);
  await user.click(screen.getByRole('button', { name: /save/i }));
  expect(screen.getByText(/failed to save workout/i)).toBeInTheDocument();
});

// ❌ Avoid - Testing implementation details
it('should call useWorkoutSessions hook with correct params', () => {
  const { result } = renderHook(() => useWorkoutSessions('user-1'));
  // This tests how the code works, not what the user experiences
});
```

**Documentation References**:
- Vitest API: https://vitest.dev/api/
- React Testing Library: https://testing-library.com/docs/react-testing-library/intro/
- Testing Library Queries: https://testing-library.com/docs/queries/about
- RTL Philosophy: https://testing-library.com/docs/guiding-principles/

**Test Organization**:
- Group related tests with `describe()` blocks using user-centric descriptions
- Use descriptive test names that explain user scenarios, not technical operations
- Keep setup/teardown in `beforeEach()`/`afterEach()` hooks
- Colocate tests with components (`.test.tsx`) for component tests
- Place integration tests in `@/test/` directory for cross-feature workflows

## Feature Implementation System Guidelines

### Feature Implementation Priority Rules
- IMMEDIATE EXECUTION: Launch parallel Tasks immediately upon feature requests
- PARALLEL BY DEFAULT: Always use 7-parallel-Task method for efficiency

### Parallel Feature Implementation Workflow
1. **Component**: Create main component file
2. **Tests**: Create test files  
3. **Types**: Create type definitions
4. **Hooks**: Create custom hooks/utilities
5. **Integration**: Update routing, imports, exports
6. **Remaining**: Update package.json, documentation, configuration files
7. **Review and Validation**: Coordinate integration, run tests, verify build, check for conflicts

### Context Optimization Rules
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

## Code Quality and Linting Standards

### Core Principles
- Always use semantic HTML to improve accessibility and maintainability
- **CRITICAL**: Never disable eslint or TypeScript rules without explicit user approval.
- Maintain strict TypeScript typing - avoid `any` types in production code
- Use proper error handling patterns with the existing ErrorMonitor service

### TypeScript Best Practices
- **Explicit Typing**: Always use explicit types, avoid `any` and implicit types
- **Error Handling**: Use try/catch blocks with proper error typing (`error instanceof Error`)
- **Nullish Coalescing**: Prefer `??` over `||` for safer null/undefined handling
- **Unused Variables**: Prefix with `_` if unavoidable (e.g., `_error` in catch blocks)
- **Async Functions**: Only use `async` when actually using `await` inside the function

### Imports and Exports
- **Import Sorting**: Use simple-import-sort ESLint rule - exports before imports, alphabetical
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
    { context: 'additional context data' }
  );
  ```
- **Error Classifications**: 
  - `critical`: System-breaking errors
  - `high`: Feature-breaking errors (camera fails, API errors)
  - `medium`: Recoverable errors (permission issues, network)
  - `low`: Informational/debugging (successful operations, warnings)

### Test File Patterns
- **Mock Types**: Create proper TypeScript interfaces for mocks instead of using `any`
- **Test Utilities**: Use typed test utility functions from `@/test/test-utils`
- **Method Binding**: Use arrow functions or `.bind()` for method references in tests
- **Empty Functions**: Replace empty arrow functions with meaningful implementations

### Common Error Prevention
1. **Unbound Methods**: Wrap method references in arrow functions or use `.bind()`
2. **Floating Promises**: Always handle promises with `await`, `.catch()`, or `void` keyword
3. **Unsafe Type Operations**: Use type guards and proper typing instead of `as any`
4. **Template Literals**: Ensure all template literal expressions are strings or convertible

### Code Organization
- **Feature-based Structure**: Keep related code co-located in feature directories
- **Separation of Concerns**: Services for business logic, hooks for React state, components for UI
- **Index Files**: Use barrel exports to create clean module boundaries
