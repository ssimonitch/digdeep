import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { DexieStorageService, DigDeepDatabase } from '@/infrastructure/storage/dexie/dexie-storage.service';

import { createTestDatabaseFactory } from '../test-database-factory';
import {
  createMockAnalysis,
  createMockExercise,
  createMockSet,
  createMockUserProfile,
  createMockWorkoutSession,
} from '../test-utils';

describe('Workout Flow Integration Tests', () => {
  let service: DexieStorageService;
  let db: DigDeepDatabase;
  const testDbFactory = createTestDatabaseFactory('integration');

  beforeEach(async () => {
    // Create fresh instances for each test with unique database name
    db = testDbFactory.createDatabase();
    service = new DexieStorageService(db);

    // Ensure database is ready
    await db.open();
  });

  afterEach(async () => {
    await testDbFactory.cleanup(db);
  });

  describe('Complete Workout Flow', () => {
    it('should handle full workout creation and analysis workflow', async () => {
      const userId = 'test-user';

      // 1. Create user profile
      const profile = await service.saveUserProfile(
        createMockUserProfile({
          id: userId,
          stats: {
            totalWorkouts: 0,
            totalSets: 0,
            currentStreak: 0,
            bestStreak: 0,
          },
        }),
      );

      expect(profile.id).toBe(userId);

      // 2. Start a new workout session
      const sessionData = createMockWorkoutSession({ userId });

      const session = await service.createWorkoutSession(sessionData);
      expect(session.userId).toBe(userId);

      // 3. Add first exercise (Back Squat)
      const squatExercise = await service.createExercise(
        createMockExercise({
          sessionId: session.id,
          name: 'Back Squat',
          order: 1,
          notes: 'Working on depth today',
        }),
      );

      // 4. Add sets to the exercise
      const sets = [];
      for (let i = 1; i <= 3; i++) {
        const set = await service.createSet(
          createMockSet({
            exerciseId: squatExercise.id,
            weight: 225 + i * 10,
            reps: 5,
            rpe: 7 + i,
          }),
        );
        sets.push(set);
      }

      expect(sets).toHaveLength(3);
      expect(sets[0].weight).toBe(235);
      expect(sets[2].weight).toBe(255);

      // 5. Add analysis for each set
      const analyses = [];
      for (const set of sets) {
        const analysis = await service.createAnalysis(
          createMockAnalysis({
            setId: set.id,
            depth: {
              achieved: true,
              lowestPoint: 88 + Math.random() * 4, // Varying depth
              timestamp: 1500 + Math.random() * 500,
            },
            balance: {
              score: 80 + Math.random() * 15,
              maxDeviation: 1 + Math.random() * 2,
              timeline: [],
            },
            overallScore: 75 + Math.random() * 20,
          }),
        );
        analyses.push(analysis);
      }

      expect(analyses).toHaveLength(3);

      // 6. Add second exercise (Front Squat)
      const frontSquatExercise = await service.createExercise(
        createMockExercise({
          sessionId: session.id,
          name: 'Front Squat',
          order: 2,
          notes: 'Accessory work',
        }),
      );

      await service.createSet(
        createMockSet({
          exerciseId: frontSquatExercise.id,
          weight: 185,
          reps: 8,
          rpe: 6,
        }),
      );

      // 7. Complete the session
      await service.updateWorkoutSession(session.id, {
        duration: 4500, // 75 minutes
        notes: 'Great session, depth was consistent',
      });

      // 8. Update user stats
      const updatedProfile = await service.saveUserProfile({
        ...profile,
        stats: {
          ...profile.stats,
          totalWorkouts: profile.stats.totalWorkouts + 1,
          totalSets: profile.stats.totalSets + 4,
          currentStreak: profile.stats.currentStreak + 1,
          lastWorkoutDate: new Date(),
        },
      });

      // Verify the complete workout structure
      const retrievedSession = await service.getWorkoutSession(session.id);
      expect(retrievedSession?.duration).toBe(4500);

      const exercises = await service.getExercisesBySession(session.id);
      expect(exercises).toHaveLength(2);
      expect(exercises[0].name).toBe('Back Squat'); // Ordered by order field
      expect(exercises[1].name).toBe('Front Squat');

      const backSquatSets = await service.getSetsByExercise(squatExercise.id);
      expect(backSquatSets).toHaveLength(3);

      const frontSquatSets = await service.getSetsByExercise(frontSquatExercise.id);
      expect(frontSquatSets).toHaveLength(1);

      // Verify analysis linkage
      for (const set of backSquatSets) {
        const analysis = await service.getAnalysisBySetId(set.id);
        expect(analysis).toBeDefined();
        expect(analysis!.setId).toBe(set.id);
      }

      // Verify updated user stats
      expect(updatedProfile.stats.totalWorkouts).toBe(1);
      expect(updatedProfile.stats.totalSets).toBe(4);
      expect(updatedProfile.stats.currentStreak).toBe(1);
    });

    it('should handle workout deletion with proper cascade', async () => {
      // Create a complete workout
      const session = await service.createWorkoutSession(createMockWorkoutSession());
      const exercise = await service.createExercise(
        createMockExercise({
          sessionId: session.id,
        }),
      );
      const set = await service.createSet(
        createMockSet({
          exerciseId: exercise.id,
        }),
      );
      await service.createAnalysis(
        createMockAnalysis({
          setId: set.id,
        }),
      );

      // Verify everything exists
      expect(await service.getWorkoutSession(session.id)).toBeDefined();
      expect(await service.getExercisesBySession(session.id)).toHaveLength(1);
      expect(await service.getSetsByExercise(exercise.id)).toHaveLength(1);
      expect(await service.getAnalysisBySetId(set.id)).toBeDefined();

      // Delete the session
      await service.deleteWorkoutSession(session.id);

      // Verify cascade deletion
      expect(await service.getWorkoutSession(session.id)).toBeNull();
      expect(await service.getExercisesBySession(session.id)).toHaveLength(0);
      expect(await service.getSetsByExercise(exercise.id)).toHaveLength(0);
      expect(await service.getAnalysisBySetId(set.id)).toBeNull();
    });
  });

  describe('Data Consistency and Integrity', () => {
    it('should maintain referential integrity', async () => {
      const session = await service.createWorkoutSession(createMockWorkoutSession());
      const exercise = await service.createExercise(
        createMockExercise({
          sessionId: session.id,
        }),
      );
      await service.createSet(
        createMockSet({
          exerciseId: exercise.id,
        }),
      );

      // Try to create analysis for non-existent set
      const analysis = await service.createAnalysis(
        createMockAnalysis({
          setId: 'non-existent-set',
        }),
      );

      // Analysis should be created (Dexie doesn't enforce foreign keys)
      // but we can verify the relationship manually
      expect(analysis.setId).toBe('non-existent-set');

      // The actual set shouldn't exist
      const linkedSet = await service.getSetsByExercise(exercise.id);
      expect(linkedSet.find((s) => s.id === 'non-existent-set')).toBeUndefined();
    });

    it('should handle concurrent operations', async () => {
      const userId = 'user-1';

      // Create multiple sessions concurrently
      const sessionPromises = Array.from({ length: 5 }, (_, i) =>
        service.createWorkoutSession(
          createMockWorkoutSession({
            userId,
            date: new Date(`2025-01-${String(i + 1).padStart(2, '0')}`),
            duration: 3600 + i * 300,
          }),
        ),
      );

      const sessions = await Promise.all(sessionPromises);
      expect(sessions).toHaveLength(5);

      // Verify all sessions have unique IDs
      const ids = sessions.map((s) => s.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(5);

      // Verify they're all saved
      const retrievedSessions = await service.getWorkoutSessions(userId);
      expect(retrievedSessions).toHaveLength(5);
    });
  });

  describe('Performance with Large Datasets', () => {
    it('should handle large number of sets efficiently', async () => {
      const session = await service.createWorkoutSession(createMockWorkoutSession());
      const exercise = await service.createExercise(
        createMockExercise({
          sessionId: session.id,
        }),
      );

      const startTime = performance.now();

      // Create 100 sets
      const setPromises = Array.from({ length: 100 }, (_, i) =>
        service.createSet(
          createMockSet({
            exerciseId: exercise.id,
            weight: 135 + i,
            reps: 5,
          }),
        ),
      );

      const sets = await Promise.all(setPromises);
      const endTime = performance.now();

      expect(sets).toHaveLength(100);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete in under 5 seconds

      // Verify retrieval is fast
      const retrievalStart = performance.now();
      const retrievedSets = await service.getSetsByExercise(exercise.id);
      const retrievalEnd = performance.now();

      expect(retrievedSets).toHaveLength(100);
      expect(retrievalEnd - retrievalStart).toBeLessThan(100); // Should be very fast
    });

    it('should handle complex queries efficiently', async () => {
      const userId = 'user-1';

      // Create multiple sessions with exercises and sets
      for (let sessionIndex = 0; sessionIndex < 10; sessionIndex++) {
        const session = await service.createWorkoutSession(
          createMockWorkoutSession({
            userId,
            date: new Date(`2025-01-${String(sessionIndex + 1).padStart(2, '0')}`),
          }),
        );

        for (let exerciseIndex = 0; exerciseIndex < 3; exerciseIndex++) {
          const exercise = await service.createExercise(
            createMockExercise({
              sessionId: session.id,
              name: `Exercise ${exerciseIndex + 1}`,
              order: exerciseIndex + 1,
            }),
          );

          for (let setIndex = 0; setIndex < 5; setIndex++) {
            await service.createSet(
              createMockSet({
                exerciseId: exercise.id,
                weight: 135 + setIndex * 10,
                reps: 5,
              }),
            );
          }
        }
      }

      const queryStart = performance.now();

      // Query all sessions for user
      const sessions = await service.getWorkoutSessions(userId);
      expect(sessions).toHaveLength(10);

      // Query exercises for first session
      const exercises = await service.getExercisesBySession(sessions[0].id);
      expect(exercises).toHaveLength(3);

      // Query sets for first exercise
      const sets = await service.getSetsByExercise(exercises[0].id);
      expect(sets).toHaveLength(5);

      const queryEnd = performance.now();
      expect(queryEnd - queryStart).toBeLessThan(500); // Complex queries should be fast
    });
  });

  describe('Export/Import Workflow', () => {
    it('should export and import complete workout data', async () => {
      const userId = 'test-user';

      // Create comprehensive test data
      await service.saveUserProfile(createMockUserProfile({ id: userId }));
      const session = await service.createWorkoutSession(createMockWorkoutSession({ userId }));
      const exercise = await service.createExercise(createMockExercise({ sessionId: session.id }));
      const set = await service.createSet(createMockSet({ exerciseId: exercise.id }));
      await service.createAnalysis(createMockAnalysis({ setId: set.id }));

      // Export data
      const exportedData = await service.exportData();
      const exportedJson = JSON.parse(exportedData) as {
        version: number;
        exportDate: string;
        sessions: unknown[];
        exercises: unknown[];
        sets: unknown[];
        analyses: unknown[];
        profiles: unknown[];
      };

      expect(exportedJson.sessions).toHaveLength(1);
      expect(exportedJson.exercises).toHaveLength(1);
      expect(exportedJson.sets).toHaveLength(1);
      expect(exportedJson.analyses).toHaveLength(1);
      expect(exportedJson.profiles).toHaveLength(1);

      // Clear all data
      await service.importData(
        JSON.stringify({
          version: 1,
          sessions: [],
          exercises: [],
          sets: [],
          analyses: [],
          profiles: [],
        }),
      );

      // Verify data is cleared
      expect(await service.getWorkoutSessions(userId)).toHaveLength(0);
      expect(await service.getUserProfile(userId)).toBeNull();

      // Import original data
      await service.importData(exportedData);

      // Verify data is restored
      const restoredSessions = await service.getWorkoutSessions(userId);
      expect(restoredSessions).toHaveLength(1);
      expect(restoredSessions[0].userId).toBe(userId);

      const restoredProfile = await service.getUserProfile(userId);
      expect(restoredProfile?.id).toBe(userId);

      const restoredExercises = await service.getExercisesBySession(session.id);
      expect(restoredExercises).toHaveLength(1);

      const restoredSets = await service.getSetsByExercise(exercise.id);
      expect(restoredSets).toHaveLength(1);

      const restoredAnalysis = await service.getAnalysisBySetId(set.id);
      expect(restoredAnalysis?.setId).toBe(set.id);
    });
  });
});
