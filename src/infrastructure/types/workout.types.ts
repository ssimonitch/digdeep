export interface WorkoutSession {
  id: string;
  userId: string;
  date: Date;
  exercises: Exercise[];
  duration: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Exercise {
  id: string;
  sessionId: string;
  name: string;
  sets: Set[];
  notes?: string;
  order: number;
}

export interface Set {
  id: string;
  exerciseId: string;
  weight: number;
  reps: number;
  rpe?: number;
  videoUrl?: string;
  videoBlob?: Blob;
  analysis?: SquatAnalysis;
  createdAt: Date;
}

export interface SquatAnalysis {
  id: string;
  setId: string;
  depth: {
    achieved: boolean;
    lowestPoint: number;
    timestamp: number;
  };
  balance: {
    score: number;
    maxDeviation: number;
    timeline: BalancePoint[];
  };
  barPath: {
    deviation: number;
    path: PathPoint[];
  };
  tempo: {
    eccentric: number;
    concentric: number;
    pause: number;
  };
  formIssues: FormIssue[];
  overallScore: number;
  createdAt: Date;
}

export interface BalancePoint {
  timestamp: number;
  deviation: number;
  side: 'left' | 'right' | 'centered';
}

export interface PathPoint {
  x: number;
  y: number;
  timestamp: number;
}

export interface FormIssue {
  type: 'depth' | 'balance' | 'bar_path' | 'tempo';
  severity: 'minor' | 'moderate' | 'major';
  description: string;
  timestamp?: number;
}

export interface UserProfile {
  id: string;
  email?: string;
  name?: string;
  preferences: UserPreferences;
  stats: UserStats;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserPreferences {
  depthTarget: number;
  balanceTolerance: number;
  tempoTargets: {
    eccentric: number;
    concentric: number;
    pause: number;
  };
  audioFeedback: boolean;
  hapticFeedback: boolean;
}

export interface UserStats {
  totalWorkouts: number;
  totalSets: number;
  currentStreak: number;
  bestStreak: number;
  lastWorkoutDate?: Date;
}
