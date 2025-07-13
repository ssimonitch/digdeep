# DigDeep MVP Implementation Plan

## MVP Goal

**Deliver a working real-time squat analysis app that provides immediate form feedback during training.**

> **Note**: See [Post-MVP Roadmap](./post_mvp_roadmap.md) for architectural considerations and future features. The "Don't Close Doors" section provides critical guidance for MVP development.

### Success Criteria

- User can start camera and see live pose overlay
- Real-time depth detection (hip below knee)
- Real-time balance analysis (lateral shift)
- Visual feedback through UI components
- Maintains 30+ FPS performance
- Works reliably in gym lighting conditions

## Foundation Complete ✅

The following foundation work is already complete and ready to build on:

### Infrastructure

- React 19.1.0 with TypeScript 5.8.3 setup
- Vite 7.0.0 with performance optimization
- Dexie storage layer for offline data
- Performance monitoring system
- Error monitoring and reporting

### Core Services

- Camera management (useCamera hook)
- MediaPipe pose detection (OptimizedPoseDetector)
- Base utilities (LandmarkCalculator, PerformanceMonitor, LandmarkValidator)
- BasePoseDetector class extracted

### UI Components

- Button system (all variants)
- Card components
- Input components
- Home screen layout

## Technical Implementation Guide

> **Detailed Reference**: See [Pose Detection Analysis](./reference/pose_detection_analysis.md) for comprehensive TDD methodology, interface definitions, and architectural guidance.

### MediaPipe Configuration for Squats

Use these optimized settings for real-time squat analysis:

```typescript
{
  modelAssetPath: 'pose_landmarker_lite.task', // Best balance for real-time
  delegate: 'GPU', // with CPU fallback
  runningMode: 'VIDEO',
  numPoses: 1,
  minPoseDetectionConfidence: 0.7, // Higher for exercise analysis
  minPosePresenceConfidence: 0.7,
  minTrackingConfidence: 0.7,
  outputSegmentationMasks: false // Not needed for form analysis
}
```

### Critical Landmark Numbers

Essential landmarks for squat analysis:

- **Shoulders**: 11, 12 (bar position tracking)
- **Hips**: 23, 24 (depth reference points)
- **Knees**: 25, 26 (depth calculation)
- **Ankles**: 27, 28 (stability base)

### Squat Analysis Methodology

#### Depth Detection

- **Method**: Hip crease below knee cap (hip-to-knee Y-coordinate comparison)
- **Calculation**: Y-coordinate comparison between hip and knee landmarks
- **Output**: Depth percentage (0-100% where 100% = hip below knee)
- **Threshold**: 90% depth achievement for successful rep

#### Bar Path Tracking

- **Method**: Shoulder midpoint tracking (average of landmarks 11, 12)
- **Measurement**: Vertical deviation from ideal straight path
- **Storage**: Position history for current rep analysis

#### Lateral Shift Detection

- **Method**: Bilateral comparison of hip/knee positions
- **Detection**: Maximum deviation at bottom position
- **Threshold**: < 5% of hip width for acceptable balance

### Performance Requirements

- Maintain 30+ FPS processing
- < 33ms per frame analysis
- Cache angle calculations between frames
- Use single MediaPipe instance

## MVP Implementation Steps

### Phase 1: Core Analysis Engine

#### Step 1.1: Complete Pose Detection Refactoring

