import type { Exercise, Set, SquatAnalysis, UserProfile, WorkoutSession } from '@/types/workout.types';

export const createMockWorkoutSession = (overrides: Partial<WorkoutSession> = {}): WorkoutSession => ({
  id: 'session-1',
  userId: 'user-1',
  date: new Date('2025-01-01'),
  exercises: [],
  duration: 3600,
  notes: 'Test session',
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
  ...overrides,
});

export const createMockExercise = (overrides: Partial<Exercise> = {}): Exercise => ({
  id: 'exercise-1',
  sessionId: 'session-1',
  name: 'Back Squat',
  sets: [],
  notes: 'Test exercise',
  order: 1,
  ...overrides,
});

export const createMockSet = (overrides: Partial<Set> = {}): Set => ({
  id: 'set-1',
  exerciseId: 'exercise-1',
  weight: 225,
  reps: 5,
  rpe: 8,
  createdAt: new Date('2025-01-01'),
  ...overrides,
});

export const createMockAnalysis = (overrides: Partial<SquatAnalysis> = {}): SquatAnalysis => ({
  id: 'analysis-1',
  setId: 'set-1',
  depth: {
    achieved: true,
    lowestPoint: 90,
    timestamp: 1500,
  },
  balance: {
    score: 85,
    maxDeviation: 2.5,
    timeline: [
      { timestamp: 1000, deviation: 1.2, side: 'left' },
      { timestamp: 2000, deviation: 0.8, side: 'centered' },
    ],
  },
  barPath: {
    deviation: 1.8,
    path: [
      { x: 100, y: 200, timestamp: 1000 },
      { x: 102, y: 180, timestamp: 2000 },
    ],
  },
  tempo: {
    eccentric: 2.5,
    concentric: 1.2,
    pause: 0.5,
  },
  formIssues: [
    {
      type: 'balance',
      severity: 'minor',
      description: 'Slight forward lean detected',
      timestamp: 1800,
    },
  ],
  overallScore: 82,
  createdAt: new Date('2025-01-01'),
  ...overrides,
});

export const createMockUserProfile = (overrides: Partial<UserProfile> = {}): UserProfile => ({
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  preferences: {
    depthTarget: 90,
    balanceTolerance: 3.0,
    tempoTargets: {
      eccentric: 2.0,
      concentric: 1.5,
      pause: 1.0,
    },
    audioFeedback: true,
    hapticFeedback: false,
  },
  stats: {
    totalWorkouts: 15,
    totalSets: 87,
    currentStreak: 5,
    bestStreak: 12,
    lastWorkoutDate: new Date('2025-01-01'),
  },
  createdAt: new Date('2024-12-01'),
  updatedAt: new Date('2025-01-01'),
  ...overrides,
});

export const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
