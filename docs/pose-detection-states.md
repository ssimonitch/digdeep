# Pose Detection States Reference

## Overview

The DigDeep application uses a three-state pose detection system with stabilization to prevent UI flickering and provide smooth user feedback.

## Detection States

### 1. Invalid State

- **Condition**: Pose not detected or confidence ≤ 50%
- **Visual**: Red background overlay
- **Message**: "Position yourself in frame" + specific guidance
- **Opacity**: Pose landmarks shown at 30% opacity

### 2. Detecting State

- **Condition**: Transitioning between states (debouncing period)
- **Visual**: Yellow background overlay
- **Message**: "Detecting pose... Hold your position"
- **Opacity**: Pose landmarks shown at 60% opacity

### 3. Valid State

- **Condition**: Pose detected with confidence ≥ 70%
- **Visual**: Green background overlay
- **Message**: "Pose Detected - Ready to analyze"
- **Opacity**: Pose landmarks shown at 100% opacity

## Implementation Examples

### Using Detection State in Components

```typescript
import { PoseGuidanceOverlay } from '@/features/analysis/components';

// Calculate detection state based on metrics
const detectionState = metrics.isValidPose
  ? 'valid'
  : metrics.confidence > 0.5
    ? 'detecting'
    : 'invalid';

// Render the guidance overlay
<PoseGuidanceOverlay
  detectionState={detectionState}
  confidence={metrics.confidence}
  keyLandmarkVisibility={analysis?.squatMetrics?.keyLandmarkVisibility}
/>
```

### Pose Validity Stabilizer Configuration

```typescript
import { PoseValidityStabilizer } from '@/features/pose-detection/services';

// Create stabilizer with custom configuration
const stabilizer = new PoseValidityStabilizer({
  upperThreshold: 0.7, // Enter valid state at 70% confidence
  lowerThreshold: 0.5, // Exit valid state at 50% confidence
  enterDebounceTime: 0, // Immediate positive feedback
  exitDebounceTime: 200, // 200ms stability before marking invalid
});

// Update stabilizer with confidence scores
stabilizer.update(confidence, timestamp);

// Get current state
const currentState = stabilizer.getState(); // 'invalid' | 'detecting' | 'valid'
```

### Landmark Visibility Guidance

The system prioritizes guidance based on missing body parts:

```typescript
// Priority order for squat analysis
const guidancePriority = {
  hips: 1, // Most critical for squat form
  knees: 2, // Second priority
  ankles: 3, // Third priority
  shoulders: 4, // Least critical
};

// Example visibility thresholds
const visibilityThreshold = 0.5; // 50% visibility required
```

## UI Behavior

### Smooth Transitions

- All state changes use CSS transitions (300ms duration)
- Opacity changes smoothly between states
- Background colors fade between red ↔ yellow ↔ green

### Non-Intrusive Feedback

- Overlay positioned at top of screen
- Semi-transparent backgrounds (90% opacity)
- Does not obstruct camera view
- Confidence percentage and progress bar always visible

### Smart Guidance Messages

**When hips not visible**:

- "Hips not visible - step back from camera"

**When knees not visible**:

- "Knees not visible - ensure full body is in frame"

**When ankles not visible**:

- "Ankles not visible - step back from camera"

**When all landmarks have low visibility**:

- "Step back and ensure full body is visible"

## Testing Detection States

```typescript
// Test examples
describe('Detection State Behavior', () => {
  it('should show invalid state with low confidence', () => {
    const result = render(
      <PoseGuidanceOverlay
        detectionState="invalid"
        confidence={0.3}
        keyLandmarkVisibility={{ hips: 0.3, knees: 0.8, ankles: 0.8, shoulders: 0.8 }}
      />
    );

    expect(screen.getByText('Position yourself in frame')).toBeInTheDocument();
    expect(screen.getByText('Hips not visible - step back from camera')).toBeInTheDocument();
  });
});
```

## Performance Considerations

- Stabilizer updates run on every frame but are optimized for performance
- State transitions are debounced to prevent excessive re-renders
- Visual feedback uses CSS transitions instead of JavaScript animations
- Confidence calculations are lightweight and don't impact frame rate
