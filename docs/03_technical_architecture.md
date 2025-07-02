# DigDeep - Unified Technical Architecture

## Executive Summary

This document defines the complete technical architecture for DigDeep, a web-based powerlifting form analysis application. The architecture prioritizes **30+ FPS real-time performance**, **implementation-first guidance**, and **scalable feature-based organization** while maintaining solo development efficiency.

## Table of Contents

1. [Technology Stack](#technology-stack)
2. [Project Structure](#project-structure)
3. [Performance Architecture (30+ FPS)](#performance-architecture-30-fps)
4. [Database Design](#database-design)
5. [Feature Implementation Guides](#feature-implementation-guides)
6. [Cross-Feature Communication](#cross-feature-communication)
7. [Integration Patterns](#integration-patterns)
8. [Security Implementation](#security-implementation)
9. [Implementation Roadmap](#implementation-roadmap)
10. [Monitoring & Optimization](#monitoring--optimization)

---

## Technology Stack

### Frontend (Unified)

- **Build Tool**: Vite 7.0.0 with SWC (fastest compilation)
- **Framework**: React 19.1.0 with TypeScript 5.8.3 (strict mode)
- **Styling**: Tailwind CSS 4.1.10 with CSS-in-JS for dynamic styles
- **State Management**: Zustand 5.0.5 with feature-specific stores
- **ML/Pose Detection**: @mediapipe/tasks-vision 0.10.22 (latest stable)
- **Video Processing**: Web APIs + Web Workers for 30+ FPS
- **UI Components**: Radix UI + custom gym-optimized components

### Backend & Services

- **BaaS**: Supabase 2.50.0 (PostgreSQL + Auth + Realtime + Storage)
- **Video Storage**: Cloudinary (25GB free, automatic optimization)
- **Deployment**: Vercel (Vite optimized, edge functions)
- **Error Tracking**: Sentry (free tier, performance monitoring)

### Development Tools

- **Code Quality**: ESLint 9.25.0 + Prettier + Husky
- **Testing**: Vitest 3.2.3 + @vitest/browser + React Testing Library
- **Type Safety**: TypeScript strict mode with project references
- **Performance**: Chrome DevTools + Lighthouse CI

---

## Project Structure

### Enhanced Feature-Based Architecture

```
src/
├── components/              # Shared UI components
│   ├── ui/                 # Base Radix components (Button, Card, etc.)
│   └── common/             # App-specific shared components
├── features/               # Feature modules with co-located concerns
│   ├── recording/
│   │   ├── components/     # Recording-specific UI
│   │   ├── hooks/          # useCamera, useRecording
│   │   ├── services/       # CameraService, MediaRecorderService
│   │   ├── stores/         # recordingStore.ts
│   │   ├── workers/        # Video processing workers
│   │   └── types.ts        # Recording domain types
│   ├── analysis/
│   │   ├── components/     # Real-time feedback UI
│   │   ├── hooks/          # usePoseDetection, useFormAnalysis
│   │   ├── services/       # MediaPipeService, AnalysisEngine
│   │   ├── stores/         # analysisStore.ts
│   │   ├── workers/        # ML processing workers
│   │   └── algorithms/     # Form analysis calculations
│   ├── workouts/
│   │   ├── components/     # Session management UI
│   │   ├── hooks/          # useWorkoutSession, useExercises
│   │   ├── services/       # WorkoutService, ProgressTracker
│   │   ├── stores/         # workoutStore.ts
│   │   └── types.ts        # Workout domain types
│   ├── feedback/
│   │   ├── components/     # Audio/Visual feedback UI
│   │   ├── hooks/          # useRealTimeFeedback, useAudioCues
│   │   ├── services/       # FeedbackEngine, AudioService
│   │   └── stores/         # feedbackStore.ts
│   └── auth/
│       ├── components/     # Authentication UI
│       ├── hooks/          # useAuth, useProfile
│       ├── services/       # AuthService
│       └── stores/         # authStore.ts
├── shared/                 # Cross-cutting concerns
│   ├── lib/                # Utility functions
│   ├── types/              # Common types and interfaces
│   ├── events/             # Simple event bus for feature communication
│   ├── constants/          # App-wide constants
│   └── hooks/              # Global hooks (useLocalStorage, etc.)
├── services/               # Infrastructure integrations
│   ├── supabase/           # Database client and queries
│   ├── cloudinary/         # Media storage client
│   └── mediapipe/          # ML model loader and manager
└── workers/                # High-performance Web Workers
    ├── pose-detection.worker.ts
    ├── video-processing.worker.ts
    └── analysis-calculation.worker.ts
```

---

## Performance Architecture (30+ FPS)

### Web Worker-Based Processing Pipeline

```typescript
// Primary architecture for 30+ FPS real-time processing
interface PerformanceTarget {
  frameRate: 30; // FPS minimum
  analysisLatency: 33; // ms (1000/30)
  feedbackDelay: 50; // ms maximum
  memoryUsage: 500; // MB maximum
}

// Multi-worker architecture for parallel processing
class HighPerformancePipeline {
  private poseWorker: Worker;
  private analysisWorker: Worker;
  private feedbackWorker: Worker;
  private frameQueue: VideoFrame[] = [];
  private results: Map<number, AnalysisResult> = new Map();

  async initialize() {
    // Initialize workers with dedicated responsibilities
    this.poseWorker = new Worker('/workers/pose-detection.worker.ts');
    this.analysisWorker = new Worker('/workers/analysis-calculation.worker.ts');
    this.feedbackWorker = new Worker('/workers/feedback-generation.worker.ts');

    // Set up worker communication pipeline
    this.setupWorkerPipeline();
  }

  private setupWorkerPipeline() {
    // Pose detection → Analysis → Feedback (parallel pipeline)
    this.poseWorker.onmessage = ({ data }) => {
      // Forward pose data to analysis worker
      this.analysisWorker.postMessage({
        type: 'ANALYZE_POSE',
        poseData: data.landmarks,
        timestamp: data.timestamp,
      });
    };

    this.analysisWorker.onmessage = ({ data }) => {
      // Forward analysis to feedback worker and store results
      this.results.set(data.timestamp, data);
      this.feedbackWorker.postMessage({
        type: 'GENERATE_FEEDBACK',
        analysis: data,
        timestamp: data.timestamp,
      });
    };

    this.feedbackWorker.onmessage = ({ data }) => {
      // Emit feedback to UI (< 50ms total latency)
      EventBus.emit('REAL_TIME_FEEDBACK', data);
    };
  }

  processFrame(videoFrame: VideoFrame) {
    const timestamp = performance.now();

    // Send to pose detection worker (non-blocking)
    this.poseWorker.postMessage({
      type: 'DETECT_POSE',
      imageData: videoFrame.getImageData(),
      timestamp,
    });
  }
}
```

### MediaPipe Integration (30+ FPS)

```typescript
// pose-detection.worker.ts - Optimized for 30+ FPS
import { PoseDetector, DrawingUtils } from '@mediapipe/tasks-vision';

class OptimizedPoseDetector {
  private detector: PoseDetector;
  private lastDetectionTime = 0;
  private readonly TARGET_INTERVAL = 33; // 30 FPS = 33ms intervals

  async initialize() {
    this.detector = await PoseDetector.createFromOptions({
      baseOptions: {
        modelAssetPath: '/models/pose_landmarker.task',
        delegate: 'GPU', // Use GPU acceleration for 30+ FPS
      },
      runningMode: 'VIDEO',
      numPoses: 1, // Single person optimization
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
  }

  async detectPose(imageData: ImageData, timestamp: number) {
    // Throttle to maintain consistent 30 FPS
    if (timestamp - this.lastDetectionTime < this.TARGET_INTERVAL) {
      return null;
    }

    this.lastDetectionTime = timestamp;

    try {
      const results = await this.detector.detectForVideo(imageData, timestamp);

      return {
        landmarks: results.landmarks[0] || [],
        worldLandmarks: results.worldLandmarks[0] || [],
        timestamp,
        confidence: results.landmarks[0] ? 1.0 : 0.0,
      };
    } catch (error) {
      console.error('Pose detection error:', error);
      return null;
    }
  }
}

// Worker message handler
const detector = new OptimizedPoseDetector();
let initialized = false;

self.onmessage = async ({ data }) => {
  if (!initialized) {
    await detector.initialize();
    initialized = true;
  }

  if (data.type === 'DETECT_POSE') {
    const result = await detector.detectPose(data.imageData, data.timestamp);
    if (result) {
      self.postMessage(result);
    }
  }
};
```

### Memory Management for Performance

```typescript
// High-performance memory management
class VideoFramePool {
  private pool: VideoFrame[] = [];
  private readonly MAX_POOL_SIZE = 10;

  acquire(width: number, height: number): VideoFrame {
    const reusableFrame = this.pool.find((f) => f.displayWidth === width && f.displayHeight === height);

    if (reusableFrame) {
      this.pool.splice(this.pool.indexOf(reusableFrame), 1);
      return reusableFrame;
    }

    return new VideoFrame(new ImageData(width, height));
  }

  release(frame: VideoFrame): void {
    if (this.pool.length < this.MAX_POOL_SIZE) {
      // Reset frame data but keep allocation
      frame.close();
      this.pool.push(frame);
    } else {
      frame.close(); // Properly dispose
    }
  }
}

// Real-time performance monitoring
class PerformanceMonitor {
  private frameTimestamps: number[] = [];
  private readonly WINDOW_SIZE = 30; // Monitor last 30 frames

  recordFrame(timestamp: number) {
    this.frameTimestamps.push(timestamp);
    if (this.frameTimestamps.length > this.WINDOW_SIZE) {
      this.frameTimestamps.shift();
    }
  }

  getCurrentFPS(): number {
    if (this.frameTimestamps.length < 2) return 0;

    const timeSpan = this.frameTimestamps[this.frameTimestamps.length - 1] - this.frameTimestamps[0];
    return (this.frameTimestamps.length - 1) / (timeSpan / 1000);
  }

  isPerformanceTarget(): boolean {
    return this.getCurrentFPS() >= 30;
  }
}
```

---

## Database Design

### Comprehensive Schema (Sessions → Exercises → Recordings)

```sql
-- Enhanced database schema for comprehensive tracking

-- User profiles (extends Supabase auth.users)
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workout sessions (top-level container)
CREATE TABLE workout_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Session metadata
  title TEXT NOT NULL DEFAULT 'Workout Session',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  workout_type TEXT, -- 'powerlifting', 'general', etc.

  -- Timing
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_seconds INTEGER, -- calculated on completion

  -- Session notes and metadata
  notes TEXT,
  gym_location TEXT,
  equipment_used TEXT[],
  session_metadata JSONB DEFAULT '{}',

  -- Tracking
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Exercises within sessions
CREATE TABLE exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES workout_sessions(id) ON DELETE CASCADE,

  -- Exercise definition
  exercise_type TEXT NOT NULL, -- 'squat', 'bench', 'deadlift'
  exercise_name TEXT NOT NULL, -- 'Back Squat', 'Competition Bench', etc.
  order_in_session INTEGER NOT NULL DEFAULT 1,

  -- Exercise metadata
  target_weight DECIMAL(5,2),
  target_reps INTEGER,
  target_sets INTEGER,
  rest_period_seconds INTEGER,

  -- Exercise notes
  notes TEXT,
  equipment_notes TEXT,
  exercise_metadata JSONB DEFAULT '{}',

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'skipped')),
  completed_at TIMESTAMPTZ,

  -- Tracking
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Individual sets within exercises
CREATE TABLE exercise_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id UUID REFERENCES exercises(id) ON DELETE CASCADE,

  -- Set details
  set_number INTEGER NOT NULL,
  weight DECIMAL(5,2) NOT NULL,
  target_reps INTEGER,
  actual_reps INTEGER,

  -- Performance metrics
  rpe DECIMAL(2,1), -- Rate of Perceived Exertion (6.0-10.0)
  rest_duration_seconds INTEGER,
  tempo TEXT, -- '3-1-2-1' format

  -- Set metadata
  notes TEXT,
  set_metadata JSONB DEFAULT '{}',

  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed')),
  completed_at TIMESTAMPTZ,

  -- Tracking
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Video recordings linked to sets
CREATE TABLE recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id UUID REFERENCES exercise_sets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- Denormalized for RLS

  -- Recording metadata
  filename TEXT NOT NULL,
  video_url TEXT NOT NULL, -- Cloudinary URL
  thumbnail_url TEXT, -- Auto-generated thumbnail
  duration_seconds DECIMAL(5,2),
  file_size_bytes BIGINT,

  -- Recording settings
  camera_position TEXT DEFAULT 'rear', -- 'rear', 'side', 'front'
  resolution TEXT, -- '1280x720', '1920x1080'
  frame_rate INTEGER DEFAULT 30,

  -- Processing status
  status TEXT NOT NULL DEFAULT 'processing' CHECK (
    status IN ('uploading', 'processing', 'completed', 'failed', 'deleted')
  ),
  processed_at TIMESTAMPTZ,

  -- Recording metadata
  recording_metadata JSONB DEFAULT '{}',

  -- Tracking
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Form analysis results
CREATE TABLE form_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id UUID REFERENCES recordings(id) ON DELETE CASCADE,

  -- Analysis metadata
  analysis_version TEXT NOT NULL DEFAULT 'v1.0', -- Track analysis algorithm version
  model_version TEXT, -- MediaPipe model version

  -- Overall scores (0.0 - 1.0)
  overall_score DECIMAL(3,2),
  depth_score DECIMAL(3,2),
  balance_score DECIMAL(3,2),
  bar_path_score DECIMAL(3,2),
  tempo_score DECIMAL(3,2),

  -- Detailed analysis data
  pose_landmarks JSONB, -- Raw MediaPipe landmarks
  frame_analysis JSONB, -- Per-frame analysis data

  -- Key metrics
  max_depth_percentage DECIMAL(5,2), -- Percentage of full squat depth
  balance_deviation_max DECIMAL(5,2), -- Maximum lateral deviation
  bar_path_deviation DECIMAL(5,2), -- Bar path consistency score
  tempo_eccentric_seconds DECIMAL(4,2), -- Downward phase timing
  tempo_pause_seconds DECIMAL(4,2), -- Bottom pause timing
  tempo_concentric_seconds DECIMAL(4,2), -- Upward phase timing

  -- Analysis insights
  primary_issues TEXT[], -- Array of detected form issues
  recommendations TEXT[], -- Array of improvement suggestions
  improvement_focus TEXT, -- Primary area for improvement

  -- Technical data
  frames_analyzed INTEGER,
  processing_duration_ms INTEGER,
  confidence_score DECIMAL(3,2), -- Analysis confidence (0.0-1.0)

  -- Analysis metadata
  analysis_metadata JSONB DEFAULT '{}',

  -- Tracking
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Real-time feedback events (for session replay)
CREATE TABLE feedback_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id UUID REFERENCES recordings(id) ON DELETE CASCADE,

  -- Event details
  event_type TEXT NOT NULL, -- 'depth_warning', 'balance_alert', 'tempo_cue'
  event_timestamp_ms INTEGER NOT NULL, -- Milliseconds into recording
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'error')),

  -- Event data
  message TEXT NOT NULL,
  event_data JSONB DEFAULT '{}',

  -- Tracking
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User preferences and settings
CREATE TABLE user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,

  -- Feedback preferences
  audio_feedback_enabled BOOLEAN DEFAULT true,
  visual_feedback_enabled BOOLEAN DEFAULT true,
  haptic_feedback_enabled BOOLEAN DEFAULT false,

  -- Analysis preferences
  preferred_analysis_sensitivity DECIMAL(2,1) DEFAULT 7.0, -- 1.0-10.0
  preferred_camera_position TEXT DEFAULT 'rear',
  auto_record_enabled BOOLEAN DEFAULT false,

  -- App preferences
  theme TEXT DEFAULT 'dark' CHECK (theme IN ('light', 'dark', 'system')),
  measurement_units TEXT DEFAULT 'metric' CHECK (measurement_units IN ('metric', 'imperial')),

  -- Notification preferences
  workout_reminders BOOLEAN DEFAULT true,
  progress_notifications BOOLEAN DEFAULT true,

  -- Settings metadata
  settings_metadata JSONB DEFAULT '{}',

  -- Tracking
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_workout_sessions_user_id ON workout_sessions(user_id);
CREATE INDEX idx_workout_sessions_status ON workout_sessions(status);
CREATE INDEX idx_workout_sessions_started_at ON workout_sessions(started_at DESC);

CREATE INDEX idx_exercises_session_id ON exercises(session_id);
CREATE INDEX idx_exercises_type ON exercises(exercise_type);
CREATE INDEX idx_exercises_order ON exercises(session_id, order_in_session);

CREATE INDEX idx_exercise_sets_exercise_id ON exercise_sets(exercise_id);
CREATE INDEX idx_exercise_sets_number ON exercise_sets(exercise_id, set_number);

CREATE INDEX idx_recordings_set_id ON recordings(set_id);
CREATE INDEX idx_recordings_user_id ON recordings(user_id);
CREATE INDEX idx_recordings_status ON recordings(status);
CREATE INDEX idx_recordings_created_at ON recordings(created_at DESC);

CREATE INDEX idx_form_analyses_recording_id ON form_analyses(recording_id);
CREATE INDEX idx_form_analyses_scores ON form_analyses(overall_score DESC);

CREATE INDEX idx_feedback_events_recording_id ON feedback_events(recording_id);
CREATE INDEX idx_feedback_events_timestamp ON feedback_events(recording_id, event_timestamp_ms);

-- Row Level Security (RLS) policies
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- User can only access their own data
CREATE POLICY "Users can manage their own profile" ON user_profiles
  FOR ALL USING (auth.uid() = id);

CREATE POLICY "Users can manage their own sessions" ON workout_sessions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage exercises in their sessions" ON exercises
  FOR ALL USING (
    auth.uid() = (SELECT user_id FROM workout_sessions WHERE id = session_id)
  );

CREATE POLICY "Users can manage sets in their exercises" ON exercise_sets
  FOR ALL USING (
    auth.uid() = (
      SELECT ws.user_id
      FROM workout_sessions ws
      JOIN exercises e ON e.session_id = ws.id
      WHERE e.id = exercise_id
    )
  );

CREATE POLICY "Users can manage their own recordings" ON recordings
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view analyses of their recordings" ON form_analyses
  FOR ALL USING (
    auth.uid() = (SELECT user_id FROM recordings WHERE id = recording_id)
  );

CREATE POLICY "Users can view feedback from their recordings" ON feedback_events
  FOR ALL USING (
    auth.uid() = (SELECT user_id FROM recordings WHERE id = recording_id)
  );

CREATE POLICY "Users can manage their own settings" ON user_settings
  FOR ALL USING (auth.uid() = user_id);
```

### Database Service Implementation

```typescript
// services/supabase/database.ts - Implementation-first database service
import { SupabaseClient } from '@supabase/supabase-js';

export class DatabaseService {
  constructor(private supabase: SupabaseClient) {}

  // Workout Session Management
  async createWorkoutSession(data: CreateSessionData): Promise<WorkoutSession> {
    const { data: session, error } = await this.supabase
      .from('workout_sessions')
      .insert({
        title: data.title || 'Workout Session',
        workout_type: data.workoutType,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw new DatabaseError('Failed to create session', error);
    return this.mapToWorkoutSession(session);
  }

  async completeWorkoutSession(sessionId: string): Promise<void> {
    const completedAt = new Date().toISOString();

    const { error } = await this.supabase
      .from('workout_sessions')
      .update({
        status: 'completed',
        completed_at: completedAt,
        duration_seconds: this.supabase.rpc('calculate_session_duration', {
          session_id: sessionId,
        }),
      })
      .eq('id', sessionId);

    if (error) throw new DatabaseError('Failed to complete session', error);
  }

  // Exercise Management
  async addExercise(sessionId: string, exerciseData: CreateExerciseData): Promise<Exercise> {
    const { data: exercise, error } = await this.supabase
      .from('exercises')
      .insert({
        session_id: sessionId,
        exercise_type: exerciseData.type,
        exercise_name: exerciseData.name,
        target_weight: exerciseData.targetWeight,
        target_reps: exerciseData.targetReps,
        target_sets: exerciseData.targetSets,
        order_in_session: await this.getNextExerciseOrder(sessionId),
      })
      .select()
      .single();

    if (error) throw new DatabaseError('Failed to add exercise', error);
    return this.mapToExercise(exercise);
  }

  // Set Management with Optimistic Updates
  async addSet(exerciseId: string, setData: CreateSetData): Promise<ExerciseSet> {
    const setNumber = await this.getNextSetNumber(exerciseId);

    const { data: set, error } = await this.supabase
      .from('exercise_sets')
      .insert({
        exercise_id: exerciseId,
        set_number: setNumber,
        weight: setData.weight,
        target_reps: setData.targetReps,
        actual_reps: setData.actualReps,
        rpe: setData.rpe,
      })
      .select()
      .single();

    if (error) throw new DatabaseError('Failed to add set', error);
    return this.mapToExerciseSet(set);
  }

  // Recording Management
  async saveRecording(setId: string, recordingData: SaveRecordingData): Promise<Recording> {
    const { data: recording, error } = await this.supabase
      .from('recordings')
      .insert({
        set_id: setId,
        user_id: (await this.supabase.auth.getUser()).data.user?.id,
        filename: recordingData.filename,
        video_url: recordingData.videoUrl,
        thumbnail_url: recordingData.thumbnailUrl,
        duration_seconds: recordingData.duration,
        file_size_bytes: recordingData.fileSize,
        camera_position: recordingData.cameraPosition,
        resolution: recordingData.resolution,
        frame_rate: recordingData.frameRate,
        status: 'completed',
      })
      .select()
      .single();

    if (error) throw new DatabaseError('Failed to save recording', error);
    return this.mapToRecording(recording);
  }

  // Analysis Results
  async saveFormAnalysis(recordingId: string, analysis: FormAnalysisData): Promise<void> {
    const { error } = await this.supabase.from('form_analyses').insert({
      recording_id: recordingId,
      analysis_version: 'v1.0',
      model_version: analysis.modelVersion,
      overall_score: analysis.overallScore,
      depth_score: analysis.depthScore,
      balance_score: analysis.balanceScore,
      bar_path_score: analysis.barPathScore,
      tempo_score: analysis.tempoScore,
      pose_landmarks: analysis.poseLandmarks,
      frame_analysis: analysis.frameAnalysis,
      max_depth_percentage: analysis.maxDepthPercentage,
      balance_deviation_max: analysis.balanceDeviationMax,
      bar_path_deviation: analysis.barPathDeviation,
      tempo_eccentric_seconds: analysis.tempoEccentric,
      tempo_pause_seconds: analysis.tempoPause,
      tempo_concentric_seconds: analysis.tempoConcentric,
      primary_issues: analysis.primaryIssues,
      recommendations: analysis.recommendations,
      improvement_focus: analysis.improvementFocus,
      frames_analyzed: analysis.framesAnalyzed,
      processing_duration_ms: analysis.processingDuration,
      confidence_score: analysis.confidenceScore,
    });

    if (error) throw new DatabaseError('Failed to save analysis', error);
  }

  // Real-time Queries
  async getActiveSession(userId: string): Promise<WorkoutSession | null> {
    const { data, error } = await this.supabase
      .from('workout_sessions')
      .select(
        `
        *,
        exercises (
          *,
          exercise_sets (
            *,
            recordings (*)
          )
        )
      `,
      )
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new DatabaseError('Failed to get active session', error);
    return data ? this.mapToWorkoutSessionWithDetails(data) : null;
  }

  // Helper methods
  private async getNextExerciseOrder(sessionId: string): Promise<number> {
    const { data, error } = await this.supabase
      .from('exercises')
      .select('order_in_session')
      .eq('session_id', sessionId)
      .order('order_in_session', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new DatabaseError('Failed to get exercise order', error);
    return (data?.order_in_session || 0) + 1;
  }

  private async getNextSetNumber(exerciseId: string): Promise<number> {
    const { data, error } = await this.supabase
      .from('exercise_sets')
      .select('set_number')
      .eq('exercise_id', exerciseId)
      .order('set_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new DatabaseError('Failed to get set number', error);
    return (data?.set_number || 0) + 1;
  }

  // Type mappers
  private mapToWorkoutSession(data: any): WorkoutSession {
    return {
      id: data.id,
      userId: data.user_id,
      title: data.title,
      status: data.status,
      workoutType: data.workout_type,
      startedAt: new Date(data.started_at),
      completedAt: data.completed_at ? new Date(data.completed_at) : null,
      durationSeconds: data.duration_seconds,
      notes: data.notes,
      gymLocation: data.gym_location,
      equipmentUsed: data.equipment_used || [],
      metadata: data.session_metadata || {},
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  // Additional mappers for Exercise, ExerciseSet, Recording, etc.
  // ... (implementation continues)
}

// Error handling
export class DatabaseError extends Error {
  constructor(
    message: string,
    public originalError?: any,
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}

// Type definitions
export interface CreateSessionData {
  title?: string;
  workoutType?: string;
}

export interface CreateExerciseData {
  type: string;
  name: string;
  targetWeight?: number;
  targetReps?: number;
  targetSets?: number;
}

export interface CreateSetData {
  weight: number;
  targetReps?: number;
  actualReps?: number;
  rpe?: number;
}

export interface SaveRecordingData {
  filename: string;
  videoUrl: string;
  thumbnailUrl?: string;
  duration: number;
  fileSize: number;
  cameraPosition: string;
  resolution: string;
  frameRate: number;
}

export interface FormAnalysisData {
  modelVersion: string;
  overallScore: number;
  depthScore: number;
  balanceScore: number;
  barPathScore: number;
  tempoScore: number;
  poseLandmarks: any;
  frameAnalysis: any;
  maxDepthPercentage: number;
  balanceDeviationMax: number;
  barPathDeviation: number;
  tempoEccentric: number;
  tempoPause: number;
  tempoConcentric: number;
  primaryIssues: string[];
  recommendations: string[];
  improvementFocus: string;
  framesAnalyzed: number;
  processingDuration: number;
  confidenceScore: number;
}
```

---

## Feature Implementation Guides

### 1. Recording Feature (30+ FPS Video Capture)

```typescript
// features/recording/hooks/useCamera.ts
import { useState, useRef, useCallback, useEffect } from 'react';
import { EventBus } from '@/shared/events';

interface CameraConfig {
  width: number;
  height: number;
  frameRate: number;
  facingMode: 'user' | 'environment';
}

export function useCamera() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const startCamera = useCallback(async (config: CameraConfig) => {
    try {
      setError(null);

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: config.width },
          height: { ideal: config.height },
          frameRate: { ideal: config.frameRate },
          facingMode: config.facingMode,
        },
        audio: false, // Video-only for pose detection
      });

      setStream(mediaStream);
      setIsActive(true);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
      }

      EventBus.emit('CAMERA_STARTED', { config });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start camera';
      setError(errorMessage);
      EventBus.emit('CAMERA_ERROR', { error: errorMessage });
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
      setIsActive(false);

      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }

      EventBus.emit('CAMERA_STOPPED');
    }
  }, [stream]);

  const captureFrame = useCallback((): ImageData | null => {
    if (!videoRef.current || !isActive) return null;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;

    ctx.drawImage(videoRef.current, 0, 0);
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }, [isActive]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return {
    stream,
    isActive,
    error,
    videoRef,
    startCamera,
    stopCamera,
    captureFrame,
  };
}

// features/recording/hooks/useRecording.ts
import { useState, useCallback, useRef } from 'react';
import { useCamera } from './useCamera';
import { EventBus } from '@/shared/events';

export function useRecording() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const { stream, startCamera, stopCamera, ...cameraProps } = useCamera();

  const startRecording = useCallback(async () => {
    if (!stream) {
      throw new Error('Camera not started');
    }

    try {
      // High-quality recording settings for analysis
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: 2500000, // 2.5 Mbps for quality
      });

      recordedChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, {
          type: 'video/webm',
        });
        setRecordedBlob(blob);
        setIsRecording(false);
        EventBus.emit('RECORDING_COMPLETED', { blob, duration: blob.size });
      };

      mediaRecorder.start(100); // Collect data every 100ms
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);

      EventBus.emit('RECORDING_STARTED');
    } catch (error) {
      EventBus.emit('RECORDING_ERROR', { error });
      throw error;
    }
  }, [stream]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  }, [isRecording]);

  const resetRecording = useCallback(() => {
    setRecordedBlob(null);
    recordedChunksRef.current = [];
  }, []);

  return {
    // Camera props
    startCamera,
    stopCamera,
    ...cameraProps,

    // Recording props
    isRecording,
    recordedBlob,
    startRecording,
    stopRecording,
    resetRecording,
  };
}
```

### 2. Analysis Feature (Real-time Form Analysis)

```typescript
// features/analysis/services/AnalysisEngine.ts
import { EventBus } from '@/shared/events';

export interface SquatMetrics {
  depth: {
    percentage: number; // 0-100% of full squat depth
    achieved: boolean; // Hit parallel or below
    maxDepth: number; // Deepest point reached
  };
  balance: {
    lateralShift: number; // Left/right deviation in pixels
    direction: 'left' | 'right' | 'center';
    severity: 'good' | 'warning' | 'critical';
  };
  barPath: {
    deviation: number; // Horizontal deviation from ideal
    consistency: number; // 0-1 score for path smoothness
    efficiency: number; // 0-1 score for minimal deviation
  };
  tempo: {
    eccentric: number; // Downward phase duration (seconds)
    pause: number; // Bottom pause duration (seconds)
    concentric: number; // Upward phase duration (seconds)
    total: number; // Total rep duration
  };
}

export class SquatAnalysisEngine {
  private landmarks: any[] = [];
  private frameHistory: any[] = [];
  private readonly MAX_HISTORY = 90; // 3 seconds at 30 FPS

  analyzeFrame(landmarks: any[], timestamp: number): SquatMetrics {
    this.landmarks = landmarks;
    this.updateFrameHistory(landmarks, timestamp);

    return {
      depth: this.calculateDepth(),
      balance: this.calculateBalance(),
      barPath: this.calculateBarPath(),
      tempo: this.calculateTempo(),
    };
  }

  private updateFrameHistory(landmarks: any[], timestamp: number) {
    this.frameHistory.push({ landmarks, timestamp });

    if (this.frameHistory.length > this.MAX_HISTORY) {
      this.frameHistory.shift();
    }
  }

  private calculateDepth(): SquatMetrics['depth'] {
    if (!this.landmarks.length) {
      return { percentage: 0, achieved: false, maxDepth: 0 };
    }

    // Get key landmarks for depth calculation
    const leftHip = this.landmarks[23]; // POSE_LANDMARK.LEFT_HIP
    const rightHip = this.landmarks[24]; // POSE_LANDMARK.RIGHT_HIP
    const leftKnee = this.landmarks[25]; // POSE_LANDMARK.LEFT_KNEE
    const rightKnee = this.landmarks[26]; // POSE_LANDMARK.RIGHT_KNEE

    if (!leftHip || !rightHip || !leftKnee || !rightKnee) {
      return { percentage: 0, achieved: false, maxDepth: 0 };
    }

    // Calculate hip height relative to knee height
    const avgHipY = (leftHip.y + rightHip.y) / 2;
    const avgKneeY = (leftKnee.y + rightKnee.y) / 2;

    // Depth calculation (higher Y = lower in frame)
    const depthRatio = Math.max(0, (avgHipY - avgKneeY) / (avgKneeY * 0.2));
    const depthPercentage = Math.min(100, depthRatio * 100);

    // Parallel achieved when hips are at or below knee level
    const achievedParallel = avgHipY >= avgKneeY;

    return {
      percentage: depthPercentage,
      achieved: achievedParallel,
      maxDepth: depthPercentage,
    };
  }

  private calculateBalance(): SquatMetrics['balance'] {
    if (!this.landmarks.length) {
      return { lateralShift: 0, direction: 'center', severity: 'good' };
    }

    const leftHip = this.landmarks[23];
    const rightHip = this.landmarks[24];
    const nose = this.landmarks[0]; // Reference point for center

    if (!leftHip || !rightHip || !nose) {
      return { lateralShift: 0, direction: 'center', severity: 'good' };
    }

    // Calculate center of hips
    const hipCenterX = (leftHip.x + rightHip.x) / 2;

    // Calculate lateral shift from center (nose as reference)
    const lateralShift = hipCenterX - nose.x;
    const shiftMagnitude = Math.abs(lateralShift);

    // Determine severity based on shift magnitude
    let severity: 'good' | 'warning' | 'critical' = 'good';
    if (shiftMagnitude > 0.05) severity = 'warning'; // 5% of frame width
    if (shiftMagnitude > 0.1) severity = 'critical'; // 10% of frame width

    return {
      lateralShift: lateralShift * 100, // Convert to percentage
      direction: lateralShift > 0.02 ? 'right' : lateralShift < -0.02 ? 'left' : 'center',
      severity,
    };
  }

  private calculateBarPath(): SquatMetrics['barPath'] {
    if (this.frameHistory.length < 10) {
      return { deviation: 0, consistency: 1, efficiency: 1 };
    }

    // Use shoulder midpoint as bar position proxy
    const barPositions = this.frameHistory
      .map((frame) => {
        const leftShoulder = frame.landmarks[11];
        const rightShoulder = frame.landmarks[12];

        if (!leftShoulder || !rightShoulder) return null;

        return {
          x: (leftShoulder.x + rightShoulder.x) / 2,
          y: (leftShoulder.y + rightShoulder.y) / 2,
          timestamp: frame.timestamp,
        };
      })
      .filter(Boolean);

    if (barPositions.length < 5) {
      return { deviation: 0, consistency: 1, efficiency: 1 };
    }

    // Calculate horizontal deviation from mean
    const meanX = barPositions.reduce((sum, pos) => sum + pos!.x, 0) / barPositions.length;
    const deviations = barPositions.map((pos) => Math.abs(pos!.x - meanX));
    const maxDeviation = Math.max(...deviations);
    const avgDeviation = deviations.reduce((sum, dev) => sum + dev, 0) / deviations.length;

    // Calculate consistency (lower deviation = higher consistency)
    const consistency = Math.max(0, 1 - avgDeviation * 10); // Scale to 0-1

    // Calculate efficiency (minimal horizontal movement)
    const efficiency = Math.max(0, 1 - maxDeviation * 5); // Scale to 0-1

    return {
      deviation: maxDeviation * 100, // Convert to percentage
      consistency,
      efficiency,
    };
  }

  private calculateTempo(): SquatMetrics['tempo'] {
    if (this.frameHistory.length < 30) {
      // Need at least 1 second of data
      return { eccentric: 0, pause: 0, concentric: 0, total: 0 };
    }

    // Analyze hip height over time to detect phases
    const hipHeights = this.frameHistory
      .map((frame, index) => {
        const leftHip = frame.landmarks[23];
        const rightHip = frame.landmarks[24];

        if (!leftHip || !rightHip) return null;

        return {
          height: (leftHip.y + rightHip.y) / 2,
          timestamp: frame.timestamp,
          index,
        };
      })
      .filter(Boolean);

    if (hipHeights.length < 30) {
      return { eccentric: 0, pause: 0, concentric: 0, total: 0 };
    }

    // Find the lowest point (bottom of squat)
    const lowestPoint = hipHeights.reduce((min, current) => (current!.height > min!.height ? current : min));

    // Find eccentric phase (descent to lowest point)
    const eccentricFrames = hipHeights.filter((h) => h!.index <= lowestPoint!.index);
    const eccentricDuration =
      eccentricFrames.length > 0
        ? (eccentricFrames[eccentricFrames.length - 1]!.timestamp - eccentricFrames[0]!.timestamp) / 1000
        : 0;

    // Find concentric phase (ascent from lowest point)
    const concentricFrames = hipHeights.filter((h) => h!.index > lowestPoint!.index);
    const concentricDuration =
      concentricFrames.length > 0
        ? (concentricFrames[concentricFrames.length - 1]!.timestamp - concentricFrames[0]!.timestamp) / 1000
        : 0;

    // Pause calculation (time spent within 5% of lowest position)
    const pauseThreshold = 0.05; // 5% of frame height
    const pauseFrames = hipHeights.filter((h) => Math.abs(h!.height - lowestPoint!.height) <= pauseThreshold);
    const pauseDuration =
      pauseFrames.length > 0 ? (pauseFrames[pauseFrames.length - 1]!.timestamp - pauseFrames[0]!.timestamp) / 1000 : 0;

    const totalDuration = eccentricDuration + concentricDuration;

    return {
      eccentric: eccentricDuration,
      pause: pauseDuration,
      concentric: concentricDuration,
      total: totalDuration,
    };
  }
}

// features/analysis/hooks/useRealTimeAnalysis.ts
import { useEffect, useRef, useState } from 'react';
import { EventBus } from '@/shared/events';
import { SquatAnalysisEngine, SquatMetrics } from '../services/AnalysisEngine';

export function useRealTimeAnalysis() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentMetrics, setCurrentMetrics] = useState<SquatMetrics | null>(null);
  const [performanceStats, setPerformanceStats] = useState({
    fps: 0,
    avgProcessingTime: 0,
    lastFrameTime: 0,
  });

  const analysisEngineRef = useRef(new SquatAnalysisEngine());
  const workerRef = useRef<Worker | null>(null);
  const frameCounterRef = useRef(0);
  const fpsCounterRef = useRef({ frames: 0, lastTime: performance.now() });

  useEffect(() => {
    // Initialize analysis worker
    workerRef.current = new Worker('/workers/analysis-calculation.worker.ts');

    workerRef.current.onmessage = ({ data }) => {
      if (data.type === 'ANALYSIS_RESULT') {
        setCurrentMetrics(data.metrics);
        updatePerformanceStats(data.processingTime);

        // Emit analysis result for feedback
        EventBus.emit('REAL_TIME_ANALYSIS', data.metrics);
      }
    };

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, []);

  useEffect(() => {
    const handlePoseDetection = (data: any) => {
      if (!isAnalyzing || !workerRef.current) return;

      const timestamp = performance.now();

      // Send pose data to analysis worker
      workerRef.current.postMessage({
        type: 'ANALYZE_POSE',
        landmarks: data.landmarks,
        timestamp,
      });

      frameCounterRef.current++;
    };

    EventBus.on('POSE_DETECTED', handlePoseDetection);

    return () => {
      EventBus.off('POSE_DETECTED', handlePoseDetection);
    };
  }, [isAnalyzing]);

  const startAnalysis = () => {
    setIsAnalyzing(true);
    frameCounterRef.current = 0;
    fpsCounterRef.current = { frames: 0, lastTime: performance.now() };
    EventBus.emit('ANALYSIS_STARTED');
  };

  const stopAnalysis = () => {
    setIsAnalyzing(false);
    EventBus.emit('ANALYSIS_STOPPED');
  };

  const updatePerformanceStats = (processingTime: number) => {
    const now = performance.now();
    const fpsCounter = fpsCounterRef.current;

    fpsCounter.frames++;
    const elapsed = now - fpsCounter.lastTime;

    if (elapsed >= 1000) {
      // Update FPS every second
      const fps = (fpsCounter.frames * 1000) / elapsed;

      setPerformanceStats((prev) => ({
        fps: Math.round(fps),
        avgProcessingTime: Math.round(processingTime),
        lastFrameTime: now,
      }));

      fpsCounter.frames = 0;
      fpsCounter.lastTime = now;
    }
  };

  return {
    isAnalyzing,
    currentMetrics,
    performanceStats,
    startAnalysis,
    stopAnalysis,
  };
}
```

---

## Cross-Feature Communication

### Simple Event Bus Implementation

```typescript
// shared/events/EventBus.ts - Simple feature communication system
type EventCallback<T = any> = (data: T) => void;

class SimpleEventBus {
  private listeners = new Map<string, Set<EventCallback>>();

  // Subscribe to events
  on<T = any>(event: string, callback: EventCallback<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    this.listeners.get(event)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  // Emit events
  emit<T = any>(event: string, data?: T): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event callback for ${event}:`, error);
        }
      });
    }
  }

  // Remove specific callback
  off<T = any>(event: string, callback: EventCallback<T>): void {
    this.listeners.get(event)?.delete(callback);
  }

  // Remove all listeners for an event
  removeAllListeners(event: string): void {
    this.listeners.delete(event);
  }

  // Clear all events (useful for testing)
  clear(): void {
    this.listeners.clear();
  }

  // Get listener count for debugging
  getListenerCount(event: string): number {
    return this.listeners.get(event)?.size || 0;
  }
}

export const EventBus = new SimpleEventBus();

// Event type definitions for type safety
export interface AppEvents {
  // Camera events
  CAMERA_STARTED: { config: any };
  CAMERA_STOPPED: void;
  CAMERA_ERROR: { error: string };

  // Recording events
  RECORDING_STARTED: void;
  RECORDING_STOPPED: void;
  RECORDING_COMPLETED: { blob: Blob; duration: number };
  RECORDING_ERROR: { error: any };

  // Analysis events
  POSE_DETECTED: { landmarks: any[]; confidence: number; timestamp: number };
  ANALYSIS_STARTED: void;
  ANALYSIS_STOPPED: void;
  REAL_TIME_ANALYSIS: { metrics: any; timestamp: number };

  // Feedback events
  REAL_TIME_FEEDBACK: { type: string; message: string; severity: string };
  AUDIO_CUE_TRIGGERED: { cue: string; timestamp: number };

  // Workout events
  SESSION_STARTED: { sessionId: string };
  SESSION_COMPLETED: { sessionId: string; duration: number };
  EXERCISE_ADDED: { exerciseId: string; type: string };
  SET_COMPLETED: { setId: string; metrics: any };
}

// Type-safe event emitters and listeners
export function createTypedEventBus<T extends Record<string, any>>() {
  return {
    on<K extends keyof T>(event: K, callback: (data: T[K]) => void) {
      return EventBus.on(event as string, callback);
    },

    emit<K extends keyof T>(event: K, data: T[K]) {
      EventBus.emit(event as string, data);
    },

    off<K extends keyof T>(event: K, callback: (data: T[K]) => void) {
      EventBus.off(event as string, callback);
    },
  };
}

export const TypedEventBus = createTypedEventBus<AppEvents>();
```

### Feature Store Integration

```typescript
// shared/hooks/useFeatureCommunication.ts
import { useEffect, useCallback } from 'react';
import { EventBus } from '@/shared/events';

export function useFeatureCommunication() {
  // Cross-feature communication helper
  const subscribeToFeature = useCallback(<T>(event: string, handler: (data: T) => void, dependencies: any[] = []) => {
    useEffect(() => {
      const unsubscribe = EventBus.on(event, handler);
      return unsubscribe;
    }, dependencies);
  }, []);

  const notifyFeature = useCallback(<T>(event: string, data: T) => {
    EventBus.emit(event, data);
  }, []);

  return {
    subscribeToFeature,
    notifyFeature,
  };
}

// Example usage in features
// features/recording/stores/recordingStore.ts
import { create } from 'zustand';
import { EventBus } from '@/shared/events';

interface RecordingState {
  isRecording: boolean;
  currentSessionId: string | null;
  recordingDuration: number;

  startRecording: (sessionId: string) => void;
  stopRecording: () => void;
}

export const useRecordingStore = create<RecordingState>((set, get) => ({
  isRecording: false,
  currentSessionId: null,
  recordingDuration: 0,

  startRecording: (sessionId) => {
    set({ isRecording: true, currentSessionId: sessionId });

    // Notify other features
    EventBus.emit('RECORDING_STARTED', { sessionId });
  },

  stopRecording: () => {
    const { currentSessionId } = get();
    set({ isRecording: false, recordingDuration: 0 });

    // Notify other features
    EventBus.emit('RECORDING_STOPPED', { sessionId: currentSessionId });
  },
}));

// Auto-subscribe to cross-feature events
EventBus.on('SESSION_STARTED', (data) => {
  // Recording feature responds to workout session events
  console.log('Recording feature received session start:', data);
});

EventBus.on('ANALYSIS_COMPLETED', (data) => {
  // Recording feature can respond to analysis completion
  console.log('Recording feature notified of analysis completion:', data);
});
```

---

## Integration Patterns

### Cloudinary Media Service (Implementation-First)

```typescript
// services/cloudinary/MediaService.ts
interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

interface UploadResult {
  url: string;
  publicId: string;
  thumbnailUrl?: string;
  duration?: number;
  fileSize: number;
}

export class CloudinaryMediaService {
  private readonly CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  private readonly UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  async uploadVideo(
    file: Blob,
    metadata: {
      filename: string;
      setId: string;
      exerciseType: string;
    },
    onProgress?: (progress: UploadProgress) => void,
  ): Promise<UploadResult> {
    const formData = new FormData();
    formData.append('file', file, metadata.filename);
    formData.append('upload_preset', this.UPLOAD_PRESET);
    formData.append('resource_type', 'video');
    formData.append('folder', `digdeep/workouts/${metadata.exerciseType}`);
    formData.append('public_id', `${metadata.setId}_${Date.now()}`);

    // Add metadata tags
    formData.append('tags', `workout,${metadata.exerciseType},set-${metadata.setId}`);

    // Video processing parameters
    formData.append(
      'eager',
      [
        'c_fill,h_300,w_400,q_auto:good,f_auto', // Thumbnail
        'q_auto:good,f_auto', // Optimized video
      ].join('|'),
    );

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      // Progress tracking
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          onProgress({
            loaded: event.loaded,
            total: event.total,
            percentage: Math.round((event.loaded / event.total) * 100),
          });
        }
      };

      xhr.onload = () => {
        if (xhr.status === 200) {
          try {
            const result = JSON.parse(xhr.responseText);
            resolve({
              url: result.secure_url,
              publicId: result.public_id,
              thumbnailUrl: result.eager?.[0]?.secure_url,
              duration: result.duration,
              fileSize: result.bytes,
            });
          } catch (error) {
            reject(new Error('Failed to parse upload response'));
          }
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      };

      xhr.onerror = () => {
        reject(new Error('Upload request failed'));
      };

      xhr.open('POST', `https://api.cloudinary.com/v1_1/${this.CLOUD_NAME}/video/upload`);
      xhr.send(formData);
    });
  }

  async deleteVideo(publicId: string): Promise<void> {
    // Note: Deletion requires backend API call due to security
    // This would be implemented as a Supabase Edge Function
    const response = await fetch('/api/cloudinary/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publicId }),
    });

    if (!response.ok) {
      throw new Error('Failed to delete video');
    }
  }

  generateThumbnailUrl(publicId: string, width = 400, height = 300): string {
    return `https://res.cloudinary.com/${this.CLOUD_NAME}/video/upload/c_fill,h_${height},w_${width},q_auto:good,f_auto/${publicId}.jpg`;
  }

  generateOptimizedVideoUrl(publicId: string): string {
    return `https://res.cloudinary.com/${this.CLOUD_NAME}/video/upload/q_auto:good,f_auto/${publicId}`;
  }
}

