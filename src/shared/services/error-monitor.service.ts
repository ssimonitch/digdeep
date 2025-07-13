export type ErrorContext = Record<string, unknown>;

export interface ErrorReport {
  id: string;
  type: 'javascript' | 'promise' | 'network' | 'media' | 'custom';
  message: string;
  stack?: string;
  timestamp: number;
  url?: string;
  lineNumber?: number;
  columnNumber?: number;
  userAgent: string;
  context?: ErrorContext;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface ErrorSummary {
  totalErrors: number;
  errorsByType: Record<string, number>;
  errorsBySeverity: Record<string, number>;
  recentErrors: ErrorReport[];
  criticalErrors: ErrorReport[];
}

export class ErrorMonitor {
  private errors: ErrorReport[] = [];
  private readonly maxErrorHistory = 100;
  private observers: ((error: ErrorReport) => void)[] = [];
  private summaryObservers: ((summary: ErrorSummary) => void)[] = [];
  private isInitialized = false;

  initialize(): void {
    if (this.isInitialized) return;

    this.setupGlobalErrorHandlers();
    this.isInitialized = true;
  }

  destroy(): void {
    if (!this.isInitialized) return;

    window.removeEventListener('error', this.handleGlobalError);
    window.removeEventListener('unhandledrejection', this.handleUnhandledRejection);
    this.isInitialized = false;
  }

  reportError(
    message: string,
    type: ErrorReport['type'] = 'custom',
    severity: ErrorReport['severity'] = 'medium',
    context?: ErrorContext,
  ): string {
    const error: ErrorReport = {
      id: this.generateErrorId(),
      type,
      message,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      severity,
      context,
    };

    this.addError(error);
    return error.id;
  }

  reportJavaScriptError(error: Error, severity: ErrorReport['severity'] = 'high', context?: ErrorContext): string {
    const errorReport: ErrorReport = {
      id: this.generateErrorId(),
      type: 'javascript',
      message: error.message,
      stack: error.stack,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      severity,
      context,
    };

    this.addError(errorReport);
    return errorReport.id;
  }

  reportNetworkError(url: string, status: number, statusText: string, context?: ErrorContext): string {
    const severity: ErrorReport['severity'] = status >= 500 ? 'high' : 'medium';

    const error: ErrorReport = {
      id: this.generateErrorId(),
      type: 'network',
      message: `Network error: ${status} ${statusText}`,
      url,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      severity,
      context: { ...context, status, statusText },
    };

    this.addError(error);
    return error.id;
  }

  reportMediaError(mediaElement: HTMLMediaElement, context?: ErrorContext): string {
    const error = mediaElement.error;
    let message = 'Unknown media error';
    let severity: ErrorReport['severity'] = 'medium';

    if (error) {
      switch (error.code) {
        case MediaError.MEDIA_ERR_ABORTED:
          message = 'Media playback aborted';
          severity = 'low';
          break;
        case MediaError.MEDIA_ERR_NETWORK:
          message = 'Network error while loading media';
          severity = 'high';
          break;
        case MediaError.MEDIA_ERR_DECODE:
          message = 'Media decode error';
          severity = 'high';
          break;
        case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
          message = 'Media source not supported';
          severity = 'medium';
          break;
      }
    }

    const errorReport: ErrorReport = {
      id: this.generateErrorId(),
      type: 'media',
      message,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      severity,
      context: {
        ...context,
        mediaErrorCode: error?.code,
        mediaSrc: mediaElement.src,
        mediaType: mediaElement.tagName.toLowerCase(),
      },
    };

    this.addError(errorReport);
    return errorReport.id;
  }

  subscribe(observer: (error: ErrorReport) => void): () => void {
    this.observers.push(observer);
    return () => {
      const index = this.observers.indexOf(observer);
      if (index > -1) {
        this.observers.splice(index, 1);
      }
    };
  }

  subscribeSummary(observer: (summary: ErrorSummary) => void): () => void {
    this.summaryObservers.push(observer);
    return () => {
      const index = this.summaryObservers.indexOf(observer);
      if (index > -1) {
        this.summaryObservers.splice(index, 1);
      }
    };
  }

  getErrorSummary(): ErrorSummary {
    const errorsByType: Record<string, number> = {};
    const errorsBySeverity: Record<string, number> = {};

    this.errors.forEach((error) => {
      errorsByType[error.type] = (errorsByType[error.type] || 0) + 1;
      errorsBySeverity[error.severity] = (errorsBySeverity[error.severity] || 0) + 1;
    });

    const recentErrors = this.errors.slice(-10).sort((a, b) => b.timestamp - a.timestamp);

    const criticalErrors = this.errors
      .filter((error) => error.severity === 'critical')
      .sort((a, b) => b.timestamp - a.timestamp);

    return {
      totalErrors: this.errors.length,
      errorsByType,
      errorsBySeverity,
      recentErrors,
      criticalErrors,
    };
  }

  clearErrors(): void {
    this.errors = [];
    this.notifySummaryObservers();
  }

  getErrors(): ErrorReport[] {
    return [...this.errors];
  }

  private setupGlobalErrorHandlers(): void {
    window.addEventListener('error', this.handleGlobalError);
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection);
  }

  private handleGlobalError = (event: ErrorEvent): void => {
    const error: ErrorReport = {
      id: this.generateErrorId(),
      type: 'javascript',
      message: event.message,
      stack: event.error instanceof Error ? event.error.stack : undefined,
      timestamp: Date.now(),
      url: event.filename,
      lineNumber: event.lineno,
      columnNumber: event.colno,
      userAgent: navigator.userAgent,
      severity: 'high',
    };

    this.addError(error);
  };

  private handleUnhandledRejection = (event: PromiseRejectionEvent): void => {
    const error: ErrorReport = {
      id: this.generateErrorId(),
      type: 'promise',
      message: `Unhandled promise rejection: ${event.reason}`,
      stack: event.reason instanceof Error ? event.reason.stack : undefined,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      severity: 'high',
      context: { reason: event.reason },
    };

    this.addError(error);
  };

  private addError(error: ErrorReport): void {
    this.errors.push(error);

    if (this.errors.length > this.maxErrorHistory) {
      this.errors.shift();
    }

    this.notifyObservers(error);
    this.notifySummaryObservers();
  }

  private notifyObservers(error: ErrorReport): void {
    this.observers.forEach((observer) => {
      try {
        observer(error);
      } catch (observerError) {
        console.error('Error in error observer:', observerError);
      }
    });
  }

  private notifySummaryObservers(): void {
    const summary = this.getErrorSummary();
    this.summaryObservers.forEach((observer) => {
      try {
        observer(summary);
      } catch (observerError) {
        console.error('Error in summary observer:', observerError);
      }
    });
  }

  private generateErrorId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }
}

export const errorMonitor = new ErrorMonitor();
