import { Dexie } from 'dexie';

import { DigDeepDatabase } from '@/services/dexie/dexie-storage.service';

/**
 * Creates a test database with a unique name to prevent conflicts between tests
 */
export function createTestDatabase(testSuiteName: string): DigDeepDatabase {
  const uniqueName = `DigDeepDB-${testSuiteName}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

  // Create a new database class with the unique name
  class TestDatabase extends Dexie {
    sessions!: DigDeepDatabase['sessions'];
    exercises!: DigDeepDatabase['exercises'];
    sets!: DigDeepDatabase['sets'];
    analyses!: DigDeepDatabase['analyses'];
    profiles!: DigDeepDatabase['profiles'];

    constructor(name: string) {
      super(name);

      this.version(1).stores({
        sessions: '++id, userId, date, createdAt, updatedAt',
        exercises: '++id, sessionId, name, order',
        sets: '++id, exerciseId, createdAt',
        analyses: '++id, setId, createdAt',
        profiles: '++id, createdAt, updatedAt',
      });
    }
  }

  return new TestDatabase(uniqueName) as DigDeepDatabase;
}

/**
 * Properly closes and deletes a test database
 */
export async function cleanupTestDatabase(db: Dexie): Promise<void> {
  if (db.isOpen()) {
    db.close();
  }
  await db.delete();
}

/**
 * Creates a test database factory for a specific test suite
 */
export function createTestDatabaseFactory(testSuiteName: string) {
  return {
    createDatabase: () => createTestDatabase(testSuiteName),
    cleanup: cleanupTestDatabase,
  };
}
