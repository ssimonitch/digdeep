# Powerlifting App - Component Library

## Design Tokens

### Color Tokens
```css
/* Base Colors */
--color-background: #0A0A0B;
--color-surface: #1A1A1C;
--color-surface-elevated: #2A2A2C;

/* Brand Colors */
--color-primary: #2563EB;        /* Blue */
--color-primary-light: #3B82F6;
--color-primary-dark: #1D4ED8;

/* Feedback Colors */
--color-success: #10B981;        /* Green */
--color-warning: #F59E0B;        /* Gold */
--color-error: #EF4444;          /* Red */
--color-info: #06B6D4;          /* Cyan */

/* Text Colors */
--color-text-primary: #FFFFFF;
--color-text-secondary: #9CA3AF;
--color-text-tertiary: #6B7280;
--color-text-inverse: #0A0A0B;

/* State Colors */
--color-disabled: #4B5563;
--color-overlay: rgba(0, 0, 0, 0.5);
--color-focus-ring: rgba(37, 99, 235, 0.5);
```

### Typography Tokens
```css
/* Font Family */
--font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
--font-family-mono: 'SF Mono', Consolas, monospace;

/* Font Sizes */
--font-size-xs: 14px;
--font-size-sm: 16px;
--font-size-base: 18px;
--font-size-lg: 20px;
--font-size-xl: 24px;
--font-size-2xl: 32px;
--font-size-3xl: 48px;

/* Font Weights */
--font-weight-regular: 400;
--font-weight-medium: 500;
--font-weight-semibold: 600;
--font-weight-bold: 700;

/* Line Heights */
--line-height-tight: 1.2;
--line-height-normal: 1.5;
--line-height-relaxed: 1.75;
```

### Spacing Tokens
```css
/* Base unit: 8px */
--space-xs: 4px;
--space-sm: 8px;
--space-md: 16px;
--space-lg: 24px;
--space-xl: 32px;
--space-2xl: 48px;
--space-3xl: 64px;

/* Component specific */
--space-card-padding: 16px;
--space-button-padding-x: 24px;
--space-button-padding-y: 16px;
--space-input-padding: 12px;
```

### Motion Tokens
```css
/* Durations */
--duration-fast: 150ms;
--duration-normal: 250ms;
--duration-slow: 350ms;

/* Easings */
--easing-default: cubic-bezier(0.4, 0, 0.2, 1);
--easing-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);
```

## Core Components

### 1. Button Component

**Variants:**
- Primary (CTA actions)
- Secondary (alternative actions)
- Ghost (tertiary actions)
- Icon-only (compact actions)

**Sizes:**
- Large (hero actions - 80px height)
- Medium (standard - 60px height)
- Small (inline - 48px height)

**States:**
- Default
- Hover
- Active
- Disabled
- Loading

```typescript
interface ButtonProps {
  variant: 'primary' | 'secondary' | 'ghost' | 'icon';
  size: 'large' | 'medium' | 'small';
  fullWidth?: boolean;
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  children: ReactNode;
  onClick: () => void;
}
```

**Visual Specifications:**
```css
/* Primary Large (Hero Button) */
.button-primary-large {
  height: 80px;
  padding: 0 32px;
  background: var(--color-primary);
  color: var(--color-text-primary);
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
}

/* Touch feedback */
.button:active {
  transform: scale(0.98);
  box-shadow: 0 2px 8px rgba(37, 99, 235, 0.2);
}
```

### 2. Card Component

**Variants:**
- Workout card (with metrics)
- Metric card (single stat)
- Action card (tappable)

**Props:**
```typescript
interface CardProps {
  variant: 'workout' | 'metric' | 'action';
  title: string;
  subtitle?: string;
  metrics?: MetricProps[];
  rating?: number;
  onClick?: () => void;
  swipeActions?: SwipeAction[];
}
```

**Visual Specifications:**
```css
.card {
  background: var(--color-surface);
  border-radius: 12px;
  padding: var(--space-card-padding);
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: all var(--duration-normal) var(--easing-default);
}

.card-tappable:active {
  background: var(--color-surface-elevated);
  transform: scale(0.99);
}
```

### 3. Metric Display Component

**Types:**
- Success (green check)
- Warning (gold alert)
- Error (red X)
- Info (blue i)

```typescript
interface MetricDisplayProps {
  label: string;
  value: string | number;
  status: 'success' | 'warning' | 'error' | 'info';
  detail?: string;
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

**Visual Specifications:**
```css
.input-large {
  height: 60px;
  font-size: var(--font-size-lg);
  padding: var(--space-input-padding);
  background: var(--color-surface);
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
}

