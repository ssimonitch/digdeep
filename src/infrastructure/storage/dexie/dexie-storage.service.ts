import Dexie, { type EntityTable } from 'dexie';

import type { Exercise, Set, SquatAnalysis, UserProfile, WorkoutSession } from '@/infrastructure/types/workout.types';

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
  private database: DigDeepDatabase;

  constructor(database?: DigDeepDatabase) {
    this.database = database ?? db;
  }

  // Session operations
  async createWorkoutSession(session: Omit<WorkoutSession, 'id' | 'createdAt' | 'updatedAt'>): Promise<WorkoutSession> {
    const newSession: WorkoutSession = {
      ...session,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.database.sessions.add(newSession);
    return newSession;
  }

  async getWorkoutSession(id: string): Promise<WorkoutSession | null> {
    return (await this.database.sessions.get(id)) ?? null;
  }

  async getWorkoutSessions(userId: string, limit?: number): Promise<WorkoutSession[]> {
    let sessions = await this.database.sessions.where('userId').equals(userId).toArray();

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

    await this.database.sessions.update(id, updated);

    const session = await this.database.sessions.get(id);
    if (!session) throw new Error('Session not found');

    return session;
  }

  async deleteWorkoutSession(id: string): Promise<void> {
    await this.database.transaction(
      'rw',
      [this.database.sessions, this.database.exercises, this.database.sets, this.database.analyses],
      async () => {
        // Get all exercises for this session
        const exercises = await this.database.exercises.where('sessionId').equals(id).toArray();

        // Delete all sets and analyses for each exercise
        for (const exercise of exercises) {
          await this.deleteExercise(exercise.id);
        }

        // Delete the session
        await this.database.sessions.delete(id);
      },
    );
  }

  // Exercise operations
  async createExercise(exercise: Omit<Exercise, 'id'>): Promise<Exercise> {
    const newExercise: Exercise = {
      ...exercise,
      id: crypto.randomUUID(),
    };

    await this.database.exercises.add(newExercise);
    return newExercise;
  }

  async getExercisesBySession(sessionId: string): Promise<Exercise[]> {
    const exercises = await this.database.exercises.where('sessionId').equals(sessionId).toArray();
    return exercises.sort((a, b) => a.order - b.order);
  }

  async deleteExercise(id: string): Promise<void> {
    await this.database.transaction(
      'rw',
      [this.database.exercises, this.database.sets, this.database.analyses],
      async () => {
        // Get all sets for this exercise
        const sets = await this.database.sets.where('exerciseId').equals(id).toArray();

        // Delete all analyses for each set
        for (const set of sets) {
          await this.database.analyses.where('setId').equals(set.id).delete();
        }

        // Delete all sets for this exercise
        await this.database.sets.where('exerciseId').equals(id).delete();

        // Delete the exercise
        await this.database.exercises.delete(id);
      },
    );
  }

  // Set operations
  async createSet(set: Omit<Set, 'id' | 'createdAt'>): Promise<Set> {
    const newSet: Set = {
      ...set,
      id: crypto.randomUUID(),
      createdAt: new Date(),
    };

    await this.database.sets.add(newSet);
    return newSet;
  }

  async getSetsByExercise(exerciseId: string): Promise<Set[]> {
    return this.database.sets.where('exerciseId').equals(exerciseId).toArray();
  }

  async updateSet(id: string, updates: Partial<Set>): Promise<Set> {
    await this.database.sets.update(id, updates);

    const set = await this.database.sets.get(id);
    if (!set) throw new Error('Set not found');

    return set;
  }

  async deleteSet(id: string): Promise<void> {
    await this.database.transaction('rw', [this.database.sets, this.database.analyses], async () => {
      // Delete analysis for this set
      await this.database.analyses.where('setId').equals(id).delete();

      // Delete the set
      await this.database.sets.delete(id);
    });
  }

  // Analysis operations
  async createAnalysis(analysis: Omit<SquatAnalysis, 'id' | 'createdAt'>): Promise<SquatAnalysis> {
    const newAnalysis: SquatAnalysis = {
      ...analysis,
      id: crypto.randomUUID(),
      createdAt: new Date(),
    };

    await this.database.analyses.add(newAnalysis);
    return newAnalysis;
  }

  async getAnalysisBySetId(setId: string): Promise<SquatAnalysis | null> {
    return (await this.database.analyses.where('setId').equals(setId).first()) ?? null;
  }

  // Profile operations
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    return (await this.database.profiles.get(userId)) ?? null;
  }

  async saveUserProfile(profile: UserProfile): Promise<UserProfile> {
    const updated = {
      ...profile,
      updatedAt: new Date(),
    };

    await this.database.profiles.put(updated);
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
      this.database.sessions.toArray(),
      this.database.exercises.toArray(),
      this.database.sets.toArray(),
      this.database.analyses.toArray(),
      this.database.profiles.toArray(),
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

    await this.database.transaction(
      'rw',
      [
        this.database.sessions,
        this.database.exercises,
        this.database.sets,
        this.database.analyses,
        this.database.profiles,
      ],
      async () => {
        // Clear all data
        await Promise.all([
          this.database.sessions.clear(),
          this.database.exercises.clear(),
          this.database.sets.clear(),
          this.database.analyses.clear(),
          this.database.profiles.clear(),
        ]);

        // Import new data
        if (data.sessions?.length) await this.database.sessions.bulkAdd(data.sessions);
        if (data.exercises?.length) await this.database.exercises.bulkAdd(data.exercises);
        if (data.sets?.length) await this.database.sets.bulkAdd(data.sets);
        if (data.analyses?.length) await this.database.analyses.bulkAdd(data.analyses);
        if (data.profiles?.length) await this.database.profiles.bulkAdd(data.profiles);
      },
    );
  }
}

// Singleton instance
let instance: DexieStorageService | null = null;

export const getDexieStorage = (): DexieStorageService => {
  instance ??= new DexieStorageService();
  return instance;
};
