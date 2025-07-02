import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback } from 'react';

import { getDexieStorage } from '@/services/dexie-storage.service';
import type { Exercise, Set, SquatAnalysis, UserProfile, WorkoutSession } from '@/types/workout.types';

const storage = getDexieStorage();

// Live query hooks for reactive data
export function useWorkoutSessions(userId: string, limit?: number) {
  return useLiveQuery(async () => {
    if (!userId) return [];
    return storage.getWorkoutSessions(userId, limit);
  }, [userId, limit]);
}

export function useWorkoutSession(id: string) {
  return useLiveQuery(async () => {
    if (!id) return null;
    return storage.getWorkoutSession(id);
  }, [id]);
}

export function useExercisesBySession(sessionId: string) {
  return useLiveQuery(async () => {
    if (!sessionId) return [];
    return storage.getExercisesBySession(sessionId);
  }, [sessionId]);
}

export function useSetsByExercise(exerciseId: string) {
  return useLiveQuery(async () => {
    if (!exerciseId) return [];
    return storage.getSetsByExercise(exerciseId);
  }, [exerciseId]);
}

export function useAnalysisBySetId(setId: string) {
  return useLiveQuery(async () => {
    if (!setId) return null;
    return storage.getAnalysisBySetId(setId);
  }, [setId]);
}

export function useUserProfile(userId: string) {
  return useLiveQuery(async () => {
    if (!userId) return null;
    return storage.getUserProfile(userId);
  }, [userId]);
}

// Storage statistics
export function useStorageInfo() {
  return useLiveQuery(() => storage.getStorageInfo());
}

// CRUD operation hooks (non-reactive, for actions)
export function useDexieActions() {
  const createSession = useCallback(
    async (session: Omit<WorkoutSession, 'id' | 'createdAt' | 'updatedAt'>): Promise<WorkoutSession> => {
      return storage.createWorkoutSession(session);
    },
    [],
  );

  const updateSession = useCallback(async (id: string, updates: Partial<WorkoutSession>): Promise<WorkoutSession> => {
    return storage.updateWorkoutSession(id, updates);
  }, []);

  const deleteSession = useCallback(async (id: string): Promise<void> => {
    return storage.deleteWorkoutSession(id);
  }, []);

  const createExercise = useCallback(async (exercise: Omit<Exercise, 'id'>): Promise<Exercise> => {
    return storage.createExercise(exercise);
  }, []);

  const deleteExercise = useCallback(async (id: string): Promise<void> => {
    return storage.deleteExercise(id);
  }, []);

  const createSet = useCallback(async (set: Omit<Set, 'id' | 'createdAt'>): Promise<Set> => {
    return storage.createSet(set);
  }, []);

  const updateSet = useCallback(async (id: string, updates: Partial<Set>): Promise<Set> => {
    return storage.updateSet(id, updates);
  }, []);

  const deleteSet = useCallback(async (id: string): Promise<void> => {
    return storage.deleteSet(id);
  }, []);

  const createAnalysis = useCallback(
    async (analysis: Omit<SquatAnalysis, 'id' | 'createdAt'>): Promise<SquatAnalysis> => {
      return storage.createAnalysis(analysis);
    },
    [],
  );

  const saveUserProfile = useCallback(async (profile: UserProfile): Promise<UserProfile> => {
    return storage.saveUserProfile(profile);
  }, []);

  const exportData = useCallback(async (): Promise<string> => {
    return storage.exportData();
  }, []);

  const importData = useCallback(async (jsonData: string): Promise<void> => {
    return storage.importData(jsonData);
  }, []);

  return {
    createSession,
    updateSession,
    deleteSession,
    createExercise,
    deleteExercise,
    createSet,
    updateSet,
    deleteSet,
    createAnalysis,
    saveUserProfile,
    exportData,
    importData,
  };
}

// Combined hook for both reactive data and actions
export function useDexieStorage(userId?: string) {
  const actions = useDexieActions();
  const sessions = useWorkoutSessions(userId ?? '', 10);
  const storageInfo = useStorageInfo();

  return {
    // Reactive data
    sessions,
    storageInfo,

    // Actions
    ...actions,

    // Individual hooks (for more specific usage)
    useWorkoutSession,
    useExercisesBySession,
    useSetsByExercise,
    useAnalysisBySetId,
    useUserProfile,
  };
}

// Direct database access for advanced queries
export { db } from '@/services/dexie-storage.service';