.input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-focus-ring);
}
```

#### Toggle/Switch
```typescript
interface ToggleProps {
  options: Array<{
    label: string;
    value: string;
    icon?: ReactNode;
  }>;
  selected: string;
  onChange: (value: string) => void;
}
```

### 5. Feedback Components

#### Progress Bar
```typescript
interface ProgressBarProps {
  value: number;
  max: number;
  color?: 'primary' | 'success' | 'warning';
  label?: string;
  animated?: boolean;
}
```

#### Balance Meter (Custom)
```typescript
interface BalanceMeterProps {
  value: number; // -100 to 100 (0 is centered)
  threshold: {
    good: number;    // ±25
    warning: number; // ±50
  };
  height?: number;
  animated?: boolean;
}
```

**Visual Design:**
```
│ ████░░░░ │  <- Red zone | Gold zone | Green center | Gold zone | Red zone
│     ↑    │  <- Animated indicator
│  CENTER  │
```

#### Depth Indicator (Custom)
```typescript
interface DepthIndicatorProps {
  currentAngle: number;
  targetAngle: number;
  size?: 'small' | 'large';
  showNumeric?: boolean;
}
```

**Visual Design:**
```
╭─╮
│ │  <- Arc fills as angle increases
│ │  <- Blue → Green at target → Pulse
│●│  <- Dot indicator
╰─╯
```

### 6. Navigation Components

#### Tab Bar
```typescript
interface TabBarProps {
  tabs: Array<{
    label: string;
    value: string;
    icon?: ReactNode;
  }>;
  active: string;
  onChange: (value: string) => void;
}
```

#### Header
```typescript
interface HeaderProps {
  title: string;
  leftAction?: {
    icon: 'back' | 'menu' | 'close';
    onClick: () => void;
  };
  rightAction?: {
    icon: ReactNode;
    onClick: () => void;
  };
  transparent?: boolean;
}
```

### 7. Video Components

#### Video Player
```typescript
interface VideoPlayerProps {
  src: string;
  poster?: string;
  overlays?: OverlayData[];
  controls?: 'minimal' | 'full';
  onTimeUpdate?: (time: number) => void;
}
```

#### Rep Selector
```typescript
interface RepSelectorProps {
  totalReps: number;
  currentRep: number;
  repData?: Array<{
    score: number;
    hasIssue: boolean;
  }>;
  onChange: (rep: number) => void;
}
```

**Visual Design:**
```
[1] [2] [3] [4] [5]
 ●   ○   ⚠️   ○   ○
```

### 8. Overlay Components

#### Focus Cue Display
```typescript
interface FocusCueProps {
  cues: string[];
  visible: boolean;
  position: 'top' | 'center' | 'bottom';
  duration?: number;
}
```

#### Real-time Metric Overlay
```typescript
interface MetricOverlayProps {
  metrics: Array<{
    type: 'balance' | 'depth' | 'tempo';
    value: number;
    status: 'good' | 'warning' | 'error';
  }>;
  layout: 'corners' | 'edges' | 'minimal';
}
```

### 9. Touch Gesture Components

#### Swipeable Card
```typescript
interface SwipeableCardProps {
  children: ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  leftAction?: SwipeAction;
  rightAction?: SwipeAction;
}
```

#### Large Touch Zone
```typescript
interface TouchZoneProps {
  onTap: () => void;
  onLongPress?: () => void;
  label?: string;
  minHeight?: number;
}
```

## Component States & Behaviors

### Loading States
1. **Skeleton screens** for content loading
2. **Spinner overlay** for actions
3. **Progress bars** for uploads/processing
4. **Shimmer effect** for cards

### Error States
1. **Inline validation** for forms
2. **Toast notifications** for actions
3. **Empty states** with helpful actions
4. **Connection lost** banners

### Animation Patterns
1. **Micro-interactions**
   - Button press: Scale 0.98
   - Card tap: Subtle background change
   - Toggle: Smooth slide transition

2. **Feedback animations**
   - Success: Check mark draw-in
   - Error: Shake animation
   - Progress: Smooth fill

3. **Transitions**
   - Screen: Slide left/right
   - Modal: Fade + scale
   - Cards: Stagger fade-in

## Accessibility Guidelines

### Touch Targets
- Minimum: 48x48px
- Preferred: 60x60px for primary actions
- Spacing: 8px minimum between targets

### Color Contrast
- Text on dark: 15:1 ratio
- Interactive elements: 4.5:1 minimum
- Error states: Must not rely on color alone

### Screen Reader Support
- All interactive elements have labels
- Dynamic content announces changes
- Form errors read immediately

### Gesture Alternatives
- Every swipe has a tap alternative
- Long press shows context menu
- All actions keyboard accessible

## Implementation Notes

### Component Architecture
```typescript
// Example base component structure
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
1. Use CSS transforms for animations
2. Implement virtual scrolling for long lists
3. Lazy load heavy components
4. Memoize expensive calculations
5. Debounce rapid interactions

### Testing Approach
1. Visual regression tests for each component
2. Interaction tests for all states
3. Accessibility audit for WCAG compliance
4. Performance benchmarks for animations