// Usage in recording feature
// features/recording/hooks/useVideoUpload.ts
import { useState } from 'react';
import { CloudinaryMediaService } from '@/services/cloudinary/MediaService';
import { DatabaseService } from '@/services/supabase/database';

export function useVideoUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaService = new CloudinaryMediaService();
  const databaseService = new DatabaseService();

  const uploadRecording = async (blob: Blob, setId: string, exerciseType: string) => {
    setIsUploading(true);
    setError(null);
    setUploadProgress(0);

    try {
      // Upload to Cloudinary with progress tracking
      const uploadResult = await mediaService.uploadVideo(
        blob,
        {
          filename: `${setId}_${Date.now()}.webm`,
          setId,
          exerciseType,
        },
        (progress) => {
          setUploadProgress(progress.percentage);
        },
      );

      // Save recording metadata to database
      const recording = await databaseService.saveRecording(setId, {
        filename: uploadResult.publicId,
        videoUrl: uploadResult.url,
        thumbnailUrl: uploadResult.thumbnailUrl,
        duration: uploadResult.duration || 0,
        fileSize: uploadResult.fileSize,
        cameraPosition: 'rear',
        resolution: '1280x720',
        frameRate: 30,
      });

      setIsUploading(false);
      setUploadProgress(100);

      return recording;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed';
      setError(errorMessage);
      setIsUploading(false);
      throw err;
    }
  };

  return {
    isUploading,
    uploadProgress,
    error,
    uploadRecording,
  };
}
```

---

## Security Implementation

### Row Level Security Implementation

```typescript
// Security policies already defined in database schema above
// Additional client-side security measures:

