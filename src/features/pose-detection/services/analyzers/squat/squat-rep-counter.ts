import type { SquatAnalysisConfig } from '@/shared/exercise-config/squat';

/**
 * Rep counting state
 */
export type RepPhase = 'standing' | 'descending' | 'bottom' | 'ascending';

/**
 * Rep tracking data
 */
export interface RepData {
  phase: RepPhase;
  startTime: number;
  maxDepth: number;
  maxLateralShift: number;
  barPathDeviation: number;
  isValid: boolean;
}

/**
 * Input metrics for rep counting
 */
export interface RepCountingMetrics {
  depthPercentage: number;
  hasAchievedDepth: boolean;
  lateralShift: number;
  barPathDeviation: number;
}

/**
 * RepCounter - Manages rep counting state machine and validation
 *
 * Encapsulates the logic for:
 * - Rep phase state machine transitions
 * - Rep validation based on depth and form quality
 * - Tracking current and completed reps
 */
export class RepCounter {
  private currentRepPhase: RepPhase = 'standing';
  private currentRep: RepData | null = null;
  private completedReps: RepData[] = [];
  private repCount = 0;
  private readonly config: SquatAnalysisConfig;

  constructor(config: SquatAnalysisConfig) {
    this.config = config;
  }

  /**
   * Update rep counting state based on current metrics
   */
  public update(metrics: RepCountingMetrics, timestamp: number) {
    const { depthPercentage, hasAchievedDepth, lateralShift, barPathDeviation } = metrics;

    // State machine transitions
    switch (this.currentRepPhase) {
      case 'standing':
        this.handleStandingPhase(depthPercentage, timestamp, lateralShift, barPathDeviation);
        break;

      case 'descending':
        this.handleDescendingPhase(depthPercentage, hasAchievedDepth, lateralShift, barPathDeviation);
        break;

      case 'bottom':
        this.handleBottomPhase(depthPercentage, lateralShift, barPathDeviation);
        break;

      case 'ascending':
        this.handleAscendingPhase(depthPercentage);
        break;
    }

    return {
      currentRep: this.currentRep,
      repCount: this.repCount,
      phase: this.currentRepPhase,
      completedReps: [...this.completedReps],
    };
  }

  /**
   * Handle standing phase transitions
   */
  private handleStandingPhase(
    depthPercentage: number,
    timestamp: number,
    lateralShift: number,
    barPathDeviation: number,
  ): void {
    // Start rep when moving down (depth > startRepThreshold)
    if (depthPercentage > this.config.depth.startRepThreshold) {
      this.currentRepPhase = 'descending';
      this.currentRep = {
        phase: 'descending',
        startTime: timestamp,
        maxDepth: depthPercentage,
        maxLateralShift: lateralShift,
        barPathDeviation: barPathDeviation,
        isValid: true,
      };
    }
  }

  /**
   * Handle descending phase transitions
   */
  private handleDescendingPhase(
    depthPercentage: number,
    hasAchievedDepth: boolean,
    lateralShift: number,
    barPathDeviation: number,
  ): void {
    // Continue descending or reach bottom
    if (this.currentRep) {
      this.currentRep.maxDepth = Math.max(this.currentRep.maxDepth, depthPercentage);
      this.currentRep.maxLateralShift = Math.max(this.currentRep.maxLateralShift, lateralShift);
      this.currentRep.barPathDeviation = Math.max(this.currentRep.barPathDeviation, barPathDeviation);
    }

    // Transition to bottom when depth achieved or depth stops increasing
    if (hasAchievedDepth || depthPercentage > this.config.depth.bottomPhaseThreshold) {
      this.currentRepPhase = 'bottom';
      if (this.currentRep) {
        this.currentRep.phase = 'bottom';
      }
    }
  }

  /**
   * Handle bottom phase transitions
   */
  private handleBottomPhase(depthPercentage: number, lateralShift: number, barPathDeviation: number): void {
    // Update max values while at bottom
    if (this.currentRep) {
      this.currentRep.maxDepth = Math.max(this.currentRep.maxDepth, depthPercentage);
      this.currentRep.maxLateralShift = Math.max(this.currentRep.maxLateralShift, lateralShift);
      this.currentRep.barPathDeviation = Math.max(this.currentRep.barPathDeviation, barPathDeviation);
    }

    // Start ascending when depth decreases significantly
    if (depthPercentage < this.config.depth.ascendingThreshold) {
      this.currentRepPhase = 'ascending';
      if (this.currentRep) {
        this.currentRep.phase = 'ascending';
      }
    }
  }

  /**
   * Handle ascending phase transitions
   */
  private handleAscendingPhase(depthPercentage: number): void {
    // Complete rep when returning to standing (depth < completeRepThreshold)
    if (depthPercentage < this.config.depth.completeRepThreshold) {
      // Transition directly to standing
      this.currentRepPhase = 'standing';

      if (this.currentRep) {
        // Mark the rep phase as ascending before validation
        this.currentRep.phase = 'ascending';

        // Validate rep quality
        this.currentRep.isValid = this.validateRep(this.currentRep);

        // Add to completed reps and increment counter
        this.completedReps.push(this.currentRep);
        if (this.currentRep.isValid) {
          this.repCount++;
        }

        // Reset current rep for next rep
        this.currentRep = null;
      }
    }
  }

  /**
   * Validate rep quality based on depth and balance thresholds
   */
  private validateRep(rep: RepData): boolean {
    // Rep is valid if:
    // 1. Achieved minimum depth (configured threshold)
    const minDepthThreshold = this.config.depth.depthThreshold * 100;
    const achievedDepth = rep.maxDepth >= minDepthThreshold;

    // 2. Maintained reasonable balance (lateral shift within configured limit)
    const reasonableBalance = rep.maxLateralShift < this.config.validation.maxLateralShift;

    // 3. Bar path deviation is reasonable (within configured limit)
    const reasonableBarPath = rep.barPathDeviation < this.config.validation.maxBarPathDeviation;

    return achievedDepth && reasonableBalance && reasonableBarPath;
  }

  /**
   * Reset rep counting state
   */
  public reset(): void {
    this.currentRepPhase = 'standing';
    this.currentRep = null;
    this.completedReps = [];
    this.repCount = 0;
  }

  /**
   * Get current state
   */
  public getState() {
    return {
      currentRep: this.currentRep,
      repCount: this.repCount,
      phase: this.currentRepPhase,
      completedReps: [...this.completedReps],
    };
  }

  /**
   * Get current phase
   */
  public getCurrentPhase(): RepPhase {
    return this.currentRepPhase;
  }

  /**
   * Get rep count
   */
  public getRepCount(): number {
    return this.repCount;
  }
}
