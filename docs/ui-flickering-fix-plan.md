# UI Flickering Fix Plan - Multi-Expert Analysis

## Executive Summary

The flickering issue in `PoseGuidanceOverlay` and debug code is caused by **unoptimized React re-renders at 30+ FPS** combined with **missing pose detection stabilization**. The test passes because it uses static mock data instead of testing real-time performance constraints.

## Root Cause Analysis

### Primary Issues

1. **Missing Stabilization Logic**: The `PoseValidityStabilizer` class exists but **isn't being used** in production
2. **Excessive Re-renders**: 60+ state updates per second (2 per frame) causing UI flickering
3. **Unoptimized React Patterns**: Inline calculations, missing memoization, unstable object references
4. **Inadequate Testing**: Test uses static mocks instead of realistic confidence fluctuations

### Performance Impact

- **Current**: ~60 React renders/second during analysis
- **Target**: 30+ FPS with stable UI transitions
- **User Experience**: Rapid color/text changes causing visual discomfort

---

## Implementation Plan

### Phase 1: Integrate Pose Detection Stabilization

**Priority: Critical**

#### Task 1.1: Implement Stabilized Detection State Hook

- Create `useStabilizedDetectionState` hook that uses the existing `PoseValidityStabilizer`
- Configure with hysteresis thresholds (0.7 enter, 0.5 exit) and 200ms debouncing
- Replace hardcoded detection state logic in `ActiveAnalysisScreen.tsx:187,195`

#### Task 1.2: Add Performance Monitoring

- Monitor state change frequency and log if exceeding 5 changes/second
- Use existing `ErrorMonitor` service for performance degradation alerts
- Add debugging info for stabilization effectiveness

### Phase 2: React Performance Optimization

**Priority: High**

#### Task 2.1: Memoize Detection State Calculations

- Extract inline ternary expressions into `useMemo` hooks
- Create stable object references for `detectionState` prop
- Add shallow comparison for complex props

#### Task 2.2: Optimize Component Re-rendering

- Add `React.memo` to `PoseGuidanceOverlay` with proper prop comparison
- Add `React.memo` to `PoseLandmarkOverlay` component
- Use `useCallback` for stable function references

#### Task 2.3: Batch State Updates

- Consolidate multiple state updates in camera effects (lines 56-101, 104-121)
- Implement debouncing for `displayDimensions` updates (16ms max frequency)
- Use React's automatic batching for related state changes

### Phase 3: Debug Code Optimization

**Priority: Medium**

#### Task 3.1: Optimize Debug Info Rendering

- Memoize debug calculations (display dimensions, landmark count)
- Add localhost-only rendering guard with minimal re-render impact
- Consider removing or conditionally rendering debug overlay

#### Task 3.2: Improve CSS Transitions

- Increase transition duration from 300ms to 500ms for better stability
- Add `ease-in-out` timing for smoother visual transitions
- Prevent transition interruptions during rapid state changes

### Phase 4: Testing Strategy Overhaul

**Priority: Medium**

#### Task 4.1: Fix Flickering Test

- Replace static mock data with realistic confidence value streams
- Test borderline confidence values (0.48-0.72) that cause real flickering
- Add timing-based assertions and visual transition counting

#### Task 4.2: Add Performance Regression Tests

- Create tests that measure component re-render frequency
- Add tests for stabilization logic under high-frequency updates
- Implement UI flicker detection utilities for automated testing

#### Task 4.3: Integration Testing

- Test real `PoseValidityStabilizer` integration with various confidence patterns
- Verify smooth state transitions without visual artifacts
- Add stress testing for 30+ FPS performance requirements

---

## Technical Analysis Details

### Frontend Engineering Perspective

**Root Cause**: Excessive re-renders triggered at 30+ FPS with multiple unoptimized React patterns:

1. **Unoptimized Inline Calculations** (Lines 187, 195)

   - `detectionState` calculation runs on every render
   - Creates new object identity every frame, causing child component re-renders

2. **Multiple State Updates**

   - Results in 2 state updates per 30ms frame = 60 state updates/second

3. **Missing React Optimizations**

   - `PoseGuidanceOverlay` not memoized
   - No `useMemo` for expensive calculations
   - No `useCallback` for stable references

