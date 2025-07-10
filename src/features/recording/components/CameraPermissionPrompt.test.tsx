/**
 * Camera Permission Prompt Component Tests
 *
 * Tests for the camera permission prompt UI component
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { permissionService } from '../services/PermissionService';
import type { PermissionChangeCallback, PermissionError, PermissionStatus } from '../types';
import { CameraPermissionPrompt } from './CameraPermissionPrompt';

// Mock the permission service
vi.mock('../services/PermissionService', () => ({
  permissionService: {
    checkPermissionStatus: vi.fn(),
    requestPermission: vi.fn(),
    canRequestPermission: vi.fn(),
    getBrowserInstructions: vi.fn(),
    onPermissionChange: vi.fn(),
    getPermissionStatus: vi.fn(),
  },
}));

const mockPermissionService = vi.mocked(permissionService);

describe('CameraPermissionPrompt', () => {
  const defaultProps = {
    visible: true,
    onPermissionGranted: vi.fn(),
    onPermissionDenied: vi.fn(),
    onClose: vi.fn(),
  };

  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    mockPermissionService.checkPermissionStatus.mockResolvedValue({
      state: 'prompt',
      lastChecked: Date.now(),
      browserSupport: {
        permissions: true,
        mediaDevices: true,
        getUserMedia: true,
      },
    });

    mockPermissionService.canRequestPermission.mockReturnValue(true);
    mockPermissionService.getBrowserInstructions.mockReturnValue([
      'Click the camera icon in the address bar',
      'Select "Allow" for camera access',
      'Refresh the page',
    ]);

    mockPermissionService.getPermissionStatus.mockReturnValue({
      state: 'prompt',
      lastChecked: Date.now(),
      browserSupport: {
        permissions: true,
        mediaDevices: true,
        getUserMedia: true,
      },
    });

    mockPermissionService.onPermissionChange.mockImplementation(() => {
      return () => {
        /* cleanup */
      }; // Return unsubscribe function
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Visibility', () => {
    it('should not render when not visible', () => {
      render(<CameraPermissionPrompt {...defaultProps} visible={false} />);
      expect(screen.queryByText('Camera Access Required')).not.toBeInTheDocument();
    });

    it('should render when visible', async () => {
      render(<CameraPermissionPrompt {...defaultProps} />);
      await screen.findByRole('heading', { level: 2 });
      expect(screen.getByText('Camera Access Required')).toBeInTheDocument();
    });
  });

  describe('Initial Permission Request State', () => {
    it('should show initial permission request UI', async () => {
      render(<CameraPermissionPrompt {...defaultProps} />);
      await screen.findByRole('heading', { level: 2 });
      expect(screen.getByText('Camera Access Required')).toBeInTheDocument();
      expect(screen.getByText('DigDeep needs camera access to record and analyze your workouts')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /allow camera access/i })).toBeInTheDocument();
    });

    it('should request permission when button is clicked', async () => {
      mockPermissionService.requestPermission.mockResolvedValue({
        state: 'granted',
        lastChecked: Date.now(),
        browserSupport: {
          permissions: true,
          mediaDevices: true,
          getUserMedia: true,
        },
      });

      render(<CameraPermissionPrompt {...defaultProps} />);

      const allowButton = screen.getByRole('button', { name: /allow camera access/i });
      await user.click(allowButton);

      expect(mockPermissionService.requestPermission).toHaveBeenCalled();
    });

    it('should show loading state during permission request', async () => {
      // Mock a delayed response
      mockPermissionService.requestPermission.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                state: 'granted' as const,
                lastChecked: Date.now(),
                browserSupport: {
                  permissions: true,
                  mediaDevices: true,
                  getUserMedia: true,
                },
              });
            }, 100);
          }),
      );

      render(<CameraPermissionPrompt {...defaultProps} />);

      const allowButton = screen.getByRole('button', { name: /allow camera access/i });
      await user.click(allowButton);

      expect(screen.getByText('Requesting Permission...')).toBeInTheDocument();
      expect(allowButton).toBeDisabled();
    });
  });

  describe('Permission Granted State', () => {
    it('should show success message when permission is granted', async () => {
      const mockStatus: PermissionStatus = {
        state: 'granted',
        lastChecked: Date.now(),
        browserSupport: {
          permissions: true,
          mediaDevices: true,
          getUserMedia: true,
        },
      };

      mockPermissionService.checkPermissionStatus.mockResolvedValue(mockStatus);

      // Mock permission change callback to simulate granted state
      mockPermissionService.onPermissionChange.mockImplementation((callback: PermissionChangeCallback) => {
        setTimeout(() => callback(mockStatus), 0);
        return () => {
          /* cleanup */
        };
      });

      render(<CameraPermissionPrompt {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('✓ Camera access granted!')).toBeInTheDocument();
      });

      expect(screen.getByText('You can now record and analyze your workouts.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
    });

    it('should call onPermissionGranted when permission is granted', async () => {
      const mockStatus: PermissionStatus = {
        state: 'granted',
        lastChecked: Date.now(),
        browserSupport: {
          permissions: true,
          mediaDevices: true,
          getUserMedia: true,
        },
      };

      mockPermissionService.onPermissionChange.mockImplementation((callback: PermissionChangeCallback) => {
        setTimeout(() => callback(mockStatus), 0);
        return () => {
          /* cleanup */
        };
      });

      render(<CameraPermissionPrompt {...defaultProps} />);

      await waitFor(() => {
        expect(defaultProps.onPermissionGranted).toHaveBeenCalled();
      });
    });

    it('should handle continue button click', async () => {
      const mockStatus: PermissionStatus = {
        state: 'granted',
        lastChecked: Date.now(),
        browserSupport: {
          permissions: true,
          mediaDevices: true,
          getUserMedia: true,
        },
      };

      mockPermissionService.checkPermissionStatus.mockResolvedValue(mockStatus);
      mockPermissionService.onPermissionChange.mockImplementation((callback: PermissionChangeCallback) => {
        setTimeout(() => callback(mockStatus), 0);
        return () => {
          /* cleanup */
        };
      });

      render(<CameraPermissionPrompt {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
      });

      const continueButton = screen.getByRole('button', { name: /continue/i });
      await user.click(continueButton);

      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  describe('Permission Denied State', () => {
    const mockError: PermissionError = {
      type: 'permission_denied',
      message: 'Camera permission denied by user',
      userMessage:
        'Camera access is required to record your workouts. Please enable camera permissions in your browser settings.',
      recoveryActions: [
        "Click the camera icon in your browser's address bar",
        'Select "Allow" for camera permissions',
        'Refresh the page and try again',
      ],
      canRetry: true,
    };

    it('should show error message when permission is denied', async () => {
      const mockStatus: PermissionStatus = {
        state: 'denied',
        error: mockError,
        lastChecked: Date.now(),
        browserSupport: {
          permissions: true,
          mediaDevices: true,
          getUserMedia: true,
        },
      };

      mockPermissionService.checkPermissionStatus.mockResolvedValue(mockStatus);
      mockPermissionService.onPermissionChange.mockImplementation((callback: PermissionChangeCallback) => {
        setTimeout(() => callback(mockStatus), 0);
        return () => {
          /* cleanup */
        };
      });

      render(<CameraPermissionPrompt {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Permission Denied')).toBeInTheDocument();
      });

      expect(screen.getByText(mockError.userMessage)).toBeInTheDocument();
    });

    it('should show recovery actions', async () => {
      const mockStatus: PermissionStatus = {
        state: 'denied',
        error: mockError,
        lastChecked: Date.now(),
        browserSupport: {
          permissions: true,
          mediaDevices: true,
          getUserMedia: true,
        },
      };

      mockPermissionService.checkPermissionStatus.mockResolvedValue(mockStatus);
      mockPermissionService.onPermissionChange.mockImplementation((callback: PermissionChangeCallback) => {
        setTimeout(() => callback(mockStatus), 0);
        return () => {
          /* cleanup */
        };
      });

      render(<CameraPermissionPrompt {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('How to fix this:')).toBeInTheDocument();
      });

      mockError.recoveryActions.forEach((action) => {
        expect(screen.getByText(action)).toBeInTheDocument();
      });
    });

    it('should show retry button when error can be retried', async () => {
      const mockStatus: PermissionStatus = {
        state: 'denied',
        error: mockError,
        lastChecked: Date.now(),
        browserSupport: {
          permissions: true,
          mediaDevices: true,
          getUserMedia: true,
        },
      };

      mockPermissionService.checkPermissionStatus.mockResolvedValue(mockStatus);
      mockPermissionService.onPermissionChange.mockImplementation((callback: PermissionChangeCallback) => {
        setTimeout(() => callback(mockStatus), 0);
        return () => {
          /* cleanup */
        };
      });

      render(<CameraPermissionPrompt {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
      });
    });

    it('should not show retry button when error cannot be retried', async () => {
      const nonRetryableError: PermissionError = {
        ...mockError,
        canRetry: false,
      };

      const mockStatus: PermissionStatus = {
        state: 'denied',
        error: nonRetryableError,
        lastChecked: Date.now(),
        browserSupport: {
          permissions: true,
          mediaDevices: true,
          getUserMedia: true,
        },
      };

      mockPermissionService.checkPermissionStatus.mockResolvedValue(mockStatus);
      mockPermissionService.onPermissionChange.mockImplementation((callback: PermissionChangeCallback) => {
        setTimeout(() => callback(mockStatus), 0);
        return () => {
          /* cleanup */
        };
      });

      render(<CameraPermissionPrompt {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Permission Denied')).toBeInTheDocument();
      });

      expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
    });

    it('should call onPermissionDenied when permission is denied', async () => {
      const mockStatus: PermissionStatus = {
        state: 'denied',
        error: mockError,
        lastChecked: Date.now(),
        browserSupport: {
          permissions: true,
          mediaDevices: true,
          getUserMedia: true,
        },
      };

      mockPermissionService.onPermissionChange.mockImplementation((callback: PermissionChangeCallback) => {
        setTimeout(() => callback(mockStatus), 0);
        return () => {
          /* cleanup */
        };
      });

      render(<CameraPermissionPrompt {...defaultProps} />);

      await waitFor(() => {
        expect(defaultProps.onPermissionDenied).toHaveBeenCalledWith(mockError);
      });
    });
  });

  describe('Browser Instructions', () => {
    it('should show browser instructions when requested', async () => {
      const mockError: PermissionError = {
        type: 'permission_denied',
        message: 'Camera permission denied by user',
        userMessage: 'Camera access is required to record your workouts.',
        recoveryActions: ['Click the camera icon'],
        canRetry: true,
      };

      const mockStatus: PermissionStatus = {
        state: 'denied',
        error: mockError,
        lastChecked: Date.now(),
        browserSupport: {
          permissions: true,
          mediaDevices: true,
          getUserMedia: true,
        },
      };

      mockPermissionService.checkPermissionStatus.mockResolvedValue(mockStatus);
      mockPermissionService.onPermissionChange.mockImplementation((callback: PermissionChangeCallback) => {
        setTimeout(() => callback(mockStatus), 0);
        return () => {
          /* cleanup */
        };
      });

      render(<CameraPermissionPrompt {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /show browser instructions/i })).toBeInTheDocument();
      });

      const showInstructionsButton = screen.getByRole('button', { name: /show browser instructions/i });
      await user.click(showInstructionsButton);

      expect(screen.getByText('Browser Instructions:')).toBeInTheDocument();
      expect(screen.getByText('Click the camera icon in the address bar')).toBeInTheDocument();
    });

    it('should hide browser instructions when requested', async () => {
      const mockError: PermissionError = {
        type: 'permission_denied',
        message: 'Camera permission denied by user',
        userMessage: 'Camera access is required to record your workouts.',
        recoveryActions: ['Click the camera icon'],
        canRetry: true,
      };

      const mockStatus: PermissionStatus = {
        state: 'denied',
        error: mockError,
        lastChecked: Date.now(),
        browserSupport: {
          permissions: true,
          mediaDevices: true,
          getUserMedia: true,
        },
      };

      mockPermissionService.checkPermissionStatus.mockResolvedValue(mockStatus);
      mockPermissionService.onPermissionChange.mockImplementation((callback: PermissionChangeCallback) => {
        setTimeout(() => callback(mockStatus), 0);
        return () => {
          /* cleanup */
        };
      });

      render(<CameraPermissionPrompt {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /show browser instructions/i })).toBeInTheDocument();
      });

      // Show instructions
      await user.click(screen.getByRole('button', { name: /show browser instructions/i }));

      // Hide instructions
      const hideInstructionsButton = screen.getByRole('button', { name: /hide instructions/i });
      await user.click(hideInstructionsButton);

      expect(screen.queryByText('Browser Instructions:')).not.toBeInTheDocument();
    });
  });

  describe('Advanced Troubleshooting', () => {
    it('should show advanced troubleshooting when enabled', async () => {
      const mockError: PermissionError = {
        type: 'permission_denied',
        message: 'Camera permission denied by user',
        userMessage: 'Camera access is required to record your workouts.',
        recoveryActions: ['Click the camera icon'],
        canRetry: true,
      };

      const mockStatus: PermissionStatus = {
        state: 'denied',
        error: mockError,
        lastChecked: Date.now(),
        browserSupport: {
          permissions: true,
          mediaDevices: true,
          getUserMedia: true,
        },
      };

      mockPermissionService.checkPermissionStatus.mockResolvedValue(mockStatus);
      mockPermissionService.onPermissionChange.mockImplementation((callback: PermissionChangeCallback) => {
        setTimeout(() => callback(mockStatus), 0);
        return () => {
          /* cleanup */
        };
      });

      render(<CameraPermissionPrompt {...defaultProps} showAdvanced={true} />);

      await waitFor(() => {
        expect(screen.getByText('Advanced Troubleshooting')).toBeInTheDocument();
      });

      // Open advanced section
      const advancedSection = screen.getByRole('group');
      await user.click(advancedSection);

      expect(screen.getByText('Error Type:')).toBeInTheDocument();
      expect(screen.getByText('permission_denied')).toBeInTheDocument();
    });

    it('should not show advanced troubleshooting when disabled', async () => {
      const mockError: PermissionError = {
        type: 'permission_denied',
        message: 'Camera permission denied by user',
        userMessage: 'Camera access is required to record your workouts.',
        recoveryActions: ['Click the camera icon'],
        canRetry: true,
      };

      const mockStatus: PermissionStatus = {
        state: 'denied',
        error: mockError,
        lastChecked: Date.now(),
        browserSupport: {
          permissions: true,
          mediaDevices: true,
          getUserMedia: true,
        },
      };

      mockPermissionService.checkPermissionStatus.mockResolvedValue(mockStatus);
      mockPermissionService.onPermissionChange.mockImplementation((callback: PermissionChangeCallback) => {
        setTimeout(() => callback(mockStatus), 0);
        return () => {
          /* cleanup */
        };
      });

      render(<CameraPermissionPrompt {...defaultProps} showAdvanced={false} />);

      await waitFor(() => {
        expect(screen.getByText('Permission Denied')).toBeInTheDocument();
      });

      expect(screen.queryByText('Advanced Troubleshooting')).not.toBeInTheDocument();
    });
  });

  describe('Close Functionality', () => {
    it('should call onClose when close button is clicked', async () => {
      render(<CameraPermissionPrompt {...defaultProps} />);

      const closeButton = screen.getByRole('button', { name: /close/i });
      await user.click(closeButton);

      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', async () => {
      render(<CameraPermissionPrompt {...defaultProps} />);
      await screen.findByRole('heading', { level: 2 });

      // Check for proper button roles
      expect(screen.getByRole('button', { name: /allow camera access/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();

      // Check for proper heading structure
      expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
    });

    it('should be keyboard navigable', async () => {
      render(<CameraPermissionPrompt {...defaultProps} />);

      // Tab through interactive elements
      await user.tab();
      expect(screen.getByRole('button', { name: /allow camera access/i })).toHaveFocus();

      await user.tab();
      expect(screen.getByRole('button', { name: /close/i })).toHaveFocus();
    });
  });

  describe('Custom Styling', () => {
    it('should apply custom className', async () => {
      render(<CameraPermissionPrompt {...defaultProps} className="custom-class" />);
      await screen.findByRole('heading', { level: 2 });

      const modal = screen.getByText('Camera Access Required').closest('div')?.parentElement?.parentElement;
      expect(modal).toHaveClass('custom-class');
    });
  });
});
