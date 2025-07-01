# DigDeep - Technical Architecture Document

## Overview

This document outlines the technical architecture for the DigDeep form analysis app, optimized for solo development and free tier services while maintaining scalability and performance.

## Technology Stack

### Frontend
- **Build Tool**: Vite (fastest dev experience, excellent HMR)
- **Framework**: React 18 with TypeScript
- **Styling**: Tailwind CSS + CSS Modules for custom components
- **State Management**: Zustand (lightweight, TypeScript-friendly)
- **Routing**: React Router v6
- **ML/Pose Detection**: MediaPipe Pose via @mediapipe/pose
- **Video Processing**: Web APIs (MediaRecorder, Canvas)

### Backend & Services
- **BaaS**: Supabase (PostgreSQL + Auth + Realtime + Storage)
- **Video Storage**: Cloudinary (25GB free, automatic optimization)
- **Deployment**: Vercel (generous free tier, great Vite support)
- **Monitoring**: Vercel Analytics (free tier included)

### Development Tools
- **Code Quality**: ESLint + Prettier + Husky
- **Testing**: Vitest + React Testing Library
- **Type Safety**: TypeScript strict mode
- **Git Strategy**: Feature branches + PR reviews

## Project Structure

```
digdeep-app/
├── src/
│   ├── components/           # Reusable UI components
│   │   ├── ui/              # Base components (Button, Card, etc.)
│   │   ├── feedback/        # Real-time feedback components
│   │   ├── recording/       # Recording-specific components
│   │   └── analysis/        # Analysis view components
│   ├── features/            # Feature-based modules
│   │   ├── recording/       # Recording logic
│   │   ├── analysis/        # Analysis logic
│   │   └── workouts/        # Workout management
│   ├── hooks/               # Custom React hooks
│   │   ├── useCamera.ts
│   │   ├── usePoseDetection.ts
│   │   └── useFormAnalysis.ts
│   ├── lib/                 # Core libraries
│   │   ├── pose/           # Pose detection logic
│   │   ├── analysis/       # Form analysis algorithms
│   │   └── storage/        # Storage abstraction
│   ├── services/           # External service integrations
│   │   ├── supabase/
│   │   └── cloudinary/
│   ├── stores/             # Zustand stores
│   │   ├── recordingStore.ts
│   │   ├── workoutStore.ts
│   │   └── userStore.ts
│   ├── types/              # TypeScript type definitions
│   ├── utils/              # Utility functions
│   └── config/             # Configuration files
├── public/                 # Static assets
├── tests/                  # Test files
└── docs/                   # Documentation
```

## Architecture Patterns

### Component Architecture
```typescript
// Feature-based component structure
interface ComponentStructure {
  // Presentational components (pure, testable)
  components: {
    UI: React.FC<Props>;         // Visual only
    Container: React.FC;         // State management
  };
  
  // Business logic hooks
  hooks: {
    useFeatureLogic: () => FeatureState;
    useFeatureActions: () => FeatureActions;
  };
  
  // Type definitions
  types: {
    Props: interface;
    State: interface;
    Actions: interface;
  };
}
```

### State Management Strategy

#### Local State (React State)
- UI state (modals, form inputs, loading states)
- Temporary recording data
- Real-time feedback values

#### Global State (Zustand)
```typescript
// Example store structure
interface RecordingStore {
  // State
  isRecording: boolean;
  currentRep: number;
  sessionData: SessionData;
  
  // Actions
  startRecording: () => void;
  stopRecording: () => void;
  updateRep: (rep: number) => void;
  
  // Computed
  get totalReps(): number;
}
```

#### Remote State (Supabase)
- User profiles and preferences
- Workout history
- Video metadata
- Analysis results

### Data Flow Architecture

```
User Action → UI Component → Hook → Store → Service → Database
                    ↓                 ↓
              Local Update      Optimistic Update
                    ↓                 ↓
              Immediate UI ← ← ← Server Response
```

## Core Technical Implementations

### 1. Camera & Recording Pipeline

