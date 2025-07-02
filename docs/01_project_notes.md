# DigDeep Form Analysis App - Project Document

## Project Overview

A web-based application that uses ML/AI to analyze powerlifting form, provide real-time feedback, track training progress, and plan workouts. Primary focus is on detecting and correcting form imbalances, particularly in the squat.

## Developer Profile & Constraints

- **Developer**: Fullstack web developer with 7 years experience
- **Purpose**: Personal learning project and training tool
- **Budget**: Free tier services only
- **Timeline**: Flexible (spare time project)
- **Users**: Personal use + potentially sharing with personal trainer

## Core Requirements

### Form Analysis Features
- **Real-time feedback** during lifts
- **Post-workout detailed analysis**
- **Priority**: Squat (first) → Bench → Deadlift → Accessories
- **Key metrics to track**:
  - Bar path
  - Depth achievement
  - Joint angles
  - Lateral imbalances (especially "in the hole")
  - Tempo

### Technical Requirements
- **Platform**: Web-first approach
- **ML Processing**: Flexible (on-device or cloud based on performance)
- **Offline**: Not required for MVP
- **Current tracking**: Volume only (still finding training max)
- **Training methodology**: RPE-based
- **Integrations**: Phone-based only (no wearables for now)

## Technical Architecture

### Tech Stack (Decided)
- **Frontend**: Vite + React + TypeScript
- **UI Framework**: Tailwind CSS
- **ML/Pose Detection**: MediaPipe Pose (or TensorFlow.js with MoveNet)
- **State Management**: Zustand
- **Backend**: Supabase (auth + database + storage)
- **Video Storage**: Cloudinary (25GB free tier)
- **Deployment**: Netlify or Vercel

### ML Approach
- **MVP**: Use MediaPipe Pose landmarks with rule-based logic
- **No custom ML training needed initially**
- **Barbell tracking**: Color detection or inference from body position
- **Future**: Collect training data for potential custom models

## MVP Features (Phase 1)

### Recording Setup
- **Camera angle**: Rear view (optimal for imbalance detection)
- **Equipment**: Phone tripods available at gym
- **Screen management**: Implement Wake Lock API to prevent sleep

### Real-time Feedback
- Visual indicators for bar path deviation
- Audio cues for depth achievement
- Imbalance warnings
- Large touch zone to keep screen active

### Post-Workout Analysis
- Frame-by-frame breakdown
- Bar path visualization
- Joint angle measurements
- Key metrics:
  - Hip below knee angle (depth)
  - Left/right hip alignment
  - Knee tracking
  - Forward lean angle

## Development Roadmap

### Phase 1: MVP (Weeks 1-12)
1. **Weeks 1-2**: Basic web app setup, camera access, video recording
2. **Weeks 3-4**: MediaPipe integration, pose detection working
3. **Weeks 5-6**: Squat-specific rules implementation
4. **Weeks 7-8**: Real-time feedback system
5. **Weeks 9-10**: Post-workout analysis features
6. **Weeks 11-12**: UI polish, data persistence

### Phase 2: Enhancements
- Workout logging with RPE tracking
- Volume progression visualization
- Bench & deadlift analysis
- Form consistency scoring

### Phase 3: Advanced Features (Future)
- Multi-angle recording
- Custom ML for form quality scoring
- Fatigue detection
- Auto exercise classification
- Integration with wearables

## Key Technical Considerations

### Working with Free Tiers
- Client-side video compression before upload
- Store only notable lifts (PRs, form issues)
- Implement data retention policies
- Optimize pose detection frequency (every 3-5 frames)

### Pose Detection Capabilities
**Can detect well**:
- Joint positions and angles
- Movement tempo
- Lateral imbalances
- Depth achievement

**Limitations**:
- No barbell detection (need workarounds)
- Lighting sensitivity
- Clothing can affect accuracy

### Performance Optimization
- Process every 3-5 frames for real-time feedback
- Use Web Workers for heavy computation
- Implement efficient video storage/retrieval
- Cache pose detection models

## Success Metrics
- Accurate depth detection (< 5° error)
- Real-time feedback latency < 100ms
- Reliable imbalance detection (> 2" hip shift)
- Smooth video recording at 30fps
- Clear visualization of form improvements over time

## Learning Opportunities
- Browser-based ML and computer vision
- Real-time video processing with WebRTC
- Performance optimization for ML inference
- Data visualization techniques
- PWA development (future phase)

## Next Steps
1. Set up initial Vite + React + TypeScript project
2. Implement basic camera access and recording
3. Integrate MediaPipe Pose and test landmark detection
4. Build first squat depth detection rule

## Open Questions
- Optimal threshold for imbalance detection?
- Best audio cue patterns for real-time feedback?
- How to handle different body types/proportions?
- Storage strategy for video analysis history?