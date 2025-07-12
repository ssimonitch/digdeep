import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ErrorMonitor } from './error-monitor.service';

// Mock global error handlers
const mockAddEventListener = vi.fn();
const mockRemoveEventListener = vi.fn();

vi.stubGlobal('addEventListener', mockAddEventListener);
vi.stubGlobal('removeEventListener', mockRemoveEventListener);

// Mock MediaError (not available in test environment)
interface MockMediaError {
  MEDIA_ERR_ABORTED: number;
  MEDIA_ERR_NETWORK: number;
  MEDIA_ERR_DECODE: number;
  MEDIA_ERR_SRC_NOT_SUPPORTED: number;
}

const mockMediaError: MockMediaError = {
  MEDIA_ERR_ABORTED: 1,
  MEDIA_ERR_NETWORK: 2,
  MEDIA_ERR_DECODE: 3,
  MEDIA_ERR_SRC_NOT_SUPPORTED: 4,
};

vi.stubGlobal('MediaError', mockMediaError);

// Mock PromiseRejectionEvent (not available in test environment)
class MockPromiseRejectionEvent extends Event {
  public readonly promise: Promise<unknown>;
  public readonly reason: unknown;

  constructor(type: string, options: { promise: Promise<unknown>; reason: unknown }) {
    super(type);
    this.promise = options.promise;
    this.reason = options.reason;
  }
}

vi.stubGlobal('PromiseRejectionEvent', MockPromiseRejectionEvent);

