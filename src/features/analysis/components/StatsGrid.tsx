import { memo, useEffect, useRef, useState } from 'react';

export interface StatsGridProps {
  /** Current rep count */
  currentRep: number;
  /** Depth percentage (0-100) */
  depthPercentage: number;
  /** Whether the pose is valid for showing depth */
  isValidPose: boolean;
  /** Whether the user is balanced */
  isBalanced: boolean;
  /** Current frames per second */
  fps: number;
}

/**
 * StatsGrid component displaying exercise metrics in a grid layout.
 * Optimized with React.memo and throttled FPS updates to reduce re-renders.
 */
export const StatsGrid = memo(function StatsGrid({
  currentRep,
  depthPercentage,
  isValidPose,
  isBalanced,
  fps,
}: StatsGridProps) {
  // Throttled FPS state - only updates once per second
  const [throttledFps, setThrottledFps] = useState(fps);
  const lastFpsUpdate = useRef(Date.now());

  useEffect(() => {
    const now = Date.now();
    // Only update FPS display once per second
    if (now - lastFpsUpdate.current >= 1000) {
      setThrottledFps(fps);
      lastFpsUpdate.current = now;
    }
  }, [fps]);

  return (
    <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
      <div className="bg-card rounded-lg border p-4 text-center">
        <div className="text-2xl font-bold">{currentRep}</div>
        <div className="text-muted-foreground text-sm">Reps</div>
      </div>

      {isValidPose ? (
        <div className="bg-card rounded-lg border p-4 text-center" data-testid="depth-indicator">
          <div className="text-2xl font-bold">{`${Math.round(depthPercentage)}%`}</div>
          <div className="text-muted-foreground text-sm">Depth</div>
        </div>
      ) : (
        <div className="bg-card rounded-lg border p-4 text-center">
          <div className="text-2xl font-bold">--</div>
          <div className="text-muted-foreground text-sm">Depth</div>
        </div>
      )}

      <div className="bg-card rounded-lg border p-4 text-center">
        <div className="text-2xl font-bold">{throttledFps}</div>
        <div className="text-muted-foreground text-sm">FPS</div>
      </div>

      {isValidPose ? (
        <div className="bg-card rounded-lg border p-4 text-center" data-testid="balance-meter">
          <div className={`text-2xl font-bold ${isBalanced ? 'text-green-600' : 'text-red-600'}`}>
            {isBalanced ? '✓' : '⚠️'}
          </div>
          <div className="text-muted-foreground text-sm">Balance</div>
        </div>
      ) : (
        <div className="bg-card rounded-lg border p-4 text-center">
          <div className="text-2xl font-bold text-gray-400">--</div>
          <div className="text-muted-foreground text-sm">Balance</div>
        </div>
      )}
    </div>
  );
});

// Custom comparison function for deep equality check on primitive values
StatsGrid.displayName = 'StatsGrid';
