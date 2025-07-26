import { useCallback, useEffect, useState } from 'react';

import { errorMonitor, type ErrorSummary } from '@/shared/services/error-monitor.service';

export function useErrorMonitoring() {
  const [errorSummary, setErrorSummary] = useState<ErrorSummary | null>(null);

  useEffect(() => {
    errorMonitor.initialize();

    const unsubscribe = errorMonitor.subscribeSummary(setErrorSummary);
    setErrorSummary(errorMonitor.getErrorSummary());

    return () => {
      unsubscribe();
      errorMonitor.destroy();
    };
  }, []);

  const reportError = useCallback(
    (
      message: string,
      severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
      context?: Record<string, unknown>,
    ) => {
      return errorMonitor.reportError(message, 'custom', severity, context);
    },
    [],
  );

  const reportJavaScriptError = useCallback((error: Error, context?: Record<string, unknown>) => {
    return errorMonitor.reportJavaScriptError(error, 'high', context);
  }, []);

  const clearErrors = useCallback(() => {
    errorMonitor.clearErrors();
  }, []);

  return {
    errorSummary,
    reportError,
    reportJavaScriptError,
    clearErrors,
  };
}
