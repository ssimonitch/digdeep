/**
 * DOM query helpers for testing
 * Utilities for finding and asserting on DOM elements in tests
 */

/**
 * Find a landmark element (circle) by its position coordinates
 * Useful for testing coordinate transformations in pose overlays
 *
 * @param container - The container element to search within
 * @param x - Expected x coordinate
 * @param y - Expected y coordinate
 * @param tolerance - Tolerance for coordinate matching (default: 5)
 * @returns The matching circle element or null
 */
export function findLandmarkByPosition(container: HTMLElement, x: number, y: number, tolerance = 5): Element | null {
  const circles = container.querySelectorAll('circle');

  for (const circle of circles) {
    const cx = parseFloat(circle.getAttribute('cx') ?? '0');
    const cy = parseFloat(circle.getAttribute('cy') ?? '0');

    if (Math.abs(cx - x) <= tolerance && Math.abs(cy - y) <= tolerance) {
      return circle;
    }
  }

  return null;
}

/**
 * Find all landmarks within a region
 * Useful for testing landmark clustering or region-based analysis
 *
 * @param container - The container element to search within
 * @param region - The region bounds
 * @returns Array of matching circle elements
 */
export function findLandmarksInRegion(
  container: HTMLElement,
  region: { x: number; y: number; width: number; height: number },
): Element[] {
  const circles = container.querySelectorAll('circle');
  const matches: Element[] = [];

  for (const circle of circles) {
    const cx = parseFloat(circle.getAttribute('cx') ?? '0');
    const cy = parseFloat(circle.getAttribute('cy') ?? '0');

    if (cx >= region.x && cx <= region.x + region.width && cy >= region.y && cy <= region.y + region.height) {
      matches.push(circle);
    }
  }

  return matches;
}

/**
 * Count visible landmarks in a container
 * Useful for testing landmark visibility/filtering
 *
 * @param container - The container element to search within
 * @param minOpacity - Minimum opacity to consider visible (default: 0.1)
 * @returns Count of visible landmarks
 */
export function countVisibleLandmarks(container: HTMLElement, minOpacity = 0.1): number {
  const circles = container.querySelectorAll('circle');
  let count = 0;

  for (const circle of circles) {
    const opacity = parseFloat(circle.getAttribute('opacity') ?? '1');
    if (opacity >= minOpacity) {
      count++;
    }
  }

  return count;
}
