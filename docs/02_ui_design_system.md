# DigDeep - Unified UI/UX Design System

## Table of Contents

1. [Design Philosophy](#design-philosophy)
2. [Design System Foundation](#design-system-foundation)
3. [Component Library](#component-library)
4. [User Flows & Interactions](#user-flows--interactions)
5. [Screen Designs](#screen-designs)
6. [Implementation Guidelines](#implementation-guidelines)
7. [Testing & Validation](#testing--validation)

---

## Design Philosophy

### Core Principles

1. **Gym-First Design**: Interface optimized for use during workouts with sweaty/chalky hands
2. **Minimal Cognitive Load**: Maximum 2 taps to critical actions
3. **Glanceable Feedback**: Information visible at a distance and in peripheral vision
4. **Progressive Enhancement**: Full functionality on all devices, enhanced on touch

### Target Environment

- **Poor gym lighting conditions**: High contrast design with large visual indicators
- **User attention split**: Between app and lifting, requiring minimal cognitive overhead
- **Hands occupied or dirty**: Large touch targets, gesture alternatives
- **Limited time between sets**: 2-5 minutes for quick interactions
- **Phone mounted on tripod**: Interface visible from distance

### Design Validation Metrics

- Time to start recording: < 5 seconds
- Touch target success rate: > 95% (all buttons 48px+ height)
- Form feedback visibility: 100% (clear indicators, high contrast)
- Navigation clarity: Single menu reduces confusion

---

## Design System Foundation

### Color Palette

```css
/* Base Colors */
--color-background: #0a0a0b; /* Deep charcoal */
--color-surface: #1a1a1c; /* Dark gray */
--color-surface-elevated: #2a2a2c; /* Lighter gray */

/* Brand Colors - Updated Modern Palette */
--color-primary: #4db1ff; /* Light blue (modern, softer) */
--color-primary-light: #6bc1ff; /* Lighter blue for hover states */
--color-primary-dark: #2e9fff; /* Darker blue for active states */

/* Feedback Colors */
--color-success: #10b981; /* Emerald - Good form indicators */
--color-warning: #f59e0b; /* Amber - Minor form issues */
--color-error: #ef4444; /* Red - Critical form problems */
--color-info: #06b6d4; /* Cyan - Informational feedback */

/* Text Colors */
--color-text-primary: #ffffff; /* White - Primary text */
--color-text-secondary: #9ca3af; /* Light gray - Secondary text */
--color-text-tertiary: #6b7280; /* Medium gray - Tertiary text */
--color-text-muted: #4b5563; /* Dark gray - Muted text */
--color-text-inverse: #0a0a0b; /* Black - Text on light backgrounds */

/* State Colors */
--color-disabled: #4b5563; /* Disabled elements */
--color-overlay: rgba(0, 0, 0, 0.5); /* Modal overlays */
--color-focus-ring: rgba(77, 177, 255, 0.5); /* Focus indicators */
```

### Typography System

```css
/* Font Family - System fonts for performance */
--font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
--font-family-mono: 'SF Mono', Consolas, monospace;

/* Font Sizes - Gym-optimized scale */
--font-size-xs: 14px; /* Fine print, least important info */
--font-size-sm: 16px; /* Captions, minimum for gym visibility */
--font-size-base: 18px; /* Body text, optimized for gym lighting */
--font-size-lg: 20px; /* Emphasized body text */
--font-size-xl: 24px; /* Subheadings */
--font-size-2xl: 32px; /* Headings */
--font-size-3xl: 48px; /* Hero text (quick start button) */

/* Font Weights */
--font-weight-regular: 400;
--font-weight-medium: 500;
--font-weight-semibold: 600;
--font-weight-bold: 700;

/* Line Heights */
--line-height-tight: 1.2; /* Headlines */
--line-height-normal: 1.5; /* Body text */
--line-height-relaxed: 1.75; /* Reading content */
```

### Spacing System

```css
/* Base unit: 8px grid system */
--space-xs: 4px; /* Fine adjustments */
--space-sm: 8px; /* Base spacing unit */
--space-md: 16px; /* Standard spacing */
--space-lg: 24px; /* Large spacing */
--space-xl: 32px; /* Extra large spacing */
--space-2xl: 48px; /* Section spacing */
--space-3xl: 64px; /* Page-level spacing */

/* Component-specific spacing */
--space-card-padding: 16px;
--space-button-padding-x: 24px;
--space-button-padding-y: 16px;
--space-input-padding: 12px;

/* Touch Targets - Gym optimized */
--touch-target-min: 48px; /* Minimum touch target */
--touch-target-preferred: 60px; /* Preferred for primary actions */
--touch-target-hero: 80px; /* Hero actions (start recording) */
```

### Motion & Animation

```css
/* Durations */
--duration-fast: 150ms; /* Micro-interactions */
--duration-normal: 250ms; /* Standard transitions */
--duration-slow: 350ms; /* Complex animations */

/* Easings */
--easing-default: cubic-bezier(0.4, 0, 0.2, 1); /* Material Design standard */
--easing-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55); /* Playful interactions */
--easing-sharp: cubic-bezier(0.4, 0, 1, 1); /* Entrance animations */
--easing-soft: cubic-bezier(0, 0, 0.2, 1); /* Exit animations */
```

---

## Component Library

### 1. Button Component

#### Variants & Specifications

```typescript
interface ButtonProps {
  variant: 'primary' | 'secondary' | 'ghost' | 'pill';
  size: 'hero' | 'large' | 'medium' | 'small' | 'icon';
  fullWidth?: boolean;
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  children: ReactNode;
  onClick: () => void;
}
```

#### Visual Specifications

```css
/* Primary Hero Button (Start Recording) */
.button-primary-hero {
  height: 80px;
  padding: 0 32px;
  background: var(--color-primary);
  color: var(--color-text-primary);
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(77, 177, 255, 0.3);
  border: none;
  cursor: pointer;
  transition: all var(--duration-normal) var(--easing-default);
}

.button-primary-hero:hover {
  background: var(--color-primary-light);
  box-shadow: 0 6px 16px rgba(77, 177, 255, 0.4);
}

.button-primary-hero:active {
  transform: scale(0.98);
  box-shadow: 0 2px 8px rgba(77, 177, 255, 0.2);
}

/* Secondary Pill Buttons (Quick Actions) */
.button-pill {
  height: 48px;
  padding: 0 24px;
  background: var(--color-surface-elevated);
  color: var(--color-text-primary);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  cursor: pointer;
  transition: all var(--duration-normal) var(--easing-default);
}

.button-pill:hover {
  background: var(--color-surface);
  border-color: var(--color-primary);
}

/* Icon Button */
.button-icon {
  width: 48px;
  height: 48px;
  padding: 0;
  background: transparent;
  color: var(--color-text-secondary);
  border: none;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--duration-fast) var(--easing-default);
}

.button-icon:hover {
  background: var(--color-surface);
  color: var(--color-text-primary);
}
```

### 2. Card Component

#### Component Structure

```typescript
interface CardProps {
  variant: 'workout' | 'stats' | 'action';
  title: string;
  subtitle?: string;
  rating?: number;
  metrics?: MetricPillProps[];
  onClick?: () => void;
  onEdit?: () => void;
  onViewStats?: () => void;
  onShare?: () => void;
  onDelete?: () => void;
  className?: string;
}

interface MetricPillProps {
  icon: string;
  text: string;
  variant: 'success' | 'warning' | 'error';
}
```

#### Visual Specifications

```css
.card {
  background: var(--color-surface);
  border-radius: 12px;
  padding: var(--space-card-padding);
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: all var(--duration-normal) var(--easing-default);
}

.card-tappable {
  cursor: pointer;
}

.card-tappable:hover {
  background: var(--color-surface-elevated);
  border-color: rgba(255, 255, 255, 0.2);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.card-tappable:active {
  transform: scale(0.99);
  background: var(--color-surface);
}

/* Workout Card Specific */
.workout-card-header {
  display: flex;
  align-items: start;
  justify-content: space-between;
  margin-bottom: var(--space-md);
}

.workout-card-rating {
  display: flex;
  gap: 2px;
  font-size: 18px;
}

.workout-card-star {
  color: var(--color-warning);
}

.workout-card-star-empty {
  color: rgba(255, 255, 255, 0.2);
}

/* Metric Pills */
.metric-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  border-radius: 16px;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  border: 1px solid;
}

.metric-pill-success {
  background: rgba(16, 185, 129, 0.2);
  color: var(--color-success);
  border-color: var(--color-success);
}

.metric-pill-warning {
  background: rgba(245, 158, 11, 0.2);
  color: var(--color-warning);
  border-color: var(--color-warning);
}

.metric-pill-error {
  background: rgba(239, 68, 68, 0.2);
  color: var(--color-error);
  border-color: var(--color-error);
}
```

### 3. Real-time Feedback Components

#### Balance Meter (Custom)

```typescript
interface BalanceMeterProps {
  value: number; // -100 to 100 (0 is centered)
  threshold: {
    good: number; // ±25
    warning: number; // ±50
  };
  height?: number;
  animated?: boolean;
  label?: string;
}
```

#### Visual Design & Implementation

```css
.balance-meter {
  width: 100%;
  height: 8px;
  background: linear-gradient(
    90deg,
    var(--color-error) 0%,
    /* Left extreme */ var(--color-warning) 25%,
    /* Left warning */ var(--color-success) 45%,
    /* Left good */ var(--color-success) 55%,
    /* Center good */ var(--color-warning) 75%,
    /* Right warning */ var(--color-error) 100% /* Right extreme */
  );
  border-radius: 4px;
  position: relative;
  margin: var(--space-sm) 0;
}

.balance-meter-indicator {
  position: absolute;
  top: -4px;
  width: 4px;
  height: 16px;
  background: var(--color-text-primary);
  border-radius: 2px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
  transition: left var(--duration-fast) var(--easing-default);
}

.balance-meter-label {
  text-align: center;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  margin-top: var(--space-xs);
  color: var(--color-text-primary);
}

/* Animated pulse for attention */
.balance-meter-indicator.critical {
  animation: balance-pulse 0.5s ease-in-out infinite alternate;
}

@keyframes balance-pulse {
  from {
    opacity: 1;
  }
  to {
    opacity: 0.6;
  }
}
```

#### Depth Indicator (Custom)

```typescript
interface DepthIndicatorProps {
  currentDepth: number; // 0-100 percentage
  targetDepth: number; // Usually 100 for parallel
  size?: 'small' | 'large';
  showNumeric?: boolean;
}
```

#### Visual Design & Implementation

```css
.depth-indicator {
  width: 60px;
  height: 60px;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.depth-indicator-arc {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 4px solid rgba(255, 255, 255, 0.2);
  border-left-color: transparent;
  border-bottom-color: transparent;
  transform: rotate(-45deg);
  position: relative;
}

.depth-indicator-progress {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 4px solid transparent;
  position: absolute;
  top: -4px;
  left: -4px;
  transition: all var(--duration-normal) var(--easing-default);
}

.depth-indicator-progress.incomplete {
  border-left-color: var(--color-primary);
  border-bottom-color: var(--color-primary);
}

.depth-indicator-progress.achieved {
  border-left-color: var(--color-success);
  border-bottom-color: var(--color-success);
  animation: depth-pulse 1s ease-in-out infinite alternate;
}

.depth-indicator-dot {
  position: absolute;
  width: 8px;
  height: 8px;
  background: var(--color-text-primary);
  border-radius: 50%;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 1;
}

@keyframes depth-pulse {
  from {
    border-color: var(--color-success);
    box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
  }
  to {
    border-color: var(--color-success);
    box-shadow: 0 0 0 4px rgba(16, 185, 129, 0);
  }
}
```

### 4. Form Controls

#### Input Field

```typescript
interface InputProps {
  label: string;
  value: string | number;
  type: 'text' | 'number' | 'weight';
  size: 'medium' | 'large';
  error?: string;
  helper?: string;
  prefix?: string;
  suffix?: string;
  onChange: (value: string) => void;
}
```

```css
.input-large {
  height: 60px;
  font-size: var(--font-size-lg);
  padding: var(--space-input-padding) var(--space-md);
  background: var(--color-surface);
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  color: var(--color-text-primary);
  width: 100%;
  transition: all var(--duration-normal) var(--easing-default);
}

.input-large:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-focus-ring);
}

.input-large::placeholder {
  color: var(--color-text-tertiary);
}

.input-error {
  border-color: var(--color-error);
}

.input-error:focus {
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.2);
}
```

### 5. Navigation Components

#### Header (Single Menu Approach)

```typescript
interface HeaderProps {
  title: string;
  rightAction?: {
    icon: ReactNode;
    onClick: () => void;
  };
  streak?: number;
  transparent?: boolean;
}
```

```css
.header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 64px;
  background: rgba(10, 10, 11, 0.8);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--space-md);
  z-index: 100;
}

.header-title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.header-streak {
  background: var(--color-primary);
  color: var(--color-background);
  padding: 4px 8px;
  border-radius: 12px;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  display: flex;
  align-items: center;
  gap: 4px;
}
```

### 6. Overlay Components

#### Focus Cue Display

```typescript
interface FocusCueProps {
  cues: string[];
  visible: boolean;
  position: 'top' | 'center' | 'bottom';
  duration?: number;
  autoCycle?: boolean;
}
```

```css
.focus-cue-overlay {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.8);
  color: var(--color-text-primary);
  padding: var(--space-md) var(--space-lg);
  border-radius: 12px;
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  text-align: center;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  transition: all var(--duration-normal) var(--easing-default);
  z-index: 50;
}

.focus-cue-overlay.top {
  top: 20%;
}

.focus-cue-overlay.center {
  top: 50%;
  transform: translate(-50%, -50%);
}

.focus-cue-overlay.bottom {
  bottom: 20%;
}

.focus-cue-overlay.hidden {
  opacity: 0;
  transform: translateX(-50%) scale(0.9);
}

.focus-cue-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.focus-cue-item {
  margin: var(--space-sm) 0;
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.focus-cue-number {
  background: var(--color-primary);
  color: var(--color-background);
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-bold);
  flex-shrink: 0;
}
```

---

## User Flows & Interactions

### Key User Flows

#### 1. Quick Start Workout Flow

```
Home → Tap "START SQUAT SESSION" →
Recording Setup (Focus Cues + Mode) →
Start Recording →
Active Recording with Real-time Feedback →
Auto-stop →
Analysis Summary →
Save/Discard
```

#### 2. Review Previous Workout Flow

```
Home → Recent Workouts →
Tap Card (or use ⋮ menu) →
View Analysis →
Select Rep →
View Detailed Metrics →
Share/Export
```

#### 3. Form Check Flow (No Save)

```
Home → Quick Check →
Recording Setup (simplified) →
Record →
Instant Feedback →
Auto-discard
```

### Interaction Patterns

#### Navigation Methods

1. **Primary**: Tap/click navigation (all users)
2. **Enhancement**: Swipe gestures where supported (touch devices)
3. **Accessibility**: Keyboard navigation and screen reader support

#### Gesture Support Matrix

| Gesture          | Touch Device | Desktop            | Action              |
| ---------------- | ------------ | ------------------ | ------------------- |
| Tap              | ✓            | ✓ (click)          | Primary interaction |
| Swipe Horizontal | ✓            | → (arrow buttons)  | Navigate days/reps  |
| Swipe Vertical   | ✓            | ✓ (scroll)         | Scroll content      |
| Long Press       | ✓            | → (right-click)    | Context menu        |
| Pull to Refresh  | ✓            | → (refresh button) | Update content      |

#### Touch Target Guidelines

- **Minimum**: 48x48px (accessibility standard)
- **Preferred**: 60x60px (primary actions, gym conditions)
- **Hero**: 80x80px (critical actions like start recording)
- **Spacing**: 8px minimum between targets

---

## Screen Designs

### Home Screen Layout

#### Structure & Hierarchy

```
┌─────────────────────────┐
│ Header (Fixed)          │
│ DigDeep        🔥7  ⚙️  │
├─────────────────────────┤
│                         │
│ Quick Start Hero        │
│ ┌─────────────────────┐ │
│ │ START SQUAT SESSION │ │
│ │                     │ │
│ │ Continue from Tue   │ │
│ │ Last: ★★★★☆         │ │
│ └─────────────────────┘ │
│                         │
│ Quick Actions           │
│ [📊 Last Workout] [⚡ Check] │
│                         │
│ Recent Workouts         │
│ ┌─────────────────────┐ │
│ │ Today - Squat  ★★★★ │ │
│ │ 5x5 @ 225lbs    ⋮   │ │
│ │ ✓Depth ⚠️Balance ✓Path │ │
│ └─────────────────────┘ │
│                         │
│ [View All History →]    │
└─────────────────────────┘
```

#### Component Specifications

- **Header**: Fixed position with streak counter and settings
- **Hero Button**: 80px height, full-width, primary color
- **Quick Actions**: Pill buttons, horizontal layout
- **Workout Cards**: Elevated surface, metric pills, context menu
- **Content Padding**: 16px screen margins

### Active Recording Screen

#### Layout Structure

```
┌─────────────────────────┐
│ ⏱️ 0:23  🔄 Rep 3   ⏹️ │ ← Minimal status bar
├─────────────────────────┤
│                         │
│                         │
│     [CAMERA FEED]       │
│                         │
│                      ◐  │ ← Depth indicator (right)
│                         │
│                         │
│  ═══════════════════    │ ← Balance meter (bottom)
│        ↑                │
│     CENTERED            │
│                         │
│   "Push knees out"      │ ← Focus cue overlay
├─────────────────────────┤
│   TAP TO KEEP ACTIVE    │ ← Large touch zone
└─────────────────────────┘
```

#### Real-time Feedback Elements

1. **Balance Meter**: Bottom center, horizontal gradient with zones
2. **Depth Indicator**: Right edge, arc that fills during descent
3. **Focus Cues**: Overlay with backdrop blur, auto-cycling
4. **Status Bar**: Minimal information, large touch target for controls

### Pre-Recording Setup Screen

#### Focus Cues Section

```
┌─────────────────────────┐
│   Today's Focus Cues    │
├─────────────────────────┤
│  1. "Push knees out"    │
│  2. "Stay centered"     │
│                         │
│  [Edit Cues]            │
├─────────────────────────┤
│   Recording Mode        │
│  ┌─────┐     ┌─────┐   │
│  │Auto │     │Timer│   │
│  │Start│     │ 10s │   │
│  └─────┘     └─────┘   │
├─────────────────────────┤
│  ──────────────────     │
│   START RECORDING       │
│  ──────────────────     │
└─────────────────────────┘
```

#### Focus Cues Logic

- Auto-populated based on last session's weakest metrics
- User can override with custom cues
- Maximum 2 cues to maintain focus
- Persistent across sets in same session

---

## Implementation Guidelines

### Component Architecture

```typescript
// Base component structure pattern
const Component: FC<Props> = ({
  variant = 'default',
  size = 'medium',
  className,
  ...props
}) => {
  const classes = cn(
    'base-component',
    `component-${variant}`,
    `component-${size}`,
    className
  );

  return <div className={classes} {...props} />;
};
```

### Performance Considerations

#### Animation Guidelines

1. **Use CSS transforms** for animations (GPU accelerated)
2. **Prefer opacity and transform** over layout-affecting properties
3. **Implement reduced motion** for accessibility preferences
4. **Limit simultaneous animations** to maintain 60fps

#### Memory Management

1. **Lazy load heavy components** (analysis views, detailed metrics)
2. **Implement virtual scrolling** for workout history
3. **Debounce rapid interactions** (search, filtering)
4. **Clean up event listeners** in component unmount

#### Loading States

```css
/* Skeleton loading for cards */
.skeleton {
  background: linear-gradient(
    90deg,
    var(--color-surface) 25%,
    var(--color-surface-elevated) 50%,
    var(--color-surface) 75%
  );
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
}

@keyframes skeleton-loading {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
```

### Accessibility Implementation

#### Screen Reader Support

```typescript
// Proper ARIA labeling for complex components
<div
  role="progressbar"
  aria-label={`Squat depth: ${depthPercentage}%`}
  aria-valuenow={depthPercentage}
  aria-valuemin={0}
  aria-valuemax={100}
>
  <DepthIndicator value={depthPercentage} />
</div>
```

#### Keyboard Navigation

```css
/* Focus indicators for keyboard users */
.focusable:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* Skip links for screen readers */
.skip-link {
  position: absolute;
  top: -40px;
  left: 6px;
  background: var(--color-primary);
  color: var(--color-background);
  padding: 8px;
  text-decoration: none;
  border-radius: 4px;
  transition: top var(--duration-normal);
}

.skip-link:focus {
  top: 6px;
}
```

#### Color Contrast Compliance

- **Text on dark backgrounds**: 15:1 ratio (exceeds WCAG AAA)
- **Interactive elements**: 4.5:1 minimum contrast
- **Error states**: Use both color and iconography
- **Focus indicators**: High contrast with 2px minimum width

### Responsive Design Strategy

#### Breakpoint System

```css
/* Mobile First Approach */
@media (min-width: 768px) {
  /* Tablet styles */
  .container {
    max-width: 768px;
    margin: 0 auto;
  }
}

@media (min-width: 1024px) {
  /* Desktop styles */
  .container {
    max-width: 1024px;
  }

  /* Enable hover states */
  .hover-enabled:hover {
    /* Hover effects only on non-touch devices */
  }
}
```

#### Touch vs. Desktop Adaptations

```typescript
// Detect touch capability
const useTouch = () => {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
};

// Conditional touch targets
const TouchTarget = ({ children, ...props }) => {
  const isTouch = useTouch();

  return (
    <button
      className={cn(
        'button',
        isTouch ? 'button-touch' : 'button-desktop'
      )}
      {...props}
    >
      {children}
    </button>
  );
};
```

---

## Testing & Validation

### Component Testing Strategy

#### Visual Regression Testing

```typescript
// Storybook stories for all component states
export default {
  title: 'Components/Button',
  component: Button,
  parameters: {
    viewport: {
      viewports: {
        mobile: { name: 'Mobile', styles: { width: '375px', height: '812px' } },
        tablet: { name: 'Tablet', styles: { width: '768px', height: '1024px' } }
      }
    }
  }
};

export const AllStates = () => (
  <div style={{ display: 'grid', gap: '16px', padding: '16px' }}>
    <Button variant="primary" size="hero">Start Recording</Button>
    <Button variant="primary" size="hero" disabled>Start Recording</Button>
    <Button variant="primary" size="hero" loading>Start Recording</Button>
    <Button variant="pill">Last Workout</Button>
    <Button variant="ghost" size="icon"><MenuIcon /></Button>
  </div>
);
```

#### Interaction Testing

```typescript
// Test touch target sizes
test('buttons meet minimum touch target requirements', () => {
  render(<Button>Test Button</Button>);
  const button = screen.getByRole('button');
  const rect = button.getBoundingClientRect();

  expect(rect.width).toBeGreaterThanOrEqual(48);
  expect(rect.height).toBeGreaterThanOrEqual(48);
});

// Test keyboard navigation
test('components are keyboard accessible', () => {
  render(<WorkoutCard title="Test Workout" />);

  const card = screen.getByRole('article');
  card.focus();

  fireEvent.keyDown(card, { key: 'Enter' });
  expect(mockOnClick).toHaveBeenCalled();
});
```

#### Performance Benchmarks

```typescript
// Animation performance testing
test('animations maintain 60fps', async () => {
  const { container } = render(<BalanceMeter value={50} animated />);

  // Start performance measurement
  const startTime = performance.now();

  // Trigger animation
  fireEvent.click(container.firstChild);

  // Wait for animation to complete
  await waitFor(() => {
    const endTime = performance.now();
    const duration = endTime - startTime;
    const fps = 1000 / (duration / 60); // Assuming 60 frames

    expect(fps).toBeGreaterThanOrEqual(60);
  });
});
```

### Accessibility Testing Checklist

#### Automated Testing

- [ ] axe-core accessibility violations: 0
- [ ] Color contrast ratios meet WCAG AAA standards
- [ ] All interactive elements have accessible names
- [ ] Form elements have proper labels and descriptions
- [ ] Focus order is logical and predictable

#### Manual Testing

- [ ] Screen reader compatibility (VoiceOver, NVDA, JAWS)
- [ ] Keyboard-only navigation works for all functions
- [ ] Touch targets are large enough for gym conditions
- [ ] Text is readable in poor lighting conditions
- [ ] Animations respect prefers-reduced-motion

### Design Validation Metrics

#### Performance Targets

- **Time to start recording**: < 5 seconds
- **Touch target success rate**: > 95%
- **Form feedback visibility**: 100% in gym lighting
- **Navigation clarity**: Single-tap access to all primary functions

#### User Experience Validation

```typescript
// Track user interaction success rates
const trackInteraction = (action: string, success: boolean) => {
  analytics.track('interaction', {
    action,
    success,
    timestamp: Date.now(),
    context: 'gym-environment'
  });
};

// Example usage
<Button
  onClick={() => {
    const success = startRecording();
    trackInteraction('start_recording', success);
  }}
>
  Start Recording
</Button>
```

---

## Conclusion

This unified design system provides comprehensive guidance for creating a gym-optimized powerlifting form analysis application. The system prioritizes:

1. **Gym-First Design**: Every decision optimized for workout environment conditions
2. **Accessibility**: Exceeding WCAG standards for inclusive design
3. **Performance**: 60fps animations and responsive interactions
4. **Consistency**: Systematic approach to colors, typography, and spacing
5. **Implementation Ready**: Complete specifications for immediate development

The design system serves as the single source of truth for all UI/UX decisions, ensuring consistency across the application while maintaining the flexibility needed for future enhancements.

**Key Differentiators**:

- Large touch targets optimized for gym gloves
- High contrast visuals for poor lighting conditions
- Minimal cognitive load during workouts
- Real-time feedback systems designed for peripheral vision
- Progressive enhancement supporting all device capabilities

This foundation supports DigDeep's mission to provide seamless, effective form analysis that enhances rather than interrupts the lifting experience.