```typescript
// Modular recording pipeline
class RecordingPipeline {
  private mediaStream: MediaStream;
  private mediaRecorder: MediaRecorder;
  private poseDetector: PoseDetector;
  private analysisWorker: Worker;
  
  async initialize() {
    // 1. Request camera access
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      video: { 
        facingMode: 'environment',
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    });
    
    // 2. Initialize MediaRecorder for video capture
    this.mediaRecorder = new MediaRecorder(this.mediaStream, {
      mimeType: 'video/webm;codecs=vp9',
      videoBitsPerSecond: 2500000 // 2.5 Mbps
    });
    
    // 3. Initialize pose detection
    this.poseDetector = await createPoseDetector();
    
    // 4. Start analysis worker for performance
    this.analysisWorker = new Worker('./analysis.worker.ts');
  }
  
  startRecording() {
    this.mediaRecorder.start();
    this.startPoseDetection();
  }
  
  private startPoseDetection() {
    // Process every 3rd frame for performance
    let frameCount = 0;
    const processFrame = async () => {
      if (frameCount++ % 3 === 0) {
        const poses = await this.poseDetector.detectPoses(videoElement);
        this.analysisWorker.postMessage({ poses, timestamp: Date.now() });
      }
      if (this.isRecording) {
        requestAnimationFrame(processFrame);
      }
    };
    processFrame();
  }
}
```

### 2. Real-time Form Analysis

```typescript
// Analysis performed in Web Worker for performance
// analysis.worker.ts
interface AnalysisResult {
  balance: BalanceMetric;
  depth: DepthMetric;
  barPath: PathMetric;
  timestamp: number;
}

self.onmessage = ({ data: { poses, timestamp } }) => {
  if (!poses.length) return;
  
  const landmarks = poses[0].keypoints;
  
  // Calculate metrics
  const balance = calculateBalance(landmarks);
  const depth = calculateDepth(landmarks);
  const barPath = estimateBarPath(landmarks);
  
  // Send results back to main thread
  self.postMessage({
    balance,
    depth,
    barPath,
    timestamp
  });
};

function calculateBalance(landmarks: Keypoint[]): BalanceMetric {
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];
  
  const shift = leftHip.x - rightHip.x;
  const normalized = shift / (rightHip.x - leftHip.x);
  
  return {
    value: normalized,
    direction: shift > 0 ? 'left' : 'right',
    severity: Math.abs(normalized) > 0.1 ? 'warning' : 'good'
  };
}
```

### 3. Storage Strategy

```typescript
// Abstracted storage service
class StorageService {
  private supabase: SupabaseClient;
  private cloudinary: CloudinaryClient;
  
  async saveWorkout(workout: Workout, video: Blob) {
    // 1. Compress video client-side
    const compressed = await this.compressVideo(video);
    
    // 2. Upload to Cloudinary
    const videoUrl = await this.cloudinary.upload(compressed, {
      transformation: [
        { quality: 'auto:good' },
        { fetch_format: 'auto' }
      ]
    });
    
    // 3. Save metadata to Supabase
    const { data } = await this.supabase
      .from('workouts')
      .insert({
        ...workout,
        video_url: videoUrl,
        user_id: this.currentUser.id
      });
      
    return data;
  }
  
  private async compressVideo(blob: Blob): Promise<Blob> {
    // Use browser API for compression
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Resize if needed
    const maxSize = 1280;
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    
    canvas.width = bitmap.width * scale;
    canvas.height = bitmap.height * scale;
    
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    
    return new Promise(resolve => {
      canvas.toBlob(resolve, 'image/webp', 0.8);
    });
  }
}
```

### 4. Performance Optimizations

```typescript
// 1. Lazy load heavy components
const AnalysisView = lazy(() => import('./features/analysis/AnalysisView'));

// 2. Memoize expensive calculations
const useFormMetrics = (landmarks: Keypoint[]) => {
  return useMemo(() => {
    return {
      balance: calculateBalance(landmarks),
      depth: calculateDepth(landmarks),
      path: calculatePath(landmarks)
    };
  }, [landmarks]);
};

// 3. Debounce real-time updates
const useDebouncedFeedback = (value: number, delay: number = 100) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  
  return debouncedValue;
};

// 4. Virtual scrolling for workout history
const WorkoutList = () => {
  return (
    <VirtualList
      height={600}
      itemCount={workouts.length}
      itemSize={120}
      renderItem={({ index, style }) => (
        <WorkoutCard workout={workouts[index]} style={style} />
      )}
    />
  );
};
```

## Database Schema (Supabase)