> **Implementation Guide**: See [Pose Detection Analysis Phase 1.6](./reference/pose_detection_analysis.md#16-refactor-squatposeanalyzer) for detailed TDD approach and testing requirements.
>
> **Architecture Patterns**: Follow [Exercise Analyzer Patterns](./reference/exercise_analyzer_patterns.md) for proven constructor patterns, confidence calculation overrides, and testing methodologies.

- [x] Finish refactoring SquatPoseAnalyzer to use BasePoseDetector
- [x] Verify all tests pass and no performance regression
- [x] Remove duplicated detection logic

#### Step 1.2: Implement Squat Metrics

- [x] **Depth Detection**
  - [x] Calculate hip-to-knee Y-coordinate comparison
  - [x] Implement depth percentage (0-100% where 100% = hip below knee)
  - [x] Add depth achievement threshold (configurable, default 90%)
- [x] **Balance Analysis**
  - [x] Calculate lateral shift between left/right hip positions
  - [x] Detect maximum shift at bottom position
  - [x] Define acceptable shift threshold (e.g., < 5% of hip width)

#### Step 1.3: Bar Path & Rep Counting

- [ ] **Bar Path Tracking**
  - [ ] Track shoulder midpoint (landmarks 11, 12)
  - [ ] Store position history for current rep
  - [ ] Calculate vertical deviation from starting position
- [ ] **Rep Counting**
  - [ ] Implement state machine (standing → descending → bottom → ascending → standing)
  - [ ] Detect rep completion when returning to standing
  - [ ] Track rep quality based on depth and balance

#### Step 1.4: Integration & Testing

- [ ] Create `useSquatAnalysis` hook combining all metrics
- [ ] Test with mock data and real camera input
- [ ] Verify 30+ FPS performance maintained

### Phase 2: Active Analysis Screen & UI

#### Step 2.1: Active Analysis Screen

- [ ] Create `ActiveAnalysisScreen` component
- [ ] Integrate camera feed display
- [ ] Add pose landmark overlay visualization
- [ ] Implement navigation from Home screen

#### Step 2.2: Analysis Controls

- [ ] Add Start/Stop analysis button
- [ ] Create analysis state management (idle, analyzing, paused)
- [ ] Implement rep counter display
- [ ] Add pose confidence indicator

#### Step 2.3: Real-Time Feedback Components

- [ ] **BalanceMeter Component**
  - [ ] Horizontal bar with center line
  - [ ] Animated indicator showing lateral shift
  - [ ] Color coding: green (good), yellow (warning), red (critical)
- [ ] **DepthIndicator Component**
  - [ ] Circular progress arc (0-100%)
  - [ ] Animated fill as user descends
  - [ ] Success pulse animation at target depth
  - [ ] Numeric percentage display option

#### Step 2.4: Integration & Polish

- [ ] Connect analysis data to UI components
- [ ] Add smooth animations and transitions
- [ ] Implement error states and recovery
- [ ] Final testing in various lighting conditions

### Phase 3: Testing & Refinement

#### Step 3.1: Gym Testing

- [ ] Test in actual gym environment
- [ ] Verify pose detection accuracy
- [ ] Check UI visibility under gym lighting
- [ ] Gather initial user feedback

#### Step 3.2: Performance Optimization

- [ ] Profile and optimize any bottlenecks
- [ ] Ensure consistent 30+ FPS
- [ ] Minimize memory usage
- [ ] Add performance guards

#### Step 3.3: Bug Fixes & Polish

- [ ] Fix issues found during testing
- [ ] Improve error messages
- [ ] Add helpful onboarding hints
- [ ] Final UI polish

#### Step 3.4: MVP Complete 🎉

- [ ] Deploy to test environment
- [ ] Document known limitations
- [ ] Create feedback collection mechanism

## Post-MVP Development

After MVP completion, see the comprehensive [Post-MVP Roadmap](./post_mvp_roadmap.md) for:

- **Architecture Evolution** - Strategy pattern, plugin system, performance optimization
- **Recording & Playback** - Video recording, analysis overlay, session management
- **Multi-Exercise Support** - Bench press, deadlift, overhead press analysis
- **Backend Integration** - Supabase auth, cloud sync, multi-device support
- **Advanced Features** - AI coaching, social features, gamification

The roadmap provides detailed implementation plans, timelines, and architectural guidance for building DigDeep into a comprehensive powerlifting analysis platform.

## Development Guidelines

### Testing Strategy

- Test each component in isolation first
- Use mock landmark data for consistent testing
- Always verify in real camera conditions
- Monitor performance metrics continuously
- Follow TDD methodology detailed in [Pose Detection Analysis](./reference/pose_detection_analysis.md#test-driven-development-tdd-workflow)

### Common Pitfalls to Avoid

- Don't over-engineer before testing with users
- Keep UI simple and large for gym use
- Prioritize accuracy over advanced features
- Test in poor lighting early and often

### Architectural Considerations

- Use interfaces even with single implementations (enables future exercises)
- Separate analysis logic from UI components
- Design extensible data structures for future exercise types
- See [Post-MVP Roadmap "Don't Close Doors"](./post_mvp_roadmap.md#dont-close-doors-during-mvp) for detailed guidance

### Decision Log

- **No recording in MVP**: Simplifies implementation, reduces complexity
- **Squats only**: Most valuable exercise, perfect for validating approach
- **No backend**: Faster to market, prove value first
- **Simple UI**: Two main feedback components sufficient for MVP

## Success Metrics

### Technical

- Maintains 30+ FPS during analysis
- < 100ms latency for feedback updates
- Works in typical gym lighting
- No memory leaks over 30-minute session

### User Experience

- User can set up and start analyzing within 30 seconds
- Feedback is clear and actionable
- Depth detection accurate to within 5%
- Balance detection catches obvious shifts

## Next Steps After MVP

1. Gather user feedback on accuracy and usability
2. Identify most requested features
3. Plan backend architecture if multi-device sync needed
4. Consider monetization strategy
5. Evaluate market expansion opportunities
