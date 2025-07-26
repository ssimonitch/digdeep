/**
 * Bar path tracking data point
 */
export interface BarPathPoint {
  position: { x: number; y: number; z: number };
  timestamp: number;
  deviation: number;
}

/**
 * MetricsTracker - Manages history tracking for squat metrics
 *
 * Encapsulates the logic for:
 * - Lateral shift history tracking with circular buffer
 * - Bar path history tracking with bounded array
 * - Maximum value tracking
 * - History reset functionality
 */
export class MetricsTracker {
  private readonly maxHistorySize: number;

  // Lateral shift tracking
  private lateralShiftHistory: number[] = [];
  private maxLateralShift = 0;
  private maxShiftDepth: number | null = null;

  // Bar path tracking
  private barPathHistory: BarPathPoint[] = [];
  private maxBarPathDeviation = 0;
  private startingBarPosition: { x: number; y: number; z: number } | null = null;

  constructor(maxHistorySize = 30) {
    this.maxHistorySize = maxHistorySize;
  }

  /**
   * Update lateral shift tracking
   */
  public updateLateralShift(lateralDeviation: number, currentDepth: number | null): void {
    // Add to history (circular buffer)
    this.lateralShiftHistory.push(lateralDeviation);
    if (this.lateralShiftHistory.length > this.maxHistorySize) {
      this.lateralShiftHistory.shift();
    }

    // Update max shift if current is greater
    if (lateralDeviation > this.maxLateralShift) {
      this.maxLateralShift = lateralDeviation;
      this.maxShiftDepth = currentDepth;
    }
  }

  /**
   * Update bar path tracking
   */
  public updateBarPath(shoulderMidpoint: { x: number; y: number; z: number }, timestamp: number) {
    // Set starting position if not already set
    this.startingBarPosition ??= { ...shoulderMidpoint };

    // Calculate vertical deviation from starting position
    const verticalDeviation = Math.abs(shoulderMidpoint.y - this.startingBarPosition.y);

    // Update max deviation
    if (verticalDeviation > this.maxBarPathDeviation) {
      this.maxBarPathDeviation = verticalDeviation;
    }

    // Create new bar path point
    const barPathPoint: BarPathPoint = {
      position: { ...shoulderMidpoint },
      timestamp,
      deviation: verticalDeviation,
    };

    // Add to history (bounded array)
    this.barPathHistory.push(barPathPoint);
    if (this.barPathHistory.length > this.maxHistorySize) {
      this.barPathHistory.shift();
    }

    return {
      currentPosition: shoulderMidpoint,
      history: [...this.barPathHistory],
      verticalDeviation,
      maxDeviation: this.maxBarPathDeviation,
      startingPosition: this.startingBarPosition,
    };
  }

  /**
   * Get lateral shift metrics
   */
  public getLateralShiftMetrics() {
    return {
      shiftHistory: [...this.lateralShiftHistory],
      maxLateralShift: this.maxLateralShift,
      maxShiftDepth: this.maxShiftDepth,
    };
  }

  /**
   * Get bar path metrics
   */
  public getBarPathMetrics() {
    return {
      history: [...this.barPathHistory],
      maxDeviation: this.maxBarPathDeviation,
      startingPosition: this.startingBarPosition,
    };
  }

  /**
   * Reset lateral shift tracking
   */
  public resetLateralShift(): void {
    this.lateralShiftHistory = [];
    this.maxLateralShift = 0;
    this.maxShiftDepth = null;
  }

  /**
   * Reset bar path tracking
   */
  public resetBarPath(): void {
    this.barPathHistory = [];
    this.maxBarPathDeviation = 0;
    this.startingBarPosition = null;
  }

  /**
   * Reset all metrics tracking
   */
  public reset(): void {
    this.resetLateralShift();
    this.resetBarPath();
  }

  /**
   * Get current max lateral shift
   */
  public getMaxLateralShift(): number {
    return this.maxLateralShift;
  }

  /**
   * Get current max bar path deviation
   */
  public getMaxBarPathDeviation(): number {
    return this.maxBarPathDeviation;
  }
}
