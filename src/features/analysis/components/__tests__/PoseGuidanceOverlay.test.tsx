import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PoseGuidanceOverlay } from '../PoseGuidanceOverlay';

describe('PoseGuidanceOverlay', () => {
  describe('General Guidance', () => {
    it('should show general guidance when no specific issues detected', () => {
      render(
        <PoseGuidanceOverlay
          detectionState="invalid"
          confidence={0.65}
          visibilityFlags={{
            shoulders: true,
            hips: true,
            knees: true,
            ankles: true,
          }}
        />,
      );

      expect(screen.getByText('Position yourself in frame')).toBeInTheDocument();
      expect(screen.getByText('Make sure your full body is visible')).toBeInTheDocument();
    });

    it('should show detecting state guidance', () => {
      render(
        <PoseGuidanceOverlay
          detectionState="detecting"
          confidence={0.65}
          visibilityFlags={{
            shoulders: true,
            hips: true,
            knees: true,
            ankles: true,
          }}
        />,
      );

      expect(screen.getByText('Detecting pose...')).toBeInTheDocument();
      expect(screen.getByText('Hold your position')).toBeInTheDocument();
    });

    it('should show valid state guidance', () => {
      render(
        <PoseGuidanceOverlay
          detectionState="valid"
          confidence={0.85}
          visibilityFlags={{
            shoulders: true,
            hips: true,
            knees: true,
            ankles: true,
          }}
        />,
      );

      expect(screen.getByText('Pose Detected')).toBeInTheDocument();
      expect(screen.getByText('Ready to analyze')).toBeInTheDocument();
    });
  });

  describe('Body Part Prioritization', () => {
    it('should prioritize most critical missing body parts', () => {
      // Hips are most critical for squat analysis
      render(
        <PoseGuidanceOverlay
          detectionState="invalid"
          confidence={0.45}
          visibilityFlags={{
            shoulders: true,
            hips: false, // Not visible
            knees: true,
            ankles: true,
          }}
        />,
      );

      expect(screen.getByText('Position yourself in frame')).toBeInTheDocument();
      expect(screen.getByText('Hips not visible - step back from camera')).toBeInTheDocument();
    });

    it('should show knees guidance when hips are visible', () => {
      render(
        <PoseGuidanceOverlay
          detectionState="invalid"
          confidence={0.45}
          visibilityFlags={{
            shoulders: true,
            hips: true,
            knees: false, // Not visible
            ankles: true,
          }}
        />,
      );

      expect(screen.getByText('Knees not visible - ensure full body is in frame')).toBeInTheDocument();
    });

    it('should show multiple issues when several landmarks have low visibility', () => {
      render(
        <PoseGuidanceOverlay
          detectionState="invalid"
          confidence={0.35}
          visibilityFlags={{
            shoulders: true,
            hips: false, // Not visible
            knees: false, // Not visible
            ankles: false, // Not visible
          }}
        />,
      );

      // Should prioritize hips first
      expect(screen.getByText('Hips not visible - step back from camera')).toBeInTheDocument();
      // May also show general guidance
      expect(screen.getByText('Position yourself in frame')).toBeInTheDocument();
    });
  });

  describe('Guidance Updates', () => {
    it('should update guidance based on landmark visibility', () => {
      const { rerender } = render(
        <PoseGuidanceOverlay
          detectionState="invalid"
          confidence={0.45}
          visibilityFlags={{
            shoulders: true,
            hips: false, // Not visible
            knees: true,
            ankles: true,
          }}
        />,
      );

      expect(screen.getByText('Hips not visible - step back from camera')).toBeInTheDocument();

      // Update visibility
      rerender(
        <PoseGuidanceOverlay
          detectionState="invalid"
          confidence={0.45}
          visibilityFlags={{
            shoulders: true,
            hips: true, // Now visible
            knees: false, // Now not visible
            ankles: true,
          }}
        />,
      );

      expect(screen.queryByText('Hips not visible - step back from camera')).not.toBeInTheDocument();
      expect(screen.getByText('Knees not visible - ensure full body is in frame')).toBeInTheDocument();
    });

    it('should clear specific guidance when all landmarks become visible', () => {
      const { rerender } = render(
        <PoseGuidanceOverlay
          detectionState="invalid"
          confidence={0.45}
          visibilityFlags={{
            shoulders: true,
            hips: false, // Not visible
            knees: true,
            ankles: true,
          }}
        />,
      );

      expect(screen.getByText('Hips not visible - step back from camera')).toBeInTheDocument();

      // All landmarks now visible
      rerender(
        <PoseGuidanceOverlay
          detectionState="valid"
          confidence={0.85}
          visibilityFlags={{
            shoulders: true,
            hips: true,
            knees: true,
            ankles: true,
          }}
        />,
      );

      expect(screen.queryByText('Hips not visible - step back from camera')).not.toBeInTheDocument();
      expect(screen.getByText('Pose Detected')).toBeInTheDocument();
    });
  });

  describe('Confidence Display', () => {
    it('should show confidence percentage', () => {
      render(
        <PoseGuidanceOverlay
          detectionState="invalid"
          confidence={0.45}
          visibilityFlags={{
            shoulders: true,
            hips: true,
            knees: true,
            ankles: true,
          }}
        />,
      );

      expect(screen.getByText('45%')).toBeInTheDocument();
      expect(screen.getByText('Confidence:')).toBeInTheDocument();
    });

    it('should update confidence percentage', () => {
      const { rerender } = render(
        <PoseGuidanceOverlay
          detectionState="detecting"
          confidence={0.65}
          visibilityFlags={{
            shoulders: true,
            hips: true,
            knees: true,
            ankles: true,
          }}
        />,
      );

      expect(screen.getByText('65%')).toBeInTheDocument();

      rerender(
        <PoseGuidanceOverlay
          detectionState="valid"
          confidence={0.92}
          visibilityFlags={{
            shoulders: true,
            hips: true,
            knees: true,
            ankles: true,
          }}
        />,
      );

      expect(screen.getByText('92%')).toBeInTheDocument();
    });

    it('should show confidence progress bar', () => {
      const { container } = render(
        <PoseGuidanceOverlay
          detectionState="detecting"
          confidence={0.75}
          visibilityFlags={{
            shoulders: true,
            hips: true,
            knees: true,
            ankles: true,
          }}
        />,
      );

      const progressBar = container.querySelector('[role="progressbar"]');
      expect(progressBar).toBeInTheDocument();
      expect(progressBar).toHaveAttribute('aria-valuenow', '75');
      expect(progressBar).toHaveAttribute('aria-valuemin', '0');
      expect(progressBar).toHaveAttribute('aria-valuemax', '100');
    });
  });

  describe('Styling', () => {
    it('should use appropriate styling for each state', () => {
      const { container, rerender } = render(
        <PoseGuidanceOverlay
          detectionState="invalid"
          confidence={0.45}
          visibilityFlags={{
            shoulders: true,
            hips: true,
            knees: true,
            ankles: true,
          }}
        />,
      );

      // Invalid state - should have red/error styling
      let overlay = container.firstChild as HTMLElement;
      expect(overlay).toHaveClass('bg-red-900/90');

      // Detecting state - should have yellow/warning styling
      rerender(
        <PoseGuidanceOverlay
          detectionState="detecting"
          confidence={0.65}
          visibilityFlags={{
            shoulders: true,
            hips: true,
            knees: true,
            ankles: true,
          }}
        />,
      );

      overlay = container.firstChild as HTMLElement;
      expect(overlay).toHaveClass('bg-yellow-900/90');

      // Valid state - should have green/success styling
      rerender(
        <PoseGuidanceOverlay
          detectionState="valid"
          confidence={0.85}
          visibilityFlags={{
            shoulders: true,
            hips: true,
            knees: true,
            ankles: true,
          }}
        />,
      );

      overlay = container.firstChild as HTMLElement;
      expect(overlay).toHaveClass('bg-green-900/90');
    });

    it('should have non-intrusive positioning', () => {
      const { container } = render(
        <PoseGuidanceOverlay
          detectionState="invalid"
          confidence={0.45}
          visibilityFlags={{
            shoulders: true,
            hips: false,
            knees: true,
            ankles: true,
          }}
        />,
      );

      const overlay = container.firstChild as HTMLElement;
      // Should be positioned at top of screen
      expect(overlay).toHaveClass('top-4');
      // Should be centered horizontally
      expect(overlay).toHaveClass('left-1/2');
      expect(overlay).toHaveClass('-translate-x-1/2');
      // Should have proper z-index to appear above video but below controls
      expect(overlay).toHaveClass('z-10');
    });

    it('should have smooth transitions', () => {
      const { container } = render(
        <PoseGuidanceOverlay
          detectionState="invalid"
          confidence={0.45}
          visibilityFlags={{
            shoulders: true,
            hips: true,
            knees: true,
            ankles: true,
          }}
        />,
      );

      const overlay = container.firstChild as HTMLElement;
      expect(overlay).toHaveClass('transition-all');
      expect(overlay).toHaveClass('duration-300');
    });

    it('should have appropriate text styling for visibility', () => {
      render(
        <PoseGuidanceOverlay
          detectionState="invalid"
          confidence={0.45}
          visibilityFlags={{
            shoulders: true,
            hips: false,
            knees: true,
            ankles: true,
          }}
        />,
      );

      const heading = screen.getByText('Position yourself in frame');
      expect(heading).toHaveClass('text-white');
      expect(heading).toHaveClass('font-bold');

      const guidance = screen.getByText('Hips not visible - step back from camera');
      expect(guidance).toHaveClass('text-gray-200');
    });
  });

  describe('Edge Cases', () => {
    it('should handle all landmarks with low visibility', () => {
      render(
        <PoseGuidanceOverlay
          detectionState="invalid"
          confidence={0.25}
          visibilityFlags={{
            shoulders: false,
            hips: false,
            knees: false,
            ankles: false,
          }}
        />,
      );

      expect(screen.getByText('Position yourself in frame')).toBeInTheDocument();
      expect(screen.getByText('Step back and ensure full body is visible')).toBeInTheDocument();
    });

    it('should handle confidence of 0', () => {
      render(
        <PoseGuidanceOverlay
          detectionState="invalid"
          confidence={0}
          visibilityFlags={{
            shoulders: false,
            hips: false,
            knees: false,
            ankles: false,
          }}
        />,
      );

      expect(screen.getByText('0%')).toBeInTheDocument();
    });

    it('should handle confidence of 1', () => {
      render(
        <PoseGuidanceOverlay
          detectionState="valid"
          confidence={1}
          visibilityFlags={{
            shoulders: true,
            hips: true,
            knees: true,
            ankles: true,
          }}
        />,
      );

      expect(screen.getByText('100%')).toBeInTheDocument();
    });
  });
});