4. **displayDimensions Rapid Updates**
   - ResizeObserver triggers state updates even for micro-pixel changes
   - No debouncing on dimension updates

### React Engineering Perspective

**Component Lifecycle Issues**:

- Inline object/function creation in JSX causing prop drilling re-renders
- State updates in multiple useEffect hooks causing race conditions
- Missing component memoization and hook optimization opportunities
- Hook dependencies causing unnecessary effect triggers

**State Management Efficiency Problems**:

- Rapid confidence value changes (0.68, 0.72, 0.48, 0.71...) causing immediate state switches
- No use of existing `PoseValidityStabilizer` for smooth transitions
- Direct threshold comparison without hysteresis

### QC Engineering Perspective

**Why Test Passes Despite Flickering**:

1. **Static Mock Data**: Test uses `vi.mocked(useSquatAnalysis).mockReturnValue(updatedMock)` with completely static snapshots
2. **No Real-Time Processing**: Missing actual MediaPipe processing and frame-by-frame analysis
3. **Synchronous State Changes**: Test executes changes synchronously, missing asynchronous nature
4. **Extreme Mock Values**: Uses 90% or 30% confidence instead of realistic borderline values (48-72%)

**Test Should Verify**:

- Visual transition counts and state change frequency
- CSS class stability and progress bar smoothing
- Performance under realistic confidence fluctuations
- Integration with actual stabilization logic

---

## Expected Outcomes

### Performance Improvements

- **Render Frequency**: Reduce from 60/sec to 30/sec (aligned with target FPS)
- **Visual Stability**: Eliminate rapid color/text changes through stabilization
- **Memory Usage**: Reduce object creation in render cycles
- **Processing Time**: Maintain <33ms per frame target

### User Experience

- **Smooth Transitions**: Stable pose detection feedback without flickering
- **Reliable Guidance**: Consistent messaging during pose adjustments
- **Professional Feel**: Polished real-time analysis interface

### Code Quality

- **Test Coverage**: Accurate flickering detection and performance regression tests
- **Performance Monitoring**: Proactive detection of UI performance issues
- **React Best Practices**: Optimized component patterns and stable prop handling

---

## Implementation Notes

### Dependencies Required

- Existing `PoseValidityStabilizer` class (already implemented)
- React optimization patterns (memo, useMemo, useCallback)
- Performance monitoring via existing `ErrorMonitor` service

### Risk Mitigation

- **Gradual Rollout**: Implement stabilization first, then React optimizations
- **Performance Testing**: Monitor FPS during implementation to prevent regressions
- **User Feedback**: Validate smooth transitions with real pose detection scenarios

### Success Metrics

- Zero visible flickering during pose detection transitions
- Maintain 30+ FPS performance target
- Reliable test coverage that catches future regressions
- User-reported stability improvements

---

## Code Examples

### Current Problem Code

```typescript
// ActiveAnalysisScreen.tsx:187,195 - Causes flickering
detectionState={metrics.isValidPose ? 'valid' : metrics.confidence > 0.5 ? 'detecting' : 'invalid'}
```

### Proposed Solution

```typescript
// New stabilized hook
const detectionState = useStabilizedDetectionState(metrics.confidence, metrics.isValidPose);

// Memoized for stable references
const stableDetectionState = useMemo(() => detectionState, [detectionState]);
```

### Test Improvement Example

```typescript
// Replace static values with realistic confidence streams
const realisticConfidenceStream = [0.68, 0.72, 0.48, 0.71, 0.49, 0.73, 0.47, 0.69, 0.51, 0.74];

// Test actual visual transition counting
expect(flickerDetector.getTransitionCount()).toBeLessThan(3);
expect(flickerDetector.hasRapidFlickering(100)).toBe(false);
```

---

## References

- **Performance Target**: 30+ FPS (33ms per frame)
- **Related Files**:
  - `src/features/analysis/components/ActiveAnalysisScreen.tsx`
  - `src/features/analysis/components/PoseGuidanceOverlay.tsx`
  - `src/features/analysis/components/__tests__/ActiveAnalysisScreen.test.tsx`
  - `src/features/pose-detection/services/pose-validity-stabilizer.ts`
- **Documentation**: See MVP Implementation Plan for architectural context