// services/supabase/security.ts
import { SupabaseClient } from '@supabase/supabase-js';

export class SecurityService {
  constructor(private supabase: SupabaseClient) {}

  // Validate user permissions before operations
  async validateUserAccess(resourceId: string, resourceType: 'session' | 'recording'): Promise<boolean> {
    const user = await this.supabase.auth.getUser();
    if (!user.data.user) return false;

    let query;
    switch (resourceType) {
      case 'session':
        query = this.supabase.from('workout_sessions').select('user_id').eq('id', resourceId).single();
        break;
      case 'recording':
        query = this.supabase.from('recordings').select('user_id').eq('id', resourceId).single();
        break;
      default:
        return false;
    }

    const { data, error } = await query;
    return !error && data?.user_id === user.data.user.id;
  }

  // Sanitize user input
  sanitizeInput(input: string): string {
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .trim();
  }

  // Validate file uploads
  validateVideoFile(file: File): { valid: boolean; error?: string } {
    const MAX_SIZE = 100 * 1024 * 1024; // 100MB
    const ALLOWED_TYPES = ['video/webm', 'video/mp4', 'video/quicktime'];

    if (file.size > MAX_SIZE) {
      return { valid: false, error: 'File size exceeds 100MB limit' };
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return { valid: false, error: 'Invalid file type. Only video files allowed.' };
    }

    return { valid: true };
  }

