import { vi } from 'vitest';

export const errorMonitor = {
  reportError: vi.fn(),
  reportJavaScriptError: vi.fn(),
  reportNetworkError: vi.fn(),
  reportMediaError: vi.fn(),
  subscribe: vi.fn(),
  subscribeSummary: vi.fn(),
  getErrorSummary: vi.fn(),
  clearErrors: vi.fn(),
  getErrors: vi.fn(),
  initialize: vi.fn(),
  destroy: vi.fn(),
};