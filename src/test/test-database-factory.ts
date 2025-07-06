import { Dexie } from 'dexie';

import { DigDeepDatabase } from '@/services/dexie-storage.service';

/**
 * Creates a test database with a unique name to prevent conflicts between tests
 */
export function createTestDatabase(testSuiteName: string): DigDeepDatabase {
  const uniqueName = `DigDeepDB-${testSuiteName}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

  // Create a new database class with the unique name
  class TestDatabase extends DigDeepDatabase {
    constructor() {
      super();
      this.version(1);
      this.name = uniqueName;
    }
  }

  return new TestDatabase();
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