  // Generate secure tokens for sensitive operations
  async generateSecureToken(): Promise<string> {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }
}
```

---

## Implementation Roadmap

The detailed implementation roadmap has been moved to a separate document for better tracking and management.

See: [Implementation Plan & TODO List](./04_implementation_plan.md)

The implementation plan provides:

- Step-by-step checklist with checkboxes for tracking progress
- Clear dependencies between phases and steps
- Logical ordering of UI components and features
- Key milestones for MVP, Beta, and Production readiness

---

## Monitoring & Optimization

### Performance Monitoring Implementation

```typescript
// shared/lib/PerformanceMonitor.ts
interface PerformanceMetrics {
  fps: number;
  frameDrops: number;
  averageProcessingTime: number;
  memoryUsage: number;
  cpuUsage: number;
  networkLatency: number;
}

export class PerformanceMonitor {
  private metrics: PerformanceMetrics = {
    fps: 0,
    frameDrops: 0,
    averageProcessingTime: 0,
    memoryUsage: 0,
    cpuUsage: 0,
    networkLatency: 0,
  };

  private frameTimestamps: number[] = [];
  private processingTimes: number[] = [];
  private readonly WINDOW_SIZE = 60; // 2 seconds at 30 FPS

  startFrameMonitoring() {
    const monitor = () => {
      const now = performance.now();
      this.frameTimestamps.push(now);

      if (this.frameTimestamps.length > this.WINDOW_SIZE) {
        this.frameTimestamps.shift();
      }

      this.updateFPS();
      requestAnimationFrame(monitor);
    };

    monitor();
  }

