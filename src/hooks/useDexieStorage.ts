import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback } from 'react';

import { getDexieStorage } from '@/infrastructure/storage/dexie/dexie-storage.service';
import type { Exercise, Set, SquatAnalysis, UserProfile, WorkoutSession } from '@/types/workout.types';

// Live query hooks for reactive data
export function useWorkoutSessions(userId: string, limit?: number) {
  return (
    useLiveQuery(async () => {
      if (!userId) return [];
      return getDexieStorage().getWorkoutSessions(userId, limit);
    }, [userId, limit]) ?? []
  );
}

export function useWorkoutSession(id: string) {
  return (
    useLiveQuery(async () => {
      if (!id) return null;
      return getDexieStorage().getWorkoutSession(id);
    }, [id]) ?? null
  );
}

export function useExercisesBySession(sessionId: string) {
  return (
    useLiveQuery(async () => {
      if (!sessionId) return [];
      return getDexieStorage().getExercisesBySession(sessionId);
    }, [sessionId]) ?? []
  );
}

export function useSetsByExercise(exerciseId: string) {
  return (
    useLiveQuery(async () => {
      if (!exerciseId) return [];
      return getDexieStorage().getSetsByExercise(exerciseId);
    }, [exerciseId]) ?? []
  );
}

export function useAnalysisBySetId(setId: string) {
  return (
    useLiveQuery(async () => {
      if (!setId) return null;
      return getDexieStorage().getAnalysisBySetId(setId);
    }, [setId]) ?? null
  );
}

export function useUserProfile(userId: string) {
  return (
    useLiveQuery(async () => {
      if (!userId) return null;
      return getDexieStorage().getUserProfile(userId);
    }, [userId]) ?? null
  );
}

// Storage statistics
export function useStorageInfo() {
  return (
    useLiveQuery(() => getDexieStorage().getStorageInfo()) ?? {
      usage: 0,
      quota: 0,
      percentage: 0,
    }
  );
}

// CRUD operation hooks (non-reactive, for actions)
export function useDexieActions() {
  const createSession = useCallback(
    async (session: Omit<WorkoutSession, 'id' | 'createdAt' | 'updatedAt'>): Promise<WorkoutSession> => {
      return getDexieStorage().createWorkoutSession(session);
    },
    [],
  );

  const updateSession = useCallback(async (id: string, updates: Partial<WorkoutSession>): Promise<WorkoutSession> => {
    return getDexieStorage().updateWorkoutSession(id, updates);
  }, []);

  const deleteSession = useCallback(async (id: string): Promise<void> => {
    return getDexieStorage().deleteWorkoutSession(id);
  }, []);

  const createExercise = useCallback(async (exercise: Omit<Exercise, 'id'>): Promise<Exercise> => {
    return getDexieStorage().createExercise(exercise);
  }, []);

  const deleteExercise = useCallback(async (id: string): Promise<void> => {
    return getDexieStorage().deleteExercise(id);
  }, []);

  const createSet = useCallback(async (set: Omit<Set, 'id' | 'createdAt'>): Promise<Set> => {
    return getDexieStorage().createSet(set);
  }, []);

  const updateSet = useCallback(async (id: string, updates: Partial<Set>): Promise<Set> => {
    return getDexieStorage().updateSet(id, updates);
  }, []);

  const deleteSet = useCallback(async (id: string): Promise<void> => {
    return getDexieStorage().deleteSet(id);
  }, []);

  const createAnalysis = useCallback(
    async (analysis: Omit<SquatAnalysis, 'id' | 'createdAt'>): Promise<SquatAnalysis> => {
      return getDexieStorage().createAnalysis(analysis);
    },
    [],
  );

  const saveUserProfile = useCallback(async (profile: UserProfile): Promise<UserProfile> => {
    return getDexieStorage().saveUserProfile(profile);
  }, []);

  const exportData = useCallback(async (): Promise<string> => {
    return getDexieStorage().exportData();
  }, []);

  const importData = useCallback(async (jsonData: string): Promise<void> => {
    return getDexieStorage().importData(jsonData);
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
export { db } from '@/infrastructure/storage/dexie/dexie-storage.service';
