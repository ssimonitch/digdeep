import Dexie, { type EntityTable } from 'dexie';

import type { Exercise, Set, SquatAnalysis, UserProfile, WorkoutSession } from '@/types/workout.types';

export class DigDeepDatabase extends Dexie {
  sessions!: EntityTable<WorkoutSession, 'id'>;
  exercises!: EntityTable<Exercise, 'id'>;
  sets!: EntityTable<Set, 'id'>;
  analyses!: EntityTable<SquatAnalysis, 'id'>;
  profiles!: EntityTable<UserProfile, 'id'>;

  constructor() {
    super('DigDeepDB');

    this.version(1).stores({
      sessions: '++id, userId, date, createdAt, updatedAt',
      exercises: '++id, sessionId, name, order',
      sets: '++id, exerciseId, createdAt',
      analyses: '++id, setId, createdAt',
      profiles: '++id, createdAt, updatedAt',
    });
  }
}

export const db = new DigDeepDatabase();

export class DexieStorageService {
  // Session operations
  async createWorkoutSession(session: Omit<WorkoutSession, 'id' | 'createdAt' | 'updatedAt'>): Promise<WorkoutSession> {
    const newSession: WorkoutSession = {
      ...session,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.sessions.add(newSession);
    return newSession;
  }

  async getWorkoutSession(id: string): Promise<WorkoutSession | null> {
    return (await db.sessions.get(id)) ?? null;
  }

  async getWorkoutSessions(userId: string, limit?: number): Promise<WorkoutSession[]> {
    let sessions = await db.sessions.where('userId').equals(userId).toArray();

    // Sort by date descending
    sessions = sessions.sort((a, b) => {
      const dateA = a.date instanceof Date ? a.date : new Date(a.date as string);
      const dateB = b.date instanceof Date ? b.date : new Date(b.date as string);
      return dateB.getTime() - dateA.getTime();
    });

    if (limit) {
      return sessions.slice(0, limit);
    }

    return sessions;
  }

  async updateWorkoutSession(id: string, updates: Partial<WorkoutSession>): Promise<WorkoutSession> {
    const updated = {
      ...updates,
      updatedAt: new Date(),
    };

    await db.sessions.update(id, updated);

    const session = await db.sessions.get(id);
    if (!session) throw new Error('Session not found');

    return session;
  }

  async deleteWorkoutSession(id: string): Promise<void> {
    await db.transaction('rw', [db.sessions, db.exercises, db.sets, db.analyses], async () => {
      // Get all exercises for this session
      const exercises = await db.exercises.where('sessionId').equals(id).toArray();

      // Delete all sets and analyses for each exercise
      for (const exercise of exercises) {
        await this.deleteExercise(exercise.id);
      }

      // Delete the session
      await db.sessions.delete(id);
    });
  }

  // Exercise operations
  async createExercise(exercise: Omit<Exercise, 'id'>): Promise<Exercise> {
    const newExercise: Exercise = {
      ...exercise,
      id: crypto.randomUUID(),
    };

    await db.exercises.add(newExercise);
    return newExercise;
  }

  async getExercisesBySession(sessionId: string): Promise<Exercise[]> {
    const exercises = await db.exercises.where('sessionId').equals(sessionId).toArray();
    return exercises.sort((a, b) => a.order - b.order);
  }

  async deleteExercise(id: string): Promise<void> {
    await db.transaction('rw', [db.exercises, db.sets, db.analyses], async () => {
      // Get all sets for this exercise
      const sets = await db.sets.where('exerciseId').equals(id).toArray();

      // Delete all analyses for each set
      for (const set of sets) {
        await db.analyses.where('setId').equals(set.id).delete();
      }

      // Delete all sets for this exercise
      await db.sets.where('exerciseId').equals(id).delete();

      // Delete the exercise
      await db.exercises.delete(id);
    });
  }

  // Set operations
  async createSet(set: Omit<Set, 'id' | 'createdAt'>): Promise<Set> {
    const newSet: Set = {
      ...set,
      id: crypto.randomUUID(),
      createdAt: new Date(),
    };

    await db.sets.add(newSet);
    return newSet;
  }

  async getSetsByExercise(exerciseId: string): Promise<Set[]> {
    return db.sets.where('exerciseId').equals(exerciseId).toArray();
  }

  async updateSet(id: string, updates: Partial<Set>): Promise<Set> {
    await db.sets.update(id, updates);

    const set = await db.sets.get(id);
    if (!set) throw new Error('Set not found');

    return set;
  }

  async deleteSet(id: string): Promise<void> {
    await db.transaction('rw', [db.sets, db.analyses], async () => {
      // Delete analysis for this set
      await db.analyses.where('setId').equals(id).delete();

      // Delete the set
      await db.sets.delete(id);
    });
  }

  // Analysis operations
  async createAnalysis(analysis: Omit<SquatAnalysis, 'id' | 'createdAt'>): Promise<SquatAnalysis> {
    const newAnalysis: SquatAnalysis = {
      ...analysis,
      id: crypto.randomUUID(),
      createdAt: new Date(),
    };

    await db.analyses.add(newAnalysis);
    return newAnalysis;
  }

  async getAnalysisBySetId(setId: string): Promise<SquatAnalysis | null> {
    return (await db.analyses.where('setId').equals(setId).first()) ?? null;
  }

  // Profile operations
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    return (await db.profiles.get(userId)) ?? null;
  }

