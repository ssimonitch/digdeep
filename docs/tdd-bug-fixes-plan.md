# TDD Implementation Plan: Fix UI Flickering During Pose Detection

## Problem Statement

When a pose is not fully detected (user partially in frame), the UI rapidly flickers between showing:

1. Pose landmarks + "Pose Detected" indicator (when valid)
2. "Position yourself in frame" message overlay (when invalid)

This happens because pose validity checks fluctuate around detection thresholds frame-by-frame.

## Solution Overview

Implement a stability-focused approach with hysteresis, debouncing, and improved UI feedback to eliminate flickering while maintaining helpful user guidance.

## Implementation Plan (TDD Approach)

### Phase 1: Add Pose Validity Stabilization Logic

#### 1.1 Create Pose Validity Stabilizer Tests

- [x] Create `src/features/pose-detection/services/__tests__/pose-validity-stabilizer.test.ts`
- [x] Write test: "should enter valid state when confidence exceeds upper threshold"
- [x] Write test: "should exit valid state only when confidence drops below lower threshold"
- [x] Write test: "should maintain current state when confidence is between thresholds (hysteresis)"
- [x] Write test: "should require consistent state for minimum duration before changing"
- [x] Write test: "should handle rapid fluctuations without changing state"
- [x] Write test: "should reset timer when state changes direction"
- [x] Write test: "should provide intermediate 'detecting' state during transition"

#### 1.2 Implement PoseValidityStabilizer Service

- [x] Create `src/features/pose-detection/services/pose-validity-stabilizer.ts`
- [x] Implement hysteresis thresholds (enter: 0.7, exit: 0.5 for visibility)
- [x] Add asymmetric debounce timers (immediate enter, 200ms exit for gym UX)
- [x] Track state history and transitions
- [x] Implement three-state system: 'invalid', 'detecting', 'valid'
- [x] Make all tests pass

#### 1.3 Integration with SquatPoseAnalyzer Tests

- [x] Add tests to `squat-pose-analyzer.service.test.tsx` for stabilized validity
- [x] Write test: "should use stabilized pose validity for isValidPose"
- [x] Write test: "should maintain pose validity during brief detection drops"
- [x] Write test: "should transition through detecting state"

#### 1.4 Integrate Stabilizer into SquatPoseAnalyzer

- [x] Add PoseValidityStabilizer instance to SquatPoseAnalyzer
- [x] Replace direct validity checks with stabilized checks
- [x] Update `isValidSquatPose` to use stabilizer
- [x] Ensure backward compatibility with existing API
- [x] Make all tests pass

### Phase 2: Update UI Components for Smooth Transitions

#### 2.1 Update PoseLandmarkOverlay Tests

- [x] Add tests to `PoseLandmarkOverlay.test.tsx` for new visibility states
- [x] Write test: "should render landmarks with full opacity when pose is valid"
- [x] Write test: "should render landmarks with reduced opacity when pose is invalid"
- [x] Write test: "should render landmarks with medium opacity in detecting state"
- [x] Write test: "should use appropriate colors for each detection state"
- [x] Write test: "should smoothly transition between states"
- [x] Write test: "should maintain backward compatibility when detectionState is not provided"

#### 2.2 Enhance PoseLandmarkOverlay Component

- [x] Add `detectionState: 'invalid' | 'detecting' | 'valid'` prop
- [x] Implement opacity levels: invalid (0.3), detecting (0.6), valid (1.0)
- [x] Update color scheme: invalid (red), detecting (yellow), valid (green)
- [x] Add CSS transitions for smooth visual changes
- [x] Maintain backward compatibility with `isValidPose` flag
- [x] Make all tests pass

#### 2.3 Update ActiveAnalysisScreen Integration Tests

- [x] Add integration tests to `ActiveAnalysisScreen.test.tsx`
- [x] Write test: "should always show pose overlay when analyzing"
- [x] Write test: "should show guidance message without hiding landmarks"
- [x] Write test: "should transition smoothly between detection states"
- [x] Write test: "should show specific body part guidance based on visibility"
- [x] Write test: "should not flicker during rapid state changes"

#### 2.4 Refactor ActiveAnalysisScreen UI Logic