describe('ErrorMonitor', () => {
  let monitor: ErrorMonitor;

  beforeEach(() => {
    monitor = new ErrorMonitor();
    vi.clearAllMocks();
  });

  afterEach(() => {
    monitor.destroy();
  });

  describe('initialization', () => {
    it('should initialize with empty error list', () => {
      const summary = monitor.getErrorSummary();
      expect(summary.totalErrors).toBe(0);
      expect(summary.errorsByType).toEqual({});
      expect(summary.errorsBySeverity).toEqual({});
    });

    it('should set up global error handlers on initialize', () => {
      monitor.initialize();

      expect(mockAddEventListener).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockAddEventListener).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));
    });

    it('should remove global error handlers on destroy', () => {
      monitor.initialize();
      monitor.destroy();

      expect(mockRemoveEventListener).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockRemoveEventListener).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));
    });

    it('should not initialize multiple times', () => {
      monitor.initialize();
      monitor.initialize();

      // Should only be called once for each event type
      expect(mockAddEventListener).toHaveBeenCalledTimes(2);
    });
  });

  describe('error reporting', () => {
    it('should report custom errors', () => {
      const errorId = monitor.reportError('Test error', 'custom', 'medium');

      expect(errorId).toBeTruthy();

      const summary = monitor.getErrorSummary();
      expect(summary.totalErrors).toBe(1);
      expect(summary.errorsByType.custom).toBe(1);
      expect(summary.errorsBySeverity.medium).toBe(1);

      const errors = monitor.getErrors();
      expect(errors[0].message).toBe('Test error');
      expect(errors[0].type).toBe('custom');
      expect(errors[0].severity).toBe('medium');
    });

    it('should report JavaScript errors', () => {
      const testError = new Error('JavaScript error');
      testError.stack = 'Error: JavaScript error\n    at test';

      const errorId = monitor.reportJavaScriptError(testError, 'high', { component: 'TestComponent' });

      expect(errorId).toBeTruthy();

      const errors = monitor.getErrors();
      expect(errors[0].type).toBe('javascript');
      expect(errors[0].message).toBe('JavaScript error');
      expect(errors[0].stack).toBe(testError.stack);
      expect(errors[0].severity).toBe('high');
      expect(errors[0].context?.component).toBe('TestComponent');
    });

    it('should report network errors', () => {
      const errorId = monitor.reportNetworkError('/api/test', 500, 'Internal Server Error', { requestId: '123' });

      expect(errorId).toBeTruthy();

      const errors = monitor.getErrors();
      expect(errors[0].type).toBe('network');
      expect(errors[0].message).toBe('Network error: 500 Internal Server Error');
      expect(errors[0].url).toBe('/api/test');
      expect(errors[0].severity).toBe('high'); // 500 errors are high severity
      expect(errors[0].context?.status).toBe(500);
    });

    it('should assign correct severity for network errors', () => {
      monitor.reportNetworkError('/api/test', 404, 'Not Found');
      monitor.reportNetworkError('/api/test', 500, 'Server Error');

      const errors = monitor.getErrors();
      expect(errors[0].severity).toBe('medium'); // 404 is medium
      expect(errors[1].severity).toBe('high'); // 500 is high
    });

    it('should report media errors', () => {
      const mockMediaElement = {
        error: {
          code: MediaError.MEDIA_ERR_NETWORK,
        },
        src: 'video.mp4',
        tagName: 'VIDEO',
      } as HTMLMediaElement;

      const errorId = monitor.reportMediaError(mockMediaElement, { videoId: 'test123' });

      expect(errorId).toBeTruthy();

      const errors = monitor.getErrors();
      expect(errors[0].type).toBe('media');
      expect(errors[0].message).toBe('Network error while loading media');
      expect(errors[0].severity).toBe('high');
      expect(errors[0].context?.mediaErrorCode).toBe(MediaError.MEDIA_ERR_NETWORK);
      expect(errors[0].context?.mediaSrc).toBe('video.mp4');
    });

    it('should handle media elements without errors', () => {
      const mockMediaElement = {
        error: null,
        src: 'video.mp4',
        tagName: 'VIDEO',
      } as HTMLMediaElement;

      monitor.reportMediaError(mockMediaElement);

      const errors = monitor.getErrors();
      expect(errors[0].message).toBe('Unknown media error');
      expect(errors[0].severity).toBe('medium');
    });
  });

  describe('error history management', () => {
    it('should limit error history size', () => {
      // Report more errors than the max history size (100)
      for (let i = 0; i < 150; i++) {
        monitor.reportError(`Error ${i}`);
      }

      const errors = monitor.getErrors();
      expect(errors.length).toBe(100);

      // Should keep the most recent errors
      expect(errors[errors.length - 1].message).toBe('Error 149');
    });

    it('should clear all errors', () => {
      monitor.reportError('Error 1');
      monitor.reportError('Error 2');

      expect(monitor.getErrorSummary().totalErrors).toBe(2);

      monitor.clearErrors();

      expect(monitor.getErrorSummary().totalErrors).toBe(0);
      expect(monitor.getErrors()).toEqual([]);
    });
  });

  describe('error summary', () => {
    beforeEach(() => {
      // Mock Date.now() to ensure predictable timestamps
      let mockTime = 1000;
      vi.spyOn(Date, 'now').mockImplementation(() => {
        mockTime += 100; // Increment by 100ms for each call
        return mockTime;
      });

      // Set up some test errors
      monitor.reportError('Custom error 1', 'custom', 'low');
      monitor.reportError('Custom error 2', 'custom', 'high');
      monitor.reportJavaScriptError(new Error('JS error'), 'critical');
      monitor.reportNetworkError('/api/test', 500, 'Server Error');
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should generate correct error summary', () => {
      const summary = monitor.getErrorSummary();

      expect(summary.totalErrors).toBe(4);
      expect(summary.errorsByType.custom).toBe(2);
      expect(summary.errorsByType.javascript).toBe(1);
      expect(summary.errorsByType.network).toBe(1);
      expect(summary.errorsBySeverity.low).toBe(1);
      expect(summary.errorsBySeverity.high).toBe(2);
      expect(summary.errorsBySeverity.critical).toBe(1);
    });

    it('should provide recent errors', () => {
      const summary = monitor.getErrorSummary();

      expect(summary.recentErrors.length).toBe(4);
      // Should be sorted by timestamp (most recent first)
      expect(summary.recentErrors[0].timestamp).toBeGreaterThanOrEqual(summary.recentErrors[1].timestamp);
    });

    it('should filter critical errors', () => {
      const summary = monitor.getErrorSummary();

      expect(summary.criticalErrors.length).toBe(1);
      expect(summary.criticalErrors[0].severity).toBe('critical');
      expect(summary.criticalErrors[0].type).toBe('javascript');
    });

    it('should limit recent errors to 10', () => {
      // Add more errors
      for (let i = 0; i < 20; i++) {
        monitor.reportError(`Additional error ${i}`);
      }

      const summary = monitor.getErrorSummary();
      expect(summary.recentErrors.length).toBe(10);
    });
  });

  describe('observers', () => {
    it('should notify error observers', () => {
      const observer = vi.fn();
      const unsubscribe = monitor.subscribe(observer);

      monitor.reportError('Test error');

      expect(observer).toHaveBeenCalled();
      const calledWith = observer.mock.calls[0][0] as { message: string };
      expect(calledWith.message).toBe('Test error');

      unsubscribe();
    });

    it('should notify summary observers', () => {
      const observer = vi.fn();
      const unsubscribe = monitor.subscribeSummary(observer);

      monitor.reportError('Test error');

      expect(observer).toHaveBeenCalled();
      const calledWith = observer.mock.calls[0][0] as { totalErrors: number };
      expect(calledWith.totalErrors).toBe(1);

      unsubscribe();
    });

    it('should handle observer errors gracefully', () => {
      // Suppress console.error output during the test
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {
        // Do nothing
      });

      const faultyObserver = vi.fn(() => {
        throw new Error('Observer error');
      });

      monitor.subscribe(faultyObserver);

      // Should not throw
      expect(() => monitor.reportError('Test error')).not.toThrow();

      consoleErrorSpy.mockRestore();
    });

    it('should allow unsubscribing observers', () => {
      const observer = vi.fn();
      const unsubscribe = monitor.subscribe(observer);

      unsubscribe();
      monitor.reportError('Test error');

      expect(observer).not.toHaveBeenCalled();
    });
  });

  describe('global error handling', () => {
    beforeEach(() => {
      monitor.initialize();
    });

    it('should handle global JavaScript errors', () => {
      const errorEvent = new ErrorEvent('error', {
        message: 'Global error',
        filename: 'test.js',
        lineno: 10,
        colno: 5,
        error: new Error('Global error'),
      });

      // Get the error handler from the mock calls
      const errorHandler = mockAddEventListener.mock.calls.find((call) => call[0] === 'error')?.[1] as
        | ((event: ErrorEvent) => void)
        | undefined;

      errorHandler?.(errorEvent);

      const errors = monitor.getErrors();
      expect(errors.length).toBe(1);
      expect(errors[0].type).toBe('javascript');
      expect(errors[0].message).toBe('Global error');
      expect(errors[0].url).toBe('test.js');
      expect(errors[0].lineNumber).toBe(10);
      expect(errors[0].columnNumber).toBe(5);
    });

    it('should handle unhandled promise rejections', () => {
      const rejectedPromise = Promise.reject(new Error('Promise error'));
      // Prevent unhandled rejection in the test environment
      rejectedPromise.catch(() => {
        // Do nothing
      });

      const rejectionEvent = new MockPromiseRejectionEvent('unhandledrejection', {
        promise: rejectedPromise,
        reason: 'Promise error',
      });

      // Get the rejection handler from the mock calls
      const rejectionHandler = mockAddEventListener.mock.calls.find((call) => call[0] === 'unhandledrejection')?.[1] as
        | ((event: MockPromiseRejectionEvent) => void)
        | undefined;

      rejectionHandler?.(rejectionEvent);

      const errors = monitor.getErrors();
      expect(errors.length).toBe(1);
      expect(errors[0].type).toBe('promise');
      expect(errors[0].message).toBe('Unhandled promise rejection: Promise error');
      expect(errors[0].severity).toBe('high');
    });
  });
});
