/**
 * Camera Permission Prompt Component
 *
 * Gym-friendly UI component for handling camera permission states
 * with large touch targets, high contrast, and clear instructions.
 */

import React, { useCallback, useEffect, useState } from 'react';

import { errorMonitor } from '@/shared/services/error-monitor.service';

import { permissionService } from '../services/PermissionService';
import type { PermissionError, PermissionPromptState, PermissionState, PermissionStatus } from '../types';

/**
 * Props for CameraPermissionPrompt component
 */
export interface CameraPermissionPromptProps {
  /** Whether the prompt is visible */
  visible: boolean;
  /** Callback when permission is granted */
  onPermissionGranted: () => void;
  /** Callback when permission is denied */
  onPermissionDenied: (error: PermissionError) => void;
  /** Callback to close the prompt */
  onClose: () => void;
  /** Whether to show advanced troubleshooting */
  showAdvanced?: boolean;
  /** Custom CSS classes */
  className?: string;
}

/**
 * Camera Permission Prompt Component
 *
 * Handles all camera permission states with user-friendly messaging
 * and gym-optimized UI design.
 */
export const CameraPermissionPrompt: React.FC<CameraPermissionPromptProps> = ({
  visible,
  onPermissionGranted,
  onPermissionDenied,
  onClose,
  showAdvanced = false,
  className = '',
}) => {
  const [promptState, setPromptState] = useState<PermissionPromptState>({
    visible: false,
    permissionState: 'unknown',
    requesting: false,
    showRecoveryInstructions: false,
  });

  const [browserInstructions, setBrowserInstructions] = useState<string[]>([]);

  // Initialize permission status
  useEffect(() => {
    const checkInitialPermission = async () => {
      const status = await permissionService.checkPermissionStatus();
      setPromptState((prev) => ({
        ...prev,
        permissionState: status.state,
        error: status.error,
      }));
    };

    if (visible) {
      void checkInitialPermission();
      setBrowserInstructions(permissionService.getBrowserInstructions());
    }
  }, [visible]);

  // Handle permission state changes
  useEffect(() => {
    const unsubscribe = permissionService.onPermissionChange((status: PermissionStatus) => {
      setPromptState((prev) => ({
        ...prev,
        permissionState: status.state,
        error: status.error,
        requesting: false,
      }));

      // Auto-handle permission granted/denied
      if (status.state === 'granted') {
        onPermissionGranted();
      } else if (status.state === 'denied' && status.error) {
        onPermissionDenied(status.error);
      }
    });

    return unsubscribe;
  }, [onPermissionGranted, onPermissionDenied]);

  /**
   * Handle permission request
   */
  const handleRequestPermission = useCallback(async () => {
    if (!permissionService.canRequestPermission()) {
      return;
    }

    setPromptState((prev) => ({
      ...prev,
      requesting: true,
      showRecoveryInstructions: false,
    }));

    try {
      await permissionService.requestPermission();
    } catch (error) {
      errorMonitor.reportError(
        `Permission request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'custom',
        'medium',
        { error: error instanceof Error ? error.message : String(error) },
      );
      setPromptState((prev) => ({
        ...prev,
        requesting: false,
      }));
    }
  }, []);

  /**
   * Show recovery instructions
   */
  const handleShowRecoveryInstructions = useCallback(() => {
    setPromptState((prev) => ({
      ...prev,
      showRecoveryInstructions: true,
    }));
  }, []);

  /**
   * Hide recovery instructions
   */
  const handleHideRecoveryInstructions = useCallback(() => {
    setPromptState((prev) => ({
      ...prev,
      showRecoveryInstructions: false,
    }));
  }, []);

  /**
   * Get icon based on permission state
   */
  const getPermissionIcon = (state: PermissionState): string => {
    switch (state) {
      case 'granted':
        return '✓';
      case 'denied':
        return '✗';
      case 'prompt':
        return '📷';
      default:
        return '?';
    }
  };

  /**
   * Get color class based on permission state
   */
  const getStateColorClass = (state: PermissionState): string => {
    switch (state) {
      case 'granted':
        return 'text-green-400 bg-green-900/20 border-green-500';
      case 'denied':
        return 'text-red-400 bg-red-900/20 border-red-500';
      case 'prompt':
        return 'text-blue-400 bg-blue-900/20 border-blue-500';
      default:
        return 'text-gray-400 bg-gray-900/20 border-gray-500';
    }
  };

  if (!visible) {
    return null;
  }

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm ${className}`}>
      <div className="mx-4 w-full max-w-md rounded-lg border border-gray-700 bg-gray-900 p-8 shadow-2xl">
        {/* Header */}
        <div className="mb-6 text-center">
          <div
            className={`mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full ${getStateColorClass(promptState.permissionState)}`}
          >
            <span className="text-2xl">{getPermissionIcon(promptState.permissionState)}</span>
          </div>
          <h2 className="mb-2 text-2xl font-bold text-white">Camera Access Required</h2>
          <p className="text-gray-300">DigDeep needs camera access to record and analyze your workouts</p>
        </div>

        {/* Permission State Content */}
        <div className="space-y-6">
          {/* Initial Permission Request */}
          {promptState.permissionState === 'unknown' || promptState.permissionState === 'prompt' ? (
            <div className="text-center">
              <p className="mb-6 text-gray-300">
                Click "Allow Camera Access" to enable workout recording and real-time form analysis.
              </p>
              <button
                onClick={() => void handleRequestPermission()}
                disabled={promptState.requesting}
                className="w-full rounded-lg bg-blue-600 px-6 py-4 text-lg font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-800"
                type="button"
              >
                {promptState.requesting ? (
                  <span className="flex items-center justify-center">
                    <svg
                      className="mr-3 -ml-1 h-5 w-5 animate-spin text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Requesting Permission...
                  </span>
                ) : (
                  'Allow Camera Access'
                )}
              </button>
            </div>
          ) : null}

          {/* Permission Denied */}
          {promptState.permissionState === 'denied' && promptState.error ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-red-500/50 bg-red-900/20 p-4">
                <h3 className="mb-2 font-semibold text-red-400">Permission Denied</h3>
                <p className="text-sm text-red-300">{promptState.error.userMessage}</p>
              </div>

              {/* Recovery Actions */}
              <div className="space-y-3">
                <h4 className="font-semibold text-white">How to fix this:</h4>
                <ul className="space-y-2">
                  {promptState.error.recoveryActions.map((action) => (
                    <li key={action} className="flex items-start text-sm text-gray-300">
                      <span className="mt-1 mr-2 text-blue-400">•</span>
                      {action}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Browser-specific instructions */}
              {!promptState.showRecoveryInstructions ? (
                <button
                  onClick={handleShowRecoveryInstructions}
                  className="w-full rounded-lg bg-gray-700 px-4 py-3 font-medium text-white transition-colors hover:bg-gray-600"
                  type="button"
                >
                  Show Browser Instructions
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-lg border border-gray-600 bg-gray-800 p-4">
                    <h4 className="mb-2 font-semibold text-white">Browser Instructions:</h4>
                    <ul className="space-y-2">
                      {browserInstructions.map((instruction, index) => (
                        <li key={instruction} className="flex items-start text-sm text-gray-300">
                          <span className="mt-1 mr-2 text-green-400">{index + 1}.</span>
                          {instruction}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <button
                    onClick={handleHideRecoveryInstructions}
                    className="w-full rounded-lg bg-gray-600 px-4 py-2 font-medium text-white transition-colors hover:bg-gray-500"
                    type="button"
                  >
                    Hide Instructions
                  </button>
                </div>
              )}

              {/* Retry Button */}
              {promptState.error.canRetry && (
                <button
                  onClick={() => void handleRequestPermission()}
                  disabled={promptState.requesting}
                  className="w-full rounded-lg bg-blue-600 px-6 py-4 text-lg font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-800"
                  type="button"
                >
                  {promptState.requesting ? (
                    <span className="flex items-center justify-center">
                      <svg
                        className="mr-3 -ml-1 h-5 w-5 animate-spin text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Trying Again...
                    </span>
                  ) : (
                    'Try Again'
                  )}
                </button>
              )}
            </div>
          ) : null}

          {/* Permission Granted */}
          {promptState.permissionState === 'granted' ? (
            <div className="text-center">
              <div className="mb-4 rounded-lg border border-green-500/50 bg-green-900/20 p-4">
                <p className="font-semibold text-green-400">✓ Camera access granted!</p>
                <p className="mt-1 text-sm text-green-300">You can now record and analyze your workouts.</p>
              </div>
              <button
                onClick={onClose}
                className="w-full rounded-lg bg-green-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-green-700"
                type="button"
              >
                Continue
              </button>
            </div>
          ) : null}

          {/* Advanced Troubleshooting */}
          {showAdvanced && promptState.permissionState === 'denied' && (
            <div className="border-t border-gray-700 pt-4">
              <details className="text-sm">
                <summary className="mb-2 cursor-pointer text-gray-400 hover:text-white">
                  Advanced Troubleshooting
                </summary>
                <div className="space-y-2 text-gray-300">
                  <p>
                    <strong>Error Type:</strong> {promptState.error?.type}
                  </p>
                  <p>
                    <strong>Technical Details:</strong> {promptState.error?.message}
                  </p>
                  <p>
                    <strong>Browser Support:</strong>
                  </p>
                  <ul className="ml-4 space-y-1">
                    <li>
                      Permissions API: {permissionService.getPermissionStatus().browserSupport.permissions ? '✓' : '✗'}
                    </li>
                    <li>
                      MediaDevices: {permissionService.getPermissionStatus().browserSupport.mediaDevices ? '✓' : '✗'}
                    </li>
                    <li>
                      getUserMedia: {permissionService.getPermissionStatus().browserSupport.getUserMedia ? '✓' : '✗'}
                    </li>
                  </ul>
                </div>
              </details>
            </div>
          )}
        </div>

        {/* Close Button */}
        <div className="mt-8 flex justify-center">
          <button
            onClick={onClose}
            className="rounded-lg bg-gray-700 px-6 py-2 font-medium text-gray-300 transition-colors hover:bg-gray-600 hover:text-white"
            type="button"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default CameraPermissionPrompt;
