import '@testing-library/jest-dom';
import 'fake-indexeddb/auto';

// Reset IndexedDB before each test
beforeEach(() => {
  // Clear all databases - fake-indexeddb specific property
  const fakeIndexedDB = indexedDB as { _databases?: Map<string, unknown> };
  if (fakeIndexedDB._databases) {
    const databases = Array.from(fakeIndexedDB._databases.keys());
    databases.forEach((name) => {
      indexedDB.deleteDatabase(name);
    });
  }
});
