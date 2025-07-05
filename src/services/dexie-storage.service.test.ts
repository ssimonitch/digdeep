import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createMockAnalysis,
  createMockExercise,
  createMockSet,
  createMockUserProfile,
  createMockWorkoutSession,
} from '@/test/test-utils';
import type { Exercise, Set, SquatAnalysis, WorkoutSession } from '@/types/workout.types';

import { DexieStorageService, DigDeepDatabase } from './dexie-storage.service';

describe('DexieStorageService', () => {
  let service: DexieStorageService;
  let db: DigDeepDatabase;

  beforeEach(async () => {
    // Create fresh instances for each test
    db = new DigDeepDatabase();
    service = new DexieStorageService();

    // Ensure database is ready
    await db.open();
  });

  afterEach(async () => {
    await db.delete();
  });

  describe('Database Initialization', () => {
    it('should initialize database with correct schema', () => {
      expect(db.isOpen()).toBe(true);
      expect(db.tables).toHaveLength(5);
      expect(db.tables.map((t) => t.name)).toEqual(['sessions', 'exercises', 'sets', 'analyses', 'profiles']);
    });

    it('should have correct table schemas', () => {
      const sessions = db.sessions.schema;
      expect(sessions.primKey.name).toBe('id');
      expect(sessions.indexes.map((i) => i.name)).toContain('userId');
      expect(sessions.indexes.map((i) => i.name)).toContain('date');

      const exercises = db.exercises.schema;
      expect(exercises.indexes.map((i) => i.name)).toContain('sessionId');

      const sets = db.sets.schema;
      expect(sets.indexes.map((i) => i.name)).toContain('exerciseId');

      const analyses = db.analyses.schema;
      expect(analyses.indexes.map((i) => i.name)).toContain('setId');
    });
  });

  describe('Workout Session Operations', () => {
    it('should create a workout session', async () => {
      const mockSession = createMockWorkoutSession();
      const sessionData: Omit<WorkoutSession, 'id' | 'createdAt' | 'updatedAt'> = {
        userId: mockSession.userId,
        date: mockSession.date,
        exercises: mockSession.exercises,
        duration: mockSession.duration,
        notes: mockSession.notes,
      };

      const session = await service.createWorkoutSession(sessionData);

      expect(session.id).toBeDefined();
      expect(session.userId).toBe(sessionData.userId);
      expect(session.duration).toBe(sessionData.duration);
      expect(session.createdAt).toBeInstanceOf(Date);
      expect(session.updatedAt).toBeInstanceOf(Date);
    });

    it('should get a workout session by id', async () => {
      const session = await service.createWorkoutSession(createMockWorkoutSession());

      const retrieved = await service.getWorkoutSession(session.id);

      expect(retrieved).toEqual(session);
    });

    it('should return null for non-existent session', async () => {
      const result = await service.getWorkoutSession('non-existent');
      expect(result).toBeNull();
    });

    it('should get workout sessions by user with limit', async () => {
      const userId = 'user-1';

      // Create multiple sessions
      await Promise.all([
        service.createWorkoutSession(
          createMockWorkoutSession({
            userId,
            date: new Date('2025-01-01'),
          }),
        ),
        service.createWorkoutSession(
          createMockWorkoutSession({
            userId,
            date: new Date('2025-01-02'),
          }),
        ),
        service.createWorkoutSession(
          createMockWorkoutSession({
            userId,
            date: new Date('2025-01-03'),
          }),
        ),
      ]);

      const allSessions = await service.getWorkoutSessions(userId);
      expect(allSessions).toHaveLength(3);

      // Should be sorted by date descending
      expect(allSessions[0].date.getTime()).toBeGreaterThan(allSessions[1].date.getTime());

      const limitedSessions = await service.getWorkoutSessions(userId, 2);
      expect(limitedSessions).toHaveLength(2);
    });

    it('should update a workout session', async () => {
      const session = await service.createWorkoutSession(createMockWorkoutSession());

      // Add small delay to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 1));

      const updates = { duration: 7200, notes: 'Updated notes' };
      const updated = await service.updateWorkoutSession(session.id, updates);

      expect(updated.duration).toBe(7200);
      expect(updated.notes).toBe('Updated notes');
      expect(updated.updatedAt.getTime()).toBeGreaterThan(session.updatedAt.getTime());
    });

    it('should delete a workout session and cascading data', async () => {
      // Create session with nested data
      const session = await service.createWorkoutSession(createMockWorkoutSession());
      const exercise = await service.createExercise(createMockExercise({ sessionId: session.id }));
      const set = await service.createSet(createMockSet({ exerciseId: exercise.id }));
      await service.createAnalysis(createMockAnalysis({ setId: set.id }));

      // Delete session
      await service.deleteWorkoutSession(session.id);

      // Verify cascading delete
      expect(await service.getWorkoutSession(session.id)).toBeNull();
      expect(await service.getExercisesBySession(session.id)).toHaveLength(0);
      expect(await service.getSetsByExercise(exercise.id)).toHaveLength(0);
      expect(await service.getAnalysisBySetId(set.id)).toBeNull();
    });
  });

  describe('Exercise Operations', () => {
    let session: WorkoutSession;

    beforeEach(async () => {
      session = await service.createWorkoutSession(createMockWorkoutSession());
    });

    it('should create an exercise', async () => {
      const mockExercise = createMockExercise({ sessionId: session.id });
      const exerciseData: Omit<Exercise, 'id'> = {
        sessionId: mockExercise.sessionId,
        name: mockExercise.name,
        sets: mockExercise.sets,
        notes: mockExercise.notes,
        order: mockExercise.order,
      };

      const exercise = await service.createExercise(exerciseData);

      expect(exercise.id).toBeDefined();
      expect(exercise.sessionId).toBe(session.id);
      expect(exercise.name).toBe(exerciseData.name);
      expect(exercise.order).toBe(exerciseData.order);
    });

    it('should get exercises by session ordered by order', async () => {
      await service.createExercise(
        createMockExercise({
          sessionId: session.id,
          name: 'Exercise 2',
          order: 2,
        }),
      );
      await service.createExercise(
        createMockExercise({
          sessionId: session.id,
          name: 'Exercise 1',
          order: 1,
        }),
      );

      const exercises = await service.getExercisesBySession(session.id);

      expect(exercises).toHaveLength(2);
      expect(exercises[0].name).toBe('Exercise 1');
      expect(exercises[1].name).toBe('Exercise 2');
    });

    it('should delete exercise and cascading sets/analyses', async () => {
      const exercise = await service.createExercise(createMockExercise({ sessionId: session.id }));
      const set = await service.createSet(createMockSet({ exerciseId: exercise.id }));
      await service.createAnalysis(createMockAnalysis({ setId: set.id }));

      await service.deleteExercise(exercise.id);

      expect(await service.getExercisesBySession(session.id)).toHaveLength(0);
      expect(await service.getSetsByExercise(exercise.id)).toHaveLength(0);
      expect(await service.getAnalysisBySetId(set.id)).toBeNull();
    });
  });

  describe('Set Operations', () => {
    let exercise: Exercise;

    beforeEach(async () => {
      const session = await service.createWorkoutSession(createMockWorkoutSession());
      exercise = await service.createExercise(createMockExercise({ sessionId: session.id }));
    });

    it('should create a set', async () => {
      const mockSet = createMockSet({ exerciseId: exercise.id });
      const setData: Omit<Set, 'id' | 'createdAt'> = {
        exerciseId: mockSet.exerciseId,
        weight: mockSet.weight,
        reps: mockSet.reps,
        rpe: mockSet.rpe,
        videoUrl: mockSet.videoUrl,
        videoBlob: mockSet.videoBlob,
        analysis: mockSet.analysis,
      };

      const set = await service.createSet(setData);

      expect(set.id).toBeDefined();
      expect(set.exerciseId).toBe(exercise.id);
      expect(set.weight).toBe(setData.weight);
      expect(set.reps).toBe(setData.reps);
      expect(set.createdAt).toBeInstanceOf(Date);
    });

    it('should get sets by exercise', async () => {
      await service.createSet(createMockSet({ exerciseId: exercise.id, weight: 225 }));
      await service.createSet(createMockSet({ exerciseId: exercise.id, weight: 235 }));

      const sets = await service.getSetsByExercise(exercise.id);

      expect(sets).toHaveLength(2);
      expect(sets.some((s) => s.weight === 225)).toBe(true);
      expect(sets.some((s) => s.weight === 235)).toBe(true);
    });

    it('should update a set', async () => {
      const set = await service.createSet(createMockSet({ exerciseId: exercise.id }));

      const updates = { weight: 245, rpe: 9 };
      const updated = await service.updateSet(set.id, updates);

      expect(updated.weight).toBe(245);
      expect(updated.rpe).toBe(9);
    });

    it('should delete set and analysis', async () => {
      const set = await service.createSet(createMockSet({ exerciseId: exercise.id }));
      await service.createAnalysis(createMockAnalysis({ setId: set.id }));

      await service.deleteSet(set.id);

      expect(await service.getSetsByExercise(exercise.id)).toHaveLength(0);
      expect(await service.getAnalysisBySetId(set.id)).toBeNull();
    });
  });

  describe('Analysis Operations', () => {
    let set: Set;

    beforeEach(async () => {
      const session = await service.createWorkoutSession(createMockWorkoutSession());
      const exercise = await service.createExercise(createMockExercise({ sessionId: session.id }));
      set = await service.createSet(createMockSet({ exerciseId: exercise.id }));
    });

    it('should create an analysis', async () => {
      const mockAnalysis = createMockAnalysis({ setId: set.id });
      const analysisData: Omit<SquatAnalysis, 'id' | 'createdAt'> = {
        setId: mockAnalysis.setId,
        depth: mockAnalysis.depth,
        balance: mockAnalysis.balance,
        barPath: mockAnalysis.barPath,
        tempo: mockAnalysis.tempo,
        formIssues: mockAnalysis.formIssues,
        overallScore: mockAnalysis.overallScore,
      };

      const analysis = await service.createAnalysis(analysisData);

      expect(analysis.id).toBeDefined();
      expect(analysis.setId).toBe(set.id);
      expect(analysis.depth.achieved).toBe(analysisData.depth.achieved);
      expect(analysis.balance.score).toBe(analysisData.balance.score);
      expect(analysis.overallScore).toBe(analysisData.overallScore);
      expect(analysis.createdAt).toBeInstanceOf(Date);
    });

    it('should get analysis by set id', async () => {
      const analysis = await service.createAnalysis(createMockAnalysis({ setId: set.id }));

      const retrieved = await service.getAnalysisBySetId(set.id);

      expect(retrieved).toEqual(analysis);
    });

    it('should return null for non-existent analysis', async () => {
      const result = await service.getAnalysisBySetId('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('User Profile Operations', () => {
    it('should save and get user profile', async () => {
      const profile = createMockUserProfile();

      const saved = await service.saveUserProfile(profile);

      expect(saved.id).toBe(profile.id);
      expect(saved.updatedAt.getTime()).toBeGreaterThanOrEqual(profile.updatedAt.getTime());

      const retrieved = await service.getUserProfile(profile.id);
      expect(retrieved).toEqual(saved);
    });

    it('should return null for non-existent profile', async () => {
      const result = await service.getUserProfile('non-existent');
      expect(result).toBeNull();
    });

    it('should update existing profile', async () => {
      const profile = createMockUserProfile();
      await service.saveUserProfile(profile);

      const updated = await service.saveUserProfile({
        ...profile,
        name: 'Updated Name',
        stats: { ...profile.stats, totalWorkouts: 20 },
      });

      expect(updated.name).toBe('Updated Name');
      expect(updated.stats.totalWorkouts).toBe(20);
    });
  });

  describe('Storage Info Operations', () => {
    it('should get storage info', async () => {
      const info = await service.getStorageInfo();

      expect(info).toHaveProperty('usage');
      expect(info).toHaveProperty('quota');
      expect(info).toHaveProperty('percentage');
      expect(typeof info.usage).toBe('number');
      expect(typeof info.quota).toBe('number');
      expect(typeof info.percentage).toBe('number');
    });
  });

  describe('Export/Import Operations', () => {
    it('should export data as JSON', async () => {
      // Create test data
      const session = await service.createWorkoutSession(createMockWorkoutSession());
      const exercise = await service.createExercise(createMockExercise({ sessionId: session.id }));
      const set = await service.createSet(createMockSet({ exerciseId: exercise.id }));
      await service.createAnalysis(createMockAnalysis({ setId: set.id }));
      await service.saveUserProfile(createMockUserProfile());

      const exported = await service.exportData();
      const data = JSON.parse(exported) as {
        version: number;
        exportDate: string;
        sessions: unknown[];
        exercises: unknown[];
        sets: unknown[];
        analyses: unknown[];
        profiles: unknown[];
      };

      expect(data.version).toBe(1);
      expect(data.exportDate).toBeDefined();
      expect(data.sessions).toHaveLength(1);
      expect(data.exercises).toHaveLength(1);
      expect(data.sets).toHaveLength(1);
      expect(data.analyses).toHaveLength(1);
      expect(data.profiles).toHaveLength(1);
    });

    it('should import data from JSON', async () => {
      // Create test data to export
      await service.createWorkoutSession(createMockWorkoutSession());
      const exported = await service.exportData();

      // Clear database
      await db.sessions.clear();

      // Import data
      await service.importData(exported);

      // Verify import
      const sessions = await service.getWorkoutSessions('user-1');
      expect(sessions).toHaveLength(1);
      expect(sessions[0].userId).toBe('user-1');
    });

    it('should throw error for incompatible version', async () => {
      const invalidData = JSON.stringify({ version: 999 });

      await expect(service.importData(invalidData)).rejects.toThrow(
        'Incompatible database version. Expected 1, got 999',
      );
    });

    it('should handle empty import data', async () => {
      const emptyData = JSON.stringify({
        version: 1,
        sessions: [],
        exercises: [],
        sets: [],
        analyses: [],
        profiles: [],
      });

      await service.importData(emptyData);

      // Should not throw and database should be empty
      const sessions = await service.getWorkoutSessions('any-user');
      expect(sessions).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    it('should throw error when updating non-existent session', async () => {
      await expect(service.updateWorkoutSession('non-existent', { duration: 100 })).rejects.toThrow(
        'Session not found',
      );
    });

    it('should throw error when updating non-existent set', async () => {
      await expect(service.updateSet('non-existent', { weight: 100 })).rejects.toThrow('Set not found');
    });

    it('should handle malformed import data', async () => {
      await expect(service.importData('invalid json')).rejects.toThrow('Unexpected token');
    });
  });
});