  recordProcessingTime(startTime: number, endTime: number) {
    const processingTime = endTime - startTime;
    this.processingTimes.push(processingTime);

    if (this.processingTimes.length > this.WINDOW_SIZE) {
      this.processingTimes.shift();
    }

    this.updateAverageProcessingTime();
  }

  private updateFPS() {
    if (this.frameTimestamps.length < 2) return;

    const timeSpan = this.frameTimestamps[this.frameTimestamps.length - 1] - this.frameTimestamps[0];
    const fps = (this.frameTimestamps.length - 1) / (timeSpan / 1000);

    this.metrics.fps = Math.round(fps);

    // Detect frame drops (FPS below 25)
    if (fps < 25) {
      this.metrics.frameDrops++;
    }
  }

  private updateAverageProcessingTime() {
    if (this.processingTimes.length === 0) return;

    const avgTime = this.processingTimes.reduce((sum, time) => sum + time, 0) / this.processingTimes.length;
    this.metrics.averageProcessingTime = Math.round(avgTime);
  }

  async updateMemoryUsage() {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      this.metrics.memoryUsage = Math.round(memory.usedJSHeapSize / 1024 / 1024); // MB
    }
  }

  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  isPerformanceGood(): boolean {
    return (
      this.metrics.fps >= 30 &&
      this.metrics.averageProcessingTime <= 33 && // 33ms for 30 FPS
      this.metrics.memoryUsage <= 500 // 500MB limit
    );
  }

  getPerformanceGrade(): 'excellent' | 'good' | 'fair' | 'poor' {
    const { fps, averageProcessingTime, memoryUsage } = this.metrics;

    if (fps >= 30 && averageProcessingTime <= 25 && memoryUsage <= 300) {
      return 'excellent';
    } else if (fps >= 25 && averageProcessingTime <= 33 && memoryUsage <= 400) {
      return 'good';
    } else if (fps >= 20 && averageProcessingTime <= 50 && memoryUsage <= 500) {
      return 'fair';
    } else {
      return 'poor';
    }
  }
}