- [x] Always render PoseLandmarkOverlay when analyzing (remove isValidPose condition)
- [x] Pass detection state to PoseLandmarkOverlay
- [x] Make guidance overlay semi-transparent and less intrusive
- [x] Position guidance message to not obstruct pose view
- [x] Add smooth fade transitions for UI elements
- [x] Make all integration tests pass

### Phase 3: Improve User Feedback

#### 3.1 Create Enhanced Feedback Component Tests

- [x] Create `PoseGuidanceOverlay.test.tsx`
- [x] Write test: "should show general guidance when no specific issues detected"
- [x] Write test: "should prioritize most critical missing body parts"
- [x] Write test: "should update guidance based on landmark visibility"
- [x] Write test: "should show confidence percentage"
- [x] Write test: "should use appropriate styling for each state"

#### 3.2 Implement PoseGuidanceOverlay Component

- [x] Create new component for pose detection guidance
- [x] Show continuous confidence indicator (progress bar)
- [x] Implement smart guidance messages based on missing landmarks
- [x] Add progressive disclosure (more detail if pose remains invalid)
- [x] Use non-intrusive positioning and styling
- [x] Make all tests pass

#### 3.3 Integrate Enhanced Feedback

- [x] Replace existing pose validity UI in ActiveAnalysisScreen
- [x] Connect to stabilized detection state
- [x] Ensure smooth transitions between all states
- [x] Verify no flickering in edge cases

### Phase 4: Performance & Edge Case Testing

#### 4.1 Performance Tests

- [ ] Add performance test: "stabilizer should not impact frame processing time"
- [ ] Add performance test: "UI transitions should not cause frame drops"
- [ ] Add memory test: "stabilizer should not accumulate memory over time"

#### 4.2 Edge Case Tests

- [ ] Test rapid camera movement scenarios
- [ ] Test partial body visibility cases
- [ ] Test poor lighting conditions
- [ ] Test transition between multiple users
- [ ] Test camera permission changes during analysis

### Phase 5: Documentation & Cleanup

#### 5.1 Update Documentation

- [x] Document new detection states in component interfaces
- [x] Add JSDoc comments for stabilizer configuration
- [x] Update CLAUDE.md with new pose detection behavior
- [x] Add examples of handling detection states

#### 5.2 Code Cleanup

- [x] Remove any temporary debugging code
- [x] Ensure consistent naming conventions
- [x] Verify all TypeScript types are properly defined
- [x] Run full test suite and fix any regressions
- [x] Run lint and fix any issues

## Testing Strategy

### Unit Tests

- PoseValidityStabilizer: Core stabilization logic
- PoseLandmarkOverlay: Visual state rendering
- PoseGuidanceOverlay: Feedback message logic

### Integration Tests

- ActiveAnalysisScreen: Full workflow with stabilized detection
- useSquatAnalysis: Hook behavior with new states

### Performance Tests

- Frame processing time with stabilization
- Memory usage over extended sessions
- UI rendering performance with transitions

### Manual Testing Checklist

- [ ] Test with actual camera in various lighting conditions
- [ ] Verify smooth transitions when moving in/out of frame
- [ ] Check guidance messages are helpful and accurate
- [ ] Ensure no regression in pose detection accuracy
- [ ] Test on different devices and browsers

## Success Criteria

1. **No UI Flickering**: Stable UI even with borderline pose detection
2. **Smooth Transitions**: All state changes use smooth animations
3. **Better User Guidance**: Clear, specific feedback about pose issues
4. **Performance Maintained**: No impact on 30+ FPS target
5. **Backward Compatible**: Existing API contracts maintained

## Implementation Order

1. Start with Phase 1 (core stabilization logic) - highest impact
2. Then Phase 2 (UI updates) - visible improvement
3. Follow with Phase 3 (enhanced feedback) - better UX
4. Complete Phase 4 & 5 (testing & cleanup) - quality assurance

## Notes

- Follow TDD strictly: Write failing tests first, then implement
- Each TODO should result in a focused, single-purpose commit
- Run tests frequently to catch regressions early
- Consider feature flag for A/B testing the new behavior