  async saveUserProfile(profile: UserProfile): Promise<UserProfile> {
    const updated = {
      ...profile,
      updatedAt: new Date(),
    };

    await db.profiles.put(updated);
    return updated;
  }

  // Utility operations
  async getStorageInfo(): Promise<{ usage: number; quota: number; percentage: number }> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      const usage = estimate.usage ?? 0;
      const quota = estimate.quota ?? 0;
      const percentage = quota > 0 ? (usage / quota) * 100 : 0;

      return { usage, quota, percentage };
    }

    return { usage: 0, quota: 0, percentage: 0 };
  }

  async exportData(): Promise<string> {
    const [sessions, exercises, sets, analyses, profiles] = await Promise.all([
      db.sessions.toArray(),
      db.exercises.toArray(),
      db.sets.toArray(),
      db.analyses.toArray(),
      db.profiles.toArray(),
    ]);

    const data = {
      version: 1,
      exportDate: new Date().toISOString(),
      sessions,
      exercises,
      sets,
      analyses,
      profiles,
    };

    return JSON.stringify(data, null, 2);
  }

  async importData(jsonData: string): Promise<void> {
    const data = JSON.parse(jsonData) as {
      version: number;
      sessions?: WorkoutSession[];
      exercises?: Exercise[];
      sets?: Set[];
      analyses?: SquatAnalysis[];
      profiles?: UserProfile[];
    };

    if (data.version !== 1) {
      throw new Error(`Incompatible database version. Expected 1, got ${data.version}`);
    }

    await db.transaction('rw', [db.sessions, db.exercises, db.sets, db.analyses, db.profiles], async () => {
      // Clear all data
      await Promise.all([
        db.sessions.clear(),
        db.exercises.clear(),
        db.sets.clear(),
        db.analyses.clear(),
        db.profiles.clear(),
      ]);

      // Import new data
      if (data.sessions?.length) await db.sessions.bulkAdd(data.sessions);
      if (data.exercises?.length) await db.exercises.bulkAdd(data.exercises);
      if (data.sets?.length) await db.sets.bulkAdd(data.sets);
      if (data.analyses?.length) await db.analyses.bulkAdd(data.analyses);
      if (data.profiles?.length) await db.profiles.bulkAdd(data.profiles);
    });
  }
}

// Singleton instance
let instance: DexieStorageService | null = null;

export const getDexieStorage = (): DexieStorageService => {
  instance ??= new DexieStorageService();
  return instance;
};