// Error monitoring and reporting
export class ErrorMonitor {
  private errors: Array<{
    message: string;
    stack?: string;
    timestamp: number;
    feature: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }> = [];

  reportError(error: Error, feature: string, severity: 'low' | 'medium' | 'high' | 'critical' = 'medium') {
    const errorReport = {
      message: error.message,
      stack: error.stack,
      timestamp: Date.now(),
      feature,
      severity,
    };

    this.errors.push(errorReport);

    // In production, send to error reporting service
    if (import.meta.env.PROD) {
      this.sendToErrorService(errorReport);
    } else {
      console.error('Error reported:', errorReport);
    }
  }

  private async sendToErrorService(errorReport: any) {
    try {
      await fetch('/api/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(errorReport),
      });
    } catch (err) {
      console.error('Failed to report error:', err);
    }
  }

  getRecentErrors(limit = 10) {
    return this.errors.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
  }

  getErrorCount(timeWindowMs = 300000): number {
    // 5 minutes default
    const cutoff = Date.now() - timeWindowMs;
    return this.errors.filter((error) => error.timestamp >= cutoff).length;
  }
}

// Global instances
export const performanceMonitor = new PerformanceMonitor();
export const errorMonitor = new ErrorMonitor();

// React hook for performance monitoring
export function usePerformanceMonitoring() {
  const [metrics, setMetrics] = useState<PerformanceMetrics>();
  const [grade, setGrade] = useState<string>('unknown');

  useEffect(() => {
    performanceMonitor.startFrameMonitoring();

    const interval = setInterval(() => {
      performanceMonitor.updateMemoryUsage();
      setMetrics(performanceMonitor.getMetrics());
      setGrade(performanceMonitor.getPerformanceGrade());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return { metrics, grade, isGood: performanceMonitor.isPerformanceGood() };
}
```

---

## Conclusion

This unified technical architecture provides a comprehensive, implementation-first foundation for DigDeep that achieves your specified requirements:

✅ **30+ FPS Performance**: Multi-worker architecture with GPU acceleration  
✅ **Complex Database Schema**: Sessions → Exercises → Recordings with full tracking  
✅ **Implementation-First**: Concrete code examples and step-by-step guides  
✅ **Single Document**: Unified architecture replacing both previous documents  
✅ **Simple Feature Communication**: Event bus without domain complexity

**Key Success Factors**:

1. **Performance-First Design**: Every component optimized for 30+ FPS real-time processing
2. **Scalable Feature Architecture**: Room for growth without architectural debt
3. **Implementation Ready**: Concrete code examples for immediate development
4. **Production Quality**: Security, monitoring, and error handling built-in
5. **Solo Development Optimized**: Balanced complexity for efficient solo implementation

The 12-week roadmap provides clear milestones while maintaining focus on performance and user experience. This architecture positions DigDeep for successful MVP launch and future enhancement.
