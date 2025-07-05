import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { db } from '@/services/dexie-storage.service';
import {
  createMockAnalysis,
  createMockExercise,
  createMockSet,
  createMockUserProfile,
  createMockWorkoutSession,
} from '@/test/test-utils';
import type { WorkoutSession } from '@/types/workout.types';

import {
  useAnalysisBySetId,
  useDexieActions,
  useDexieStorage,
  useExercisesBySession,
  useSetsByExercise,
  useStorageInfo,
  useUserProfile,
  useWorkoutSession,
  useWorkoutSessions,
} from './useDexieStorage';

describe('useDexieStorage hooks', () => {
  beforeEach(async () => {
    // Ensure clean database for each test
    await db.open();
    await Promise.all([
      db.sessions.clear(),
      db.exercises.clear(),
      db.sets.clear(),
      db.analyses.clear(),
      db.profiles.clear(),
    ]);
  });

  afterEach(async () => {
    await db.delete();
  });

  describe('useWorkoutSessions', () => {
    it('should return empty array initially', () => {
      const { result } = renderHook(() => useWorkoutSessions('user-1'));

      expect(result.current).toEqual([]);
    });

    it('should reactively update when sessions are added', async () => {
      const { result } = renderHook(() => useWorkoutSessions('user-1'));

      expect(result.current).toEqual([]);

      // Add a session
      await act(async () => {
        await db.sessions.add(createMockWorkoutSession({ userId: 'user-1' }));
      });

      await waitFor(() => {
        expect(result.current).toHaveLength(1);
        expect(result.current[0].userId).toBe('user-1');
      });
    });

    it('should respect limit parameter', async () => {
      // Add multiple sessions
      await act(async () => {
        await db.sessions.bulkAdd([
          createMockWorkoutSession({
            id: 'session-1',
            userId: 'user-1',
            date: new Date('2025-01-01'),
          }),
          createMockWorkoutSession({
            id: 'session-2',
            userId: 'user-1',
            date: new Date('2025-01-02'),
          }),
          createMockWorkoutSession({
            id: 'session-3',
            userId: 'user-1',
            date: new Date('2025-01-03'),
          }),
        ]);
      });

      const { result } = renderHook(() => useWorkoutSessions('user-1', 2));

      await waitFor(() => {
        expect(result.current).toHaveLength(2);
        // Should be sorted by date descending (most recent first)
        expect(result.current[0].id).toBe('session-3');
        expect(result.current[1].id).toBe('session-2');
      });
    });

    it('should filter by userId', async () => {
      await act(async () => {
        await db.sessions.bulkAdd([
          createMockWorkoutSession({ id: 'session-1', userId: 'user-1' }),
          createMockWorkoutSession({ id: 'session-2', userId: 'user-2' }),
        ]);
      });

      const { result } = renderHook(() => useWorkoutSessions('user-1'));

      await waitFor(() => {
        expect(result.current).toHaveLength(1);
        expect(result.current[0].userId).toBe('user-1');
      });
    });
  });

  describe('useWorkoutSession', () => {
    it('should return null for non-existent session', () => {
      const { result } = renderHook(() => useWorkoutSession('non-existent'));

      expect(result.current).toBeNull();
    });

    it('should return session when it exists', async () => {
      const session = createMockWorkoutSession({ id: 'session-1' });

      await act(async () => {
        await db.sessions.add(session);
      });

      const { result } = renderHook(() => useWorkoutSession('session-1'));

      await waitFor(() => {
        expect(result.current).toEqual(session);
      });
    });

    it('should reactively update when session changes', async () => {
      const session = createMockWorkoutSession({ id: 'session-1', duration: 3600 });

      await act(async () => {
        await db.sessions.add(session);
      });

      const { result } = renderHook(() => useWorkoutSession('session-1'));

      await waitFor(() => {
        expect(result.current?.duration).toBe(3600);
      });

      // Update session
      await act(async () => {
        await db.sessions.update('session-1', { duration: 7200 });
      });

      await waitFor(() => {
        expect(result.current?.duration).toBe(7200);
      });
    });
  });

  describe('useExercisesBySession', () => {
    it('should return exercises ordered by order field', async () => {
      await act(async () => {
        await db.exercises.bulkAdd([
          createMockExercise({
            id: 'ex-1',
            sessionId: 'session-1',
            name: 'Exercise 2',
            order: 2,
          }),
          createMockExercise({
            id: 'ex-2',
            sessionId: 'session-1',
            name: 'Exercise 1',
            order: 1,
          }),
        ]);
      });

      const { result } = renderHook(() => useExercisesBySession('session-1'));

      await waitFor(() => {
        expect(result.current).toHaveLength(2);
        expect(result.current[0].name).toBe('Exercise 1');
        expect(result.current[1].name).toBe('Exercise 2');
      });
    });
  });

  describe('useSetsByExercise', () => {
    it('should return sets for specific exercise', async () => {
      await act(async () => {
        await db.sets.bulkAdd([
          createMockSet({ id: 'set-1', exerciseId: 'exercise-1', weight: 225 }),
          createMockSet({ id: 'set-2', exerciseId: 'exercise-1', weight: 235 }),
          createMockSet({ id: 'set-3', exerciseId: 'exercise-2', weight: 245 }),
        ]);
      });

      const { result } = renderHook(() => useSetsByExercise('exercise-1'));

      await waitFor(() => {
        expect(result.current).toHaveLength(2);
        expect(result.current.every((set) => set.exerciseId === 'exercise-1')).toBe(true);
      });
    });
  });

  describe('useAnalysisBySetId', () => {
    it('should return analysis for specific set', async () => {
      const analysis = createMockAnalysis({ id: 'analysis-1', setId: 'set-1' });

      await act(async () => {
        await db.analyses.add(analysis);
      });

      const { result } = renderHook(() => useAnalysisBySetId('set-1'));

      await waitFor(() => {
        expect(result.current).toEqual(analysis);
      });
    });
  });

  describe('useUserProfile', () => {
    it('should return user profile', async () => {
      const profile = createMockUserProfile({ id: 'user-1' });

      await act(async () => {
        await db.profiles.add(profile);
      });

      const { result } = renderHook(() => useUserProfile('user-1'));

      await waitFor(() => {
        expect(result.current).toEqual(profile);
      });
    });
  });

  describe('useStorageInfo', () => {
    it('should return storage information', async () => {
      const { result } = renderHook(() => useStorageInfo());

      await waitFor(() => {
        expect(result.current).toHaveProperty('usage');
        expect(result.current).toHaveProperty('quota');
        expect(result.current).toHaveProperty('percentage');
      });
    });
  });

  describe('useDexieActions', () => {
    it('should provide CRUD actions', () => {
      const { result } = renderHook(() => useDexieActions());

      expect(result.current).toHaveProperty('createSession');
      expect(result.current).toHaveProperty('updateSession');
      expect(result.current).toHaveProperty('deleteSession');
      expect(result.current).toHaveProperty('createExercise');
      expect(result.current).toHaveProperty('deleteExercise');
      expect(result.current).toHaveProperty('createSet');
      expect(result.current).toHaveProperty('updateSet');
      expect(result.current).toHaveProperty('deleteSet');
      expect(result.current).toHaveProperty('createAnalysis');
      expect(result.current).toHaveProperty('saveUserProfile');
      expect(result.current).toHaveProperty('exportData');
      expect(result.current).toHaveProperty('importData');
    });

    it('should create session through action', async () => {
      const { result } = renderHook(() => useDexieActions());

      const mockSession = createMockWorkoutSession();
      const sessionData: Omit<WorkoutSession, 'id' | 'createdAt' | 'updatedAt'> = {
        userId: mockSession.userId,
        date: mockSession.date,
        exercises: mockSession.exercises,
        duration: mockSession.duration,
        notes: mockSession.notes,
      };

      let createdSession: WorkoutSession | undefined;
      await act(async () => {
        createdSession = await result.current.createSession(sessionData);
      });

      expect(createdSession!.id).toBeDefined();
      expect(createdSession!.userId).toBe(sessionData.userId);

      // Verify it was actually saved
      const saved = await db.sessions.get(createdSession!.id);
      expect(saved).toEqual(createdSession);
    });

    it('should update session through action', async () => {
      // Create initial session
      const session = createMockWorkoutSession({ id: 'session-1' });
      await db.sessions.add(session);

      const { result } = renderHook(() => useDexieActions());

      let updatedSession: WorkoutSession;
      await act(async () => {
        updatedSession = await result.current.updateSession('session-1', {
          duration: 7200,
          notes: 'Updated notes',
        });
      });

      expect(updatedSession!.duration).toBe(7200);
      expect(updatedSession!.notes).toBe('Updated notes');
    });

    it('should export and import data', async () => {
      // Create test data
      await db.sessions.add(createMockWorkoutSession({ id: 'session-1' }));

      const { result } = renderHook(() => useDexieActions());

      let exportedData = '';
      await act(async () => {
        exportedData = await result.current.exportData();
      });

      expect(exportedData).toBeDefined();
      const data = JSON.parse(exportedData) as { sessions: unknown[] };
      expect(data.sessions).toHaveLength(1);

      // Clear and import
      await db.sessions.clear();

      await act(async () => {
        await result.current.importData(exportedData);
      });

      const sessions = await db.sessions.toArray();
      expect(sessions).toHaveLength(1);
      expect(sessions[0].id).toBe('session-1');
    });
  });

  describe('useDexieStorage (combined hook)', () => {
    it('should provide both reactive data and actions', () => {
      const { result } = renderHook(() => useDexieStorage('user-1'));

      // Should have reactive data
      expect(result.current.sessions).toBeDefined();
      expect(result.current.storageInfo).toBeDefined();

      // Should have actions
      expect(result.current.createSession).toBeDefined();
      expect(result.current.exportData).toBeDefined();

      // Should have individual hook functions
      expect(result.current.useWorkoutSession).toBeDefined();
      expect(result.current.useExercisesBySession).toBeDefined();
    });

    it('should handle empty userId', () => {
      const { result } = renderHook(() => useDexieStorage());

      expect(result.current.sessions).toEqual([]);
    });
  });

  describe('Hook Dependencies and Updates', () => {
    it('should update when dependencies change', async () => {
      const { result, rerender } = renderHook(({ userId }) => useWorkoutSessions(userId), {
        initialProps: { userId: 'user-1' },
      });

      // Add session for user-1
      await act(async () => {
        await db.sessions.add(createMockWorkoutSession({ userId: 'user-1' }));
      });

      await waitFor(() => {
        expect(result.current).toHaveLength(1);
      });

      // Change to user-2
      rerender({ userId: 'user-2' });

      await waitFor(() => {
        expect(result.current).toEqual([]);
      });

      // Add session for user-2
      await act(async () => {
        await db.sessions.add(
          createMockWorkoutSession({
            id: 'session-2',
            userId: 'user-2',
          }),
        );
      });

      await waitFor(() => {
        expect(result.current).toHaveLength(1);
        expect(result.current[0].userId).toBe('user-2');
      });
    });
  });

  describe('Error Handling in Hooks', () => {
    it('should handle errors gracefully in actions', async () => {
      const { result } = renderHook(() => useDexieActions());

      // Try to update non-existent session
      await expect(
        act(async () => {
          await result.current.updateSession('non-existent', { duration: 100 });
        }),
      ).rejects.toThrow('Session not found');
    });

    it('should handle invalid data in live queries', () => {
      const { result } = renderHook(() => useWorkoutSession(''));

      expect(result.current).toBeNull();
    });
  });
});
