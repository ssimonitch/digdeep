# UI Flickering Refactoring Plan

## Overview

This document outlines the refactoring strategy to fix UI flickering in the `ActiveAnalysisScreen` component caused by rapid re-renders from frequently updating values in the `useSquatAnalysis` hook.

## Problem Summary

The following values from `useSquatAnalysis` are causing rapid re-renders:

- `analysis` - Updates on every frame (30 FPS)
- `metrics` - Updates frequently with pose detection data
- `fps` - Updates frequently with performance metrics
- `processingTime` - Updates on every frame

This causes the entire `ActiveAnalysisScreen` component to re-render 30+ times per second, leading to UI flickering.

## Quality Assurance Requirements

**At each phase of implementation:**

1. Run `pnpm lint` - All linting must pass
2. Run `pnpm typecheck` - TypeScript compilation must succeed
3. Run `pnpm test` - All tests must pass
   - If tests fail, add a TODO comment explaining why and plan to fix later
   - Document any temporarily disabled tests

## Phase 1: Immediate Component Optimization (Quick Fix)

### 1.1 Split ActiveAnalysisScreen into focused sub-components

Create the following new components:

- `VideoFeedSection` - Camera feed and overlays
- `StatsGrid` - Rep count, depth, balance, FPS display
- `ControlsSection` - Start/stop/reset buttons
- `AnalysisStatus` - Session status information

Each component will only receive the props it needs.

### 1.2 Optimize sub-components with React.memo

- Add `React.memo` to each extracted component
- Implement custom comparison functions where needed
- Throttle updates for non-critical UI elements (e.g., FPS display)

### 1.3 Implement selective data passing

- Pass only required data to each sub-component
- Avoid passing entire objects when only specific fields are needed
- Use primitive values instead of objects where possible

### 1.4 Quality Checks

```bash
pnpm lint
pnpm typecheck
pnpm test
```

## Phase 2: Zustand Store Implementation (Proper Solution)

### 2.1 Create Zustand store structure

Create the following file structure:

```
src/stores/
└── analysis/
    ├── index.ts
    ├── analysis.store.ts
    └── analysis.types.ts
```

### 2.2 Implement store slices

The store will have four main slices:

#### Realtime Slice (30 FPS updates)

- `landmarks`: Pose landmark data
- `confidence`: Detection confidence
- `detectionState`: Current detection state

#### Display Slice (Throttled to 5 FPS)

- `currentRep`: Rep count
- `depthPercentage`: Squat depth
- `isBalanced`: Balance status
- `repPhase`: Current rep phase

#### Performance Slice (1 FPS updates)

- `fps`: Current frames per second
- `processingTime`: Frame processing time

#### Control Slice (On-demand updates)

- `isAnalyzing`: Analysis active state
- `isInitialized`: Initialization status
- `error`: Error messages

### 2.3 Update useExerciseAnalysis hook

- Integrate with Zustand store instead of local state
- You do NOT need to keep existing API for backward compatibility. It should be removed.
- Update store slices at appropriate frequencies using throttling

### 2.4 Refactor components to use store

- Components subscribe to specific store slices using Zustand selectors
- Remove prop drilling through the component tree
- Each component only re-renders when its subscribed slice updates

### 2.5 Quality Checks

```bash
pnpm lint
pnpm typecheck
pnpm test
```

## Expected Results

- **Pose overlays**: Smooth 30 FPS updates without affecting other UI
- **Stats display**: Stable updates without flickering (5 FPS)
- **Performance metrics**: Update once per second
- **Control buttons**: Only re-render on state changes

## Implementation Notes

1. **Performance Monitoring**: Use React DevTools Profiler to verify rendering improvements
2. **Test Coverage**: Add tests for the new store and throttling behavior
3. **Documentation**: Update component documentation with new architecture

## Implementation Results

### MediaPipe Flickering Fix (Pre-Phase 1)

Before implementing Phase 1, we discovered and fixed the root cause of the flickering:

**Problem**: MediaPipe was reporting very low visibility values (0.01-0.1) for landmarks that weren't actually present, causing rapid flickering between 0 and low values.

**Solution Implemented**:

1. Added `NOISE_FLOOR_THRESHOLD = 0.1` constant to `SquatPoseAnalyzer`
2. Updated `calculateConfidence()` to filter out visibility values below threshold
3. Updated `calculateKeyLandmarkVisibility()` to apply the same filtering

**Quality Check Results**:

- ✅ `pnpm lint` - Passed with no errors
- ✅ `pnpm typecheck` - Passed with no errors
- ✅ `pnpm test` - All 681 tests passed (2 skipped)

This fix eliminates the flickering at the source, preventing the rapid value changes that were causing unnecessary re-renders.

### Phase 1 Implementation Results

Phase 1 was successfully implemented with the following components:

1. **VideoFeedSection** - Isolated camera feed and pose overlays
2. **StatsGrid** - Separated metrics display with throttled FPS updates
3. **ControlsSection** - Isolated control buttons
4. **AnalysisStatus** - Separated status information with throttled processing time

**Quality Check Results**:

- ✅ `pnpm lint` - Passed with no errors
- ✅ `pnpm typecheck` - Passed with no errors
- ✅ `pnpm test` - All 681 tests passed (2 skipped)

## TODOs for Test Failures

If any tests fail during implementation, document them here:

- [ ] Test name: `<test description>` - Reason: `<why it fails>` - Fix: `<how to fix>`

## Success Metrics

- ActiveAnalysisScreen renders < 10 times per second (down from 30+)
- No visible UI flickering in stats display
- Pose overlay maintains smooth 30 FPS updates
- All existing functionality preserved
