# Powerlifting Form Analysis App - UI/UX Design Document

## Design Philosophy

### Core Principles
1. **Gym-First Design**: Interface optimized for use during workouts with sweaty/chalky hands
2. **Minimal Cognitive Load**: Maximum 2 taps to critical actions
3. **Glanceable Feedback**: Information visible at a distance and in peripheral vision
4. **Progressive Enhancement**: Full functionality on all devices, enhanced on touch

### Target Environment
- Poor gym lighting conditions
- User attention split between app and lifting
- Hands occupied or dirty
- Limited time between sets (2-5 minutes)
- Phone mounted on tripod at distance

## Visual Design System

### Color Palette (Dark Mode)
- **Background**: Deep charcoal (#0A0A0B)
- **Surface**: Dark gray (#1A1A1C)
- **Surface Elevated**: Lighter gray (#2A2A2C)
- **Primary (Blue)**: Light blue (#4DB1FF) - CTAs and navigation
- **Success (Green)**: Emerald (#10B981) - Good form indicators
- **Warning (Gold)**: Amber (#F59E0B) - Minor form issues
- **Error (Red)**: (#EF4444) - Critical form problems
- **Text Primary**: White (#FFFFFF)
- **Text Secondary**: Light gray (#9CA3AF)
- **Text Tertiary**: Medium gray (#6B7280)
- **Text Muted**: Dark gray (#4B5563)

### Typography
- **Font Family**: System fonts for performance (-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif)
- **Scale**:
  - Hero: 48px (quick start button)
  - Headings: 32px
  - Body: 18px (minimum for gym visibility)
  - Captions: 16px

### Spacing & Touch Targets
- **Minimum touch target**: 48x48dp (preferred: 60x60dp)
- **Spacing unit**: 8px grid system
- **Card padding**: 16px
- **Screen margins**: 16px (mobile) / 24px (tablet+)

## Information Architecture

```
App Root
├── Home Screen
│   ├── Quick Start Section
│   ├── Recent Workouts
│   ├── Progress Overview
│   └── Quick Actions Menu
├── Recording Flow
│   ├── Pre-Recording Setup
│   ├── Active Recording
│   └── Post-Recording Review
├── Analysis Section
│   ├── Video Playback
│   ├── Metrics Dashboard
│   └── Historical Comparison
└── Settings
    ├── Recording Preferences
    ├── Feedback Settings
    └── Data Management
```

## Key User Flows

### 1. Quick Start Workout Flow
```
Home → Tap "Start Squat Session" → Recording Setup (Mode + Cues + Session Details) → Start Recording → Active Recording with Feedback → Auto-stop → Analysis Summary → Save/Discard
```

### 2. Review Previous Workout Flow
```
Home → Recent Workouts → Tap Card (or use ⋮ menu) → View Analysis → Select Rep → View Detailed Metrics → Share/Export
```

### 3. Form Check Flow (No Save)
```
Home → Quick Check → Recording Setup (simplified) → Record → Instant Feedback → Auto-discard
```

### 4. View History Flow
```
Home → View All History → Filter by Exercise/Date → Select Session → Detailed Analysis
```

## Navigation & Layout Updates

### Header Navigation
- **Simplified Design**: Single hamburger menu on the right
- **No Bottom Navigation**: All navigation through header and contextual actions
- **Consistent Pattern**: Logo/Title on left, menu on right across all screens

### Content Hierarchy
- **Hero Actions**: Full-width primary buttons with descriptive text
- **Quick Actions**: Horizontal scrolling pill buttons for secondary actions
- **Card Actions**: Contextual menus (⋮) for item-specific operations
- **Progressive Disclosure**: Summary views with "View Details" options

## Screen Designs

### Home Screen

**Layout Structure:**
1. **Header (Fixed)**
   - App logo
   - Week streak badge
   - Settings gear

2. **Quick Start Hero**
   - Large primary button: "Start Squat Session"
   - Sub-text: "Continue from Tuesday"
   - Form score from last session

3. **Quick Actions Bar**
   - "Last Workout" pill button
   - "Compare Form" pill button  
   - "Quick Check" pill button

4. **Recent Workouts List**
   - Card-based design
   - Groups by date with exercise type
   - Key metrics preview (depth ✓, balance score)
   - Swipe right to delete (with fallback delete button)

5. **Progress Snapshot**
   - Weekly form trend mini-chart
   - Personal record callouts

### Pre-Recording Screen

**Key Innovation: Focus Cues Section**
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
│    Position Guide       │
│   [Animated overlay]    │
├─────────────────────────┤
│  ──────────────────     │
│   START RECORDING       │
│  ──────────────────     │
└─────────────────────────┘
```

**Focus Cues Logic:**
- Auto-populated based on last session's weakest metrics
- User/trainer can override with custom cues
- Maximum 2 cues to maintain focus
- Persistent across sets in same session

### Active Recording Screen

**Layout:**
```
┌─────────────────────────┐
│ ⏱️ 0:23   🔄 Rep 3   ⏹️ │ <- Minimal top bar
├─────────────────────────┤
│                         │
│                         │
│     [CAMERA FEED]       │
│                         │
│                      ◐  │ <- Depth indicator (right)
│                         │
│  ═══════════════════    │ <- Horizontal balance meter
│        ↑                │    (bottom center)
│     CENTERED            │
│                         │
│   "Push knees out"      │ <- Focus cue overlay
├─────────────────────────┤
│   TAP TO KEEP ACTIVE    │ <- Large touch zone
└─────────────────────────┘
```

**Real-time Feedback Elements:**
1. **Horizontal Balance Meter** (Bottom center)
   - Shows lateral shift left/right
   - Green center, gold edges, red extremes
   - Clear directional indicators
   - Text updates: "CENTERED" / "LEFT SHIFT" / "RIGHT SHIFT"

2. **Depth Indicator** (Right edge)
   - Arc that fills during descent
   - Color transitions: Blue → Green (at depth) → Pulse
   - Compact design for minimal obstruction

3. **Audio Feedback**
   - Subtle chime at proper depth
   - Directional cues: "Shift left/right"
   - Warning tone for major imbalance

### Analysis Screen

**Progressive Disclosure Design:**

**Level 1 - Summary View:**
```
┌─────────────────────────┐
│   Set Summary           │
├─────────────────────────┤
│  Overall: ★★★★☆         │
│  5 reps @ 225 lbs       │
│                         │
│  ✓ Depth achieved       │
│  ⚠️ Minor left shift     │
│  ✓ Good bar path        │
│                         │
│  [View Details]         │
└─────────────────────────┘
```

**Level 2 - Detailed Analysis:**
- Video player with overlay graphics
- Rep-by-rep breakdown
- Frame scrubber for specific moments
- Metrics charts (bar path, angles over time)

**Level 3 - Comparison Mode:**
- Side-by-side video comparison
- Overlay previous best form
- Progress tracking graphs

## Interaction Patterns

### Navigation Methods
1. **Primary**: Tap/click navigation
2. **Enhancement**: Swipe gestures where supported
3. **Keyboard**: Tab navigation for accessibility

### Gesture Support Matrix
| Gesture | Touch Device | Desktop | Action |
|---------|--------------|---------|---------|
| Tap | ✓ | ✓ (click) | Primary interaction |
| Swipe Horizontal | ✓ | → (arrow buttons) | Navigate days/reps |
| Swipe Vertical | ✓ | ✓ (scroll) | Scroll content |
| Long Press | ✓ | → (right-click) | Context menu |

### Loading & Feedback States
- **Skeleton screens** for content loading
- **Micro-animations** for state changes
- **Haptic feedback** on mobile for key actions
- **Progress indicators** for video processing

## Responsive Design Breakpoints

### Mobile (320px - 768px)
- Single column layout
- Bottom navigation
- Full-screen recording mode
- Touch-optimized controls

### Tablet (768px - 1024px)
- Two-column layouts where beneficial
- Side navigation drawer
- Larger video preview
- Split-screen analysis

### Desktop (1024px+)
- Multi-panel layouts
- Keyboard shortcuts enabled
- Hover states for additional info
- Advanced analysis tools visible

## Accessibility Considerations

1. **Visual**
   - High contrast ratios (WCAG AAA)
   - Large, clear typography
   - Color-blind friendly indicators (shapes + colors)

2. **Motor**
   - Large touch targets
   - Gesture alternatives
   - Voice commands for recording start/stop

3. **Cognitive**
   - Clear visual hierarchy
   - Consistent patterns
   - Minimal decision points during workout

## Performance Considerations

1. **Instant Actions**
   - Camera access < 1 second
   - Touch response < 100ms
   - Visual feedback immediate

2. **Optimizations**
   - Lazy load historical data
   - Progressive video loading
   - Cache UI assets
   - Minimize recording screen renders

## Future Enhancements

1. **Smartwatch Companion**
   - Remote recording trigger
   - Haptic form feedback
   - Quick metrics glance

2. **Voice Interface**
   - "Hey PowerLift, start recording"
   - Audio-only form cues
   - Rep counting

3. **Social Features**
   - Share form checks with trainer
   - Progress celebrations
   - Form improvement challenges

## Design Validation Metrics

- Time to start recording: < 5 seconds (reduced with streamlined flow)
- Touch target success rate: > 95% (all buttons 48px+ height)
- Form feedback visibility: 100% (horizontal balance meter, clear indicators)
- Session data capture: Complete (weight, reps, set number, date)
- Navigation clarity: Single menu reduces confusion

## Key Design Decisions

### Visual Refinements
- **Primary Color Change**: #2563EB → #4DB1FF for softer, more modern look
- **Text Hierarchy**: Added muted text color for better content organization
- **Surface Colors**: Added elevated surface for better depth perception

### UX Improvements
- **Horizontal Balance Meter**: More intuitive representation of lateral movement
- **Recording Mode First**: Moved to top of setup screen for immediate selection
- **Session Tracking**: Added comprehensive form fields for better data capture
- **Quick Actions**: Improved contrast and visibility with elevated surfaces
- **Single Menu**: Simplified navigation with one hamburger menu

### Removed Features
- **Position Check**: Eliminated to streamline pre-recording flow
- **Dual Navigation**: Removed left menu, kept single right hamburger
- **Vertical Balance Meter**: Replaced with horizontal version

These decisions were made to improve usability, reduce cognitive load, and create a more focused workout tracking experience.