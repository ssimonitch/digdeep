import { memo } from 'react';

import { Button } from '@/shared/components/ui/button';

export interface ControlsSectionProps {
  /** Whether analysis is currently running */
  isAnalyzing: boolean;
  /** Whether camera permission is pending */
  isCameraPermissionPending: boolean;
  /** Handler for starting analysis session */
  onStartAnalysis: () => void;
  /** Handler for stopping analysis session */
  onStopAnalysis: () => void;
  /** Handler for resetting the session */
  onResetSession: () => void;
}

/**
 * ControlsSection component for analysis session control buttons.
 * Optimized with React.memo to prevent unnecessary re-renders.
 */
export const ControlsSection = memo(function ControlsSection({
  isAnalyzing,
  isCameraPermissionPending,
  onStartAnalysis,
  onStopAnalysis,
  onResetSession,
}: ControlsSectionProps) {
  return (
    <div className="mb-6 flex flex-wrap justify-center gap-4">
      {!isAnalyzing ? (
        <Button
          onClick={onStartAnalysis}
          size="lg"
          className="bg-primary hover:bg-primary/90 h-14 px-8 text-lg font-bold"
          disabled={isCameraPermissionPending}
        >
          {isCameraPermissionPending ? 'Requesting Camera...' : 'START ANALYSIS'}
        </Button>
      ) : (
        <>
          <Button onClick={onStopAnalysis} variant="destructive" size="lg" className="h-14 px-8 text-lg font-bold">
            STOP ANALYSIS
          </Button>
          <Button onClick={onResetSession} variant="outline" size="lg" className="h-14 px-8 text-lg font-bold">
            RESET SESSION
          </Button>
        </>
      )}
    </div>
  );
});

// Custom comparison function for React.memo
// Re-render only if control state or handlers change
ControlsSection.displayName = 'ControlsSection';