```sql
-- Users table (handled by Supabase Auth)

-- Workouts table
CREATE TABLE workouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  exercise_type VARCHAR(50) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  weight DECIMAL(5,2),
  total_reps INTEGER,
  notes TEXT
);

-- Sets table
CREATE TABLE sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id UUID REFERENCES workouts(id) ON DELETE CASCADE,
  set_number INTEGER NOT NULL,
  reps INTEGER NOT NULL,
  video_url TEXT,
  thumbnail_url TEXT,
  form_score DECIMAL(3,2),
  analysis_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Focus cues table
CREATE TABLE focus_cues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  exercise_type VARCHAR(50),
  cue_text TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_workouts_user_id ON workouts(user_id);
CREATE INDEX idx_sets_workout_id ON sets(workout_id);
CREATE INDEX idx_focus_cues_user_exercise ON focus_cues(user_id, exercise_type);
```

## API Design

### RESTful Endpoints (via Supabase)

```typescript
// Workout operations
GET    /workouts?user_id=eq.{userId}&order=created_at.desc
POST   /workouts
PATCH  /workouts?id=eq.{workoutId}
DELETE /workouts?id=eq.{workoutId}

// Set operations  
GET    /sets?workout_id=eq.{workoutId}
POST   /sets
PATCH  /sets?id=eq.{setId}

// Analysis data
GET    /sets?id=eq.{setId}&select=analysis_data
```

### Real-time Subscriptions

```typescript
// Subscribe to workout updates
const subscription = supabase
  .from('workouts')
  .on('INSERT', payload => {
    // Update UI with new workout
  })
  .subscribe();
```

## Security Considerations

### Client-side
- Input validation for all forms
- XSS prevention via React's default escaping
- Secure camera permissions handling

### Server-side (Supabase RLS)
```sql
-- Row Level Security policies
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own workouts" ON workouts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own workouts" ON workouts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own workouts" ON workouts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own workouts" ON workouts
  FOR DELETE USING (auth.uid() = user_id);
```

## Implementation Phases

### Phase 1: Foundation (Week 1-2)
1. Project setup with Vite + React + TypeScript
2. Component library implementation
3. Routing and basic navigation
4. Supabase integration + auth

### Phase 2: Recording (Week 3-4)
1. Camera access and controls
2. MediaRecorder implementation
3. Basic UI during recording
4. Video preview functionality

### Phase 3: Pose Detection (Week 5-6)
1. MediaPipe integration
2. Landmark detection testing
3. Performance optimization
4. Worker thread setup

### Phase 4: Real-time Analysis (Week 7-8)
1. Form analysis algorithms
2. Real-time feedback UI
3. Audio cue system
4. Visual indicators

### Phase 5: Storage & Persistence (Week 9-10)
1. Cloudinary integration
2. Video compression
3. Database schema implementation
4. CRUD operations

### Phase 6: Polish & Testing (Week 11-12)
1. Error handling
2. Loading states
3. Performance testing
4. UI/UX refinements

## Monitoring & Analytics

### Performance Metrics
- Time to Interactive (TTI) < 3s
- Pose detection FPS > 10
- Video compression ratio > 70%
- API response time < 200ms

### Error Tracking
```typescript
// Simple error boundary
class ErrorBoundary extends Component {
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('App Error:', error, errorInfo);
    // Send to monitoring service in production
  }
}
```

## Development Best Practices

1. **Type Safety**: Use TypeScript strict mode
2. **Component Isolation**: Build in Storybook
3. **Testing Strategy**: Unit tests for logic, integration tests for flows
4. **Code Splitting**: Lazy load analysis features
5. **Accessibility**: ARIA labels for all interactive elements
6. **Performance**: Profile regularly with Chrome DevTools

## Free Tier Optimization

### Cloudinary (25GB/month)
- Store only PR videos and form issues
- Auto-delete after 30 days
- Compress aggressively (target < 5MB per video)

### Supabase (500MB database)
- Store analysis as compressed JSON
- Implement data retention (90 days)
- Use pagination for all lists

### Vercel (100GB bandwidth)
- Optimize bundle size (< 200KB initial)
- Use CDN for static assets
- Implement caching headers

## Next Steps

1. Set up development environment
2. Create component library based on UI designs
3. Implement basic recording flow
4. Integrate MediaPipe for pose detection
5. Build analysis algorithms
6. Add storage and persistence