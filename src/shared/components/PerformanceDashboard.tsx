import { useState } from 'react';

import { usePerformanceMonitoring } from '@/hooks/usePerformanceMonitoring';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { performanceMonitor } from '@/shared/services/performance-monitor.service';

interface PerformanceDashboardProps {
  className?: string;
  compact?: boolean;
  showErrors?: boolean;
}

export function PerformanceDashboard({
  className = '',
  compact = false,
  showErrors = true,
}: PerformanceDashboardProps) {
  const [isVisible, setIsVisible] = useState(false);
  const { metrics, grade, errorSummary, isMonitoring, startMonitoring, stopMonitoring, resetMetrics } =
    usePerformanceMonitoring({ autoStart: false, trackErrors: showErrors });

  const memoryCapabilities = performanceMonitor.getMemoryCapabilities();

  if (!isVisible) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsVisible(true)}
        className="fixed right-4 bottom-4 z-50 opacity-50 hover:opacity-100"
      >
        📊 Performance
      </Button>
    );
  }

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'excellent':
        return 'bg-green-500';
      case 'good':
        return 'bg-blue-500';
      case 'fair':
        return 'bg-yellow-500';
      case 'poor':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const formatMemory = (mb: number) => {
    return mb > 1024 ? `${(mb / 1024).toFixed(1)}GB` : `${mb}MB`;
  };

  return (
    <Card className={`fixed right-4 bottom-4 z-50 w-80 p-4 ${className}`}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Performance Monitor</h3>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className={`text-xs ${getGradeColor(grade)} text-white`}>
              {grade.toUpperCase()}
            </Badge>
            <Button variant="ghost" size="sm" onClick={() => setIsVisible(false)} className="h-6 w-6 p-0">
              ✕
            </Button>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant={isMonitoring ? 'destructive' : 'default'}
            size="sm"
            onClick={isMonitoring ? stopMonitoring : startMonitoring}
            className="flex-1"
          >
            {isMonitoring ? 'Stop' : 'Start'}
          </Button>
          <Button variant="outline" size="sm" onClick={resetMetrics} className="flex-1">
            Reset
          </Button>
        </div>

        {metrics && (
          <div className="space-y-3">
            {!compact && (
              <>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="text-muted-foreground">Current FPS</div>
                    <div className="font-mono text-lg">{metrics.fps.toFixed(1)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Avg FPS</div>
                    <div className="font-mono text-lg">{metrics.avgFps.toFixed(1)}</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Memory Usage</span>
                    <Badge
                      variant="outline"
                      className={`text-xs ${
                        memoryCapabilities.activeAPI === 'modern'
                          ? 'border-green-500 text-green-700'
                          : memoryCapabilities.activeAPI === 'legacy'
                            ? 'border-yellow-500 text-yellow-700'
                            : 'border-red-500 text-red-700'
                      }`}
                    >
                      {memoryCapabilities.activeAPI}
                    </Badge>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span>{formatMemory(metrics.memoryUsage.used)} used</span>
                    <span>{metrics.memoryUsage.percentage}%</span>
                  </div>
                  <div className="bg-muted h-2 w-full rounded">
                    <div
                      className={`h-2 rounded transition-all duration-300 ${
                        metrics.memoryUsage.percentage > 85
                          ? 'bg-red-500'
                          : metrics.memoryUsage.percentage > 75
                            ? 'bg-yellow-500'
                            : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(metrics.memoryUsage.percentage, 100)}%` }}
                    />
                  </div>
                  {memoryCapabilities.activeAPI === 'modern' && (
                    <div className="text-xs text-green-600">✓ Using modern memory API</div>
                  )}
                  {memoryCapabilities.activeAPI === 'legacy' && (
                    <div className="text-xs text-yellow-600">⚠️ Using deprecated memory API</div>
                  )}
                  {memoryCapabilities.activeAPI === 'none' && (
                    <div className="text-xs text-red-600">❌ Memory monitoring unavailable</div>
                  )}
                </div>

                {metrics.frameDrops > 0 && (
                  <div className="text-xs">
                    <span className="text-muted-foreground">Frame Drops:</span>
                    <span className="ml-2 font-mono text-red-500">{metrics.frameDrops}</span>
                  </div>
                )}
              </>
            )}

            {compact && (
              <div className="flex items-center justify-between">
                <div className="text-xs">
                  <span className="font-mono">{metrics.fps.toFixed(1)}</span>
                  <span className="text-muted-foreground ml-1">FPS</span>
                </div>
                <div className="text-xs">
                  <span className="font-mono">{metrics.memoryUsage.percentage}%</span>
                  <span className="text-muted-foreground ml-1">MEM</span>
                </div>
              </div>
            )}
          </div>
        )}

        {showErrors && errorSummary && errorSummary.totalErrors > 0 && (
          <div className="border-t pt-3">
            <div className="text-muted-foreground mb-2 text-xs">Errors</div>
            <div className="flex justify-between text-xs">
              <span>Total: {errorSummary.totalErrors}</span>
              <span className="text-red-500">Critical: {errorSummary.criticalErrors.length}</span>
            </div>
            {errorSummary.recentErrors.length > 0 && !compact && (
              <div className="mt-2 space-y-1">
                {errorSummary.recentErrors.slice(0, 2).map((error) => (
                  <div key={error.id} className="truncate text-xs text-red-500">
                    {error.message}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
