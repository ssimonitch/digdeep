import { vi } from 'vitest';

/**
 * Mock ResizeObserver that triggers callback immediately
 * Used for testing components that rely on ResizeObserver
 */
export const mockResizeObserver = vi.fn().mockImplementation((callback: ResizeObserverCallback) => ({
  observe: vi.fn((element: HTMLElement) => {
    // Trigger callback immediately with element's dimensions
    callback(
      [
        {
          target: element,
          contentRect: {
            width: element.offsetWidth,
            height: element.offsetHeight,
            bottom: 0,
            left: 0,
            right: 0,
            top: 0,
            x: 0,
            y: 0,
            toJSON: () => {
              throw new Error('Function not implemented.');
            },
          },
          borderBoxSize: [],
          contentBoxSize: [],
          devicePixelContentBoxSize: [],
        },
      ],
      {} as ResizeObserver,
    );
  }),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

/**
 * Setup ResizeObserver mock for tests
 * Call this in beforeEach to ensure clean mock state
 */
export function setupResizeObserverMock(): void {
  global.ResizeObserver = mockResizeObserver as unknown as typeof ResizeObserver;
}

/**
 * Helper to trigger ResizeObserver callback for a specific element
 * Useful for testing resize behavior
 */
export function triggerResizeObserver(element: HTMLElement, dimensions: { width: number; height: number }): void {
  const resizeObserverInstance = global.ResizeObserver as unknown as {
    mock: { calls: [ResizeObserverCallback][] };
  };
  const resizeObserverCalls = resizeObserverInstance.mock.calls;

  if (resizeObserverCalls.length > 0) {
    const observeCallback = resizeObserverCalls[0][0];
    observeCallback(
      [
        {
          target: element,
          contentRect: {
            width: dimensions.width,
            height: dimensions.height,
            top: 0,
            left: 0,
            right: dimensions.width,
            bottom: dimensions.height,
            x: 0,
            y: 0,
            toJSON: () => ({}),
          },
          borderBoxSize: [],
          contentBoxSize: [],
          devicePixelContentBoxSize: [],
        },
      ],
      {} as ResizeObserver,
    );
  }
}
