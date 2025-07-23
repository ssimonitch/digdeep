/**
 * UIFlickerDetector - Test utility for detecting and analyzing UI flickering behavior
 *
 * Captures state transitions and provides metrics to detect rapid visual changes
 * that cause flickering in the UI during pose detection analysis.
 *
 * This utility follows React Testing Library best practices by tracking semantic
 * state values rather than CSS implementation details.
 */
export class UIFlickerDetector {
  private transitions: {
    timestamp: number;
    detectionState: 'invalid' | 'detecting' | 'valid';
    confidenceValue: number;
    headingText: string;
  }[] = [];

  /**
   * Records the current UI state for analysis
   * @param state Object containing current UI element states
   */
  recordState(state: {
    detectionState: 'invalid' | 'detecting' | 'valid';
    confidenceValue: number;
    headingText: string;
  }): void {
    this.transitions.push({
      timestamp: performance.now(),
      detectionState: state.detectionState,
      confidenceValue: state.confidenceValue,
      headingText: state.headingText || '',
    });
  }

  /**
   * Gets the total number of state transitions recorded
   */
  getTransitionCount(): number {
    return this.transitions.length;
  }

  /**
   * Detects if there are rapid state changes happening faster than the specified interval
   * @param minIntervalMs Minimum milliseconds between transitions to be considered stable
   * @returns true if rapid flickering is detected
   */
  hasRapidFlickering(minIntervalMs: number): boolean {
    for (let i = 1; i < this.transitions.length; i++) {
      const timeDiff = this.transitions[i].timestamp - this.transitions[i - 1].timestamp;
      if (timeDiff < minIntervalMs && timeDiff > 0) {
        return true;
      }
    }
    return false;
  }

  /**
   * Counts how many times the detection state changed
   * Useful for detecting rapid state transitions that cause visual flickering
   */
  getDetectionStateChanges(): number {
    let changes = 0;
    for (let i = 1; i < this.transitions.length; i++) {
      const currentState = this.transitions[i].detectionState;
      const previousState = this.transitions[i - 1].detectionState;

      if (currentState !== previousState) {
        changes++;
      }
    }
    return changes;
  }

  /**
   * Calculates the rate of state changes per second
   * @returns Changes per second, or 0 if insufficient data
   */
  getStateChangeFrequency(): number {
    if (this.transitions.length < 2) return 0;

    const firstTimestamp = this.transitions[0].timestamp;
    const lastTimestamp = this.transitions[this.transitions.length - 1].timestamp;
    const durationMs = lastTimestamp - firstTimestamp;

    if (durationMs === 0) return 0;

    // Convert to changes per second
    return ((this.transitions.length - 1) / durationMs) * 1000;
  }

  /**
   * Gets the number of times the heading text changed
   * Useful for detecting message flickering
   */
  getHeadingTextChanges(): number {
    let changes = 0;
    for (let i = 1; i < this.transitions.length; i++) {
      if (this.transitions[i].headingText !== this.transitions[i - 1].headingText) {
        changes++;
      }
    }
    return changes;
  }

  /**
   * Gets the number of times the confidence value changed significantly (> 5%)
   */
  getConfidenceValueChanges(): number {
    let changes = 0;
    for (let i = 1; i < this.transitions.length; i++) {
      const currentConfidence = this.transitions[i].confidenceValue;
      const previousConfidence = this.transitions[i - 1].confidenceValue;

      // Count as a change if confidence differs by more than 5%
      if (Math.abs(currentConfidence - previousConfidence) > 5) {
        changes++;
      }
    }
    return changes;
  }

  /**
   * Analyzes patterns in state transitions to identify problematic flickering
   * @returns Analysis summary with key metrics
   */
  getFlickerAnalysis(): {
    totalTransitions: number;
    stateChanges: number;
    headingChanges: number;
    confidenceChanges: number;
    changeFrequency: number;
    hasRapidFlickering: boolean;
    averageTransitionTime: number;
    minTransitionTime: number;
    maxTransitionTime: number;
  } {
    const transitionTimes: number[] = [];

    for (let i = 1; i < this.transitions.length; i++) {
      const timeDiff = this.transitions[i].timestamp - this.transitions[i - 1].timestamp;
      if (timeDiff > 0) {
        transitionTimes.push(timeDiff);
      }
    }

    const avgTime =
      transitionTimes.length > 0 ? transitionTimes.reduce((a, b) => a + b, 0) / transitionTimes.length : 0;

    return {
      totalTransitions: this.getTransitionCount(),
      stateChanges: this.getDetectionStateChanges(),
      headingChanges: this.getHeadingTextChanges(),
      confidenceChanges: this.getConfidenceValueChanges(),
      changeFrequency: this.getStateChangeFrequency(),
      hasRapidFlickering: this.hasRapidFlickering(100), // 100ms threshold
      averageTransitionTime: avgTime,
      minTransitionTime: transitionTimes.length > 0 ? Math.min(...transitionTimes) : 0,
      maxTransitionTime: transitionTimes.length > 0 ? Math.max(...transitionTimes) : 0,
    };
  }

  /**
   * Resets the detector for a new test
   */
  reset(): void {
    this.transitions = [];
  }

  /**
   * Gets raw transition data for debugging
   */
  getTransitions(): typeof this.transitions {
    return [...this.transitions];
  }
}
