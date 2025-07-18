import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PoseLandmarkOverlay } from '../PoseLandmarkOverlay';
import { createDefaultLandmarks, LANDMARK_INDICES } from './mocks/analysis-screen.mocks';

describe('PoseLandmarkOverlay', () => {
  const defaultProps = {
    landmarks: createDefaultLandmarks(),
    width: 640,
    height: 480,
    isValidPose: true,
    confidence: 0.9,
  };

  describe('Rendering Conditions', () => {
    it('should not render when landmarks are not provided', () => {
      const { container } = render(<PoseLandmarkOverlay {...defaultProps} landmarks={undefined} />);
      expect(container.querySelector('svg')).not.toBeInTheDocument();
    });

    it('should not render when landmarks array is empty', () => {
      const { container } = render(<PoseLandmarkOverlay {...defaultProps} landmarks={[]} />);
      expect(container.querySelector('svg')).not.toBeInTheDocument();
    });

    it('should render when isValidPose is false (landmarks still visible)', () => {
      const { container } = render(<PoseLandmarkOverlay {...defaultProps} isValidPose={false} />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('should render SVG when all conditions are met', () => {
      const { container } = render(<PoseLandmarkOverlay {...defaultProps} />);
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveAttribute('width', '640');
      expect(svg).toHaveAttribute('height', '480');
    });
  });

  describe('SVG Structure', () => {
    it('should not apply mirror transformation (video is not mirrored)', () => {
      const { container } = render(<PoseLandmarkOverlay {...defaultProps} />);
      const svg = container.querySelector('svg');
      expect(svg).not.toHaveStyle({ transform: 'scaleX(-1)' });
    });

    it('should render confidence indicator', () => {
      render(<PoseLandmarkOverlay {...defaultProps} />);
      // Look for the confidence text
      expect(screen.getByText('90%')).toBeInTheDocument();
    });

    it('should use correct confidence color for high confidence', () => {
      const { container } = render(<PoseLandmarkOverlay {...defaultProps} confidence={0.9} />);
      const confidenceText = screen.getByText('90%');
      expect(confidenceText).toHaveAttribute('fill', 'white'); // white text for readability

      // Check that the progress bar has the correct color
      const progressBar = container.querySelector('rect[fill="#22c55e"]');
      expect(progressBar).toBeInTheDocument(); // green progress bar
    });

    it('should use correct confidence color for medium confidence', () => {
      const { container } = render(<PoseLandmarkOverlay {...defaultProps} confidence={0.6} />);
      const confidenceText = screen.getByText('60%');
      expect(confidenceText).toHaveAttribute('fill', 'white'); // white text for readability

      // Check that the progress bar has the correct color
      const progressBar = container.querySelector('rect[fill="#eab308"]');
      expect(progressBar).toBeInTheDocument(); // yellow progress bar
    });

    it('should use correct confidence color for low confidence', () => {
      const { container } = render(<PoseLandmarkOverlay {...defaultProps} confidence={0.4} />);
      const confidenceText = screen.getByText('40%');
      expect(confidenceText).toHaveAttribute('fill', 'white'); // white text for readability

      // Check that the progress bar has the correct color
      const progressBar = container.querySelector('rect[fill="#ef4444"]');
      expect(progressBar).toBeInTheDocument(); // red progress bar
    });
  });

  describe('Landmarks Rendering', () => {
    it('should render circles for all squat landmarks', () => {
      const { container } = render(<PoseLandmarkOverlay {...defaultProps} />);
      // 8 main landmarks + 4 outer rings for critical landmarks (hips, knees) + 1 debug indicator
      const circles = container.querySelectorAll('circle');
      expect(circles.length).toBe(13);
    });

    it('should highlight critical landmarks (hips and knees)', () => {
      const { container } = render(<PoseLandmarkOverlay {...defaultProps} />);
      // Critical landmarks should have larger radius (r="8")
      const criticalCircles = container.querySelectorAll('circle[r="8"]');
      expect(criticalCircles.length).toBe(4); // 2 hips + 2 knees
    });

    it('should render normal landmarks with smaller radius', () => {
      const { container } = render(<PoseLandmarkOverlay {...defaultProps} />);
      // Normal landmarks should have smaller radius (r="6")
      const normalCircles = container.querySelectorAll('circle[r="6"]');
      expect(normalCircles.length).toBe(4); // 2 shoulders + 2 ankles
    });

    it('should position landmarks correctly based on normalized coordinates', () => {
      const { container } = render(<PoseLandmarkOverlay {...defaultProps} />);
      const circles = container.querySelectorAll('circle');

      // Check that circles have cx and cy attributes with proper scaling
      circles.forEach((circle) => {
        const cx = circle.getAttribute('cx');
        const cy = circle.getAttribute('cy');
        expect(cx).toBeTruthy();
        expect(cy).toBeTruthy();
        // Values should be between 0 and viewport dimensions
        expect(Number(cx)).toBeGreaterThanOrEqual(0);
        expect(Number(cx)).toBeLessThanOrEqual(640);
        expect(Number(cy)).toBeGreaterThanOrEqual(0);
        expect(Number(cy)).toBeLessThanOrEqual(480);
      });
    });
  });

  describe('Connection Lines', () => {
    it('should render connection lines between body parts', () => {
      const { container } = render(<PoseLandmarkOverlay {...defaultProps} />);
      const lines = container.querySelectorAll('line');
      // Should have lines for: left side, right side, shoulders, hips
      expect(lines.length).toBeGreaterThan(0);
    });

    it('should render shoulder connection line', () => {
      const { container } = render(<PoseLandmarkOverlay {...defaultProps} />);
      const lines = container.querySelectorAll('line');

      // Find shoulder connection line
      const shoulderLine = Array.from(lines).find((line) => {
        const x1 = Number(line.getAttribute('x1'));
        const x2 = Number(line.getAttribute('x2'));
        // Shoulder line should be roughly horizontal
        return Math.abs(x1 - x2) > 50; // Significant horizontal distance
      });

      expect(shoulderLine).toBeTruthy();
    });
  });

  describe('Coordinate System and Scaling', () => {
    it('should correctly transform normalized coordinates to pixel coordinates', () => {
      // Test specific coordinate transformation
      const landmarks = createDefaultLandmarks();
      // Set known normalized coordinates
      landmarks[LANDMARK_INDICES.LEFT_SHOULDER].x = 0.25; // 25% from left
      landmarks[LANDMARK_INDICES.LEFT_SHOULDER].y = 0.5; // 50% from top

      const { container } = render(
        <PoseLandmarkOverlay {...defaultProps} landmarks={landmarks} width={800} height={600} />,
      );

      const circles = container.querySelectorAll('circle');
      const leftShoulderCircle = Array.from(circles).find((circle) => {
        const cx = Number(circle.getAttribute('cx'));
        const cy = Number(circle.getAttribute('cy'));
        // Should be at 25% of 800 = 200, 50% of 600 = 300
        return Math.abs(cx - 200) < 1 && Math.abs(cy - 300) < 1;
      });

      expect(leftShoulderCircle).toBeTruthy();
    });

    it('should handle extreme normalized coordinates (edge cases)', () => {
      const landmarks = createDefaultLandmarks();
      // Test boundary conditions
      landmarks[LANDMARK_INDICES.LEFT_SHOULDER].x = 0.0; // Far left
      landmarks[LANDMARK_INDICES.RIGHT_SHOULDER].x = 1.0; // Far right
      landmarks[LANDMARK_INDICES.LEFT_HIP].y = 0.0; // Top
      landmarks[LANDMARK_INDICES.RIGHT_HIP].y = 1.0; // Bottom

      const { container } = render(
        <PoseLandmarkOverlay {...defaultProps} landmarks={landmarks} width={640} height={480} />,
      );

      const circles = container.querySelectorAll('circle');
      circles.forEach((circle) => {
        const cx = Number(circle.getAttribute('cx'));
        const cy = Number(circle.getAttribute('cy'));
        // Should be within bounds
        expect(cx).toBeGreaterThanOrEqual(0);
        expect(cx).toBeLessThanOrEqual(640);
        expect(cy).toBeGreaterThanOrEqual(0);
        expect(cy).toBeLessThanOrEqual(480);
      });
    });

    it('should maintain aspect ratio when dimensions change', () => {
      const landmarks = createDefaultLandmarks();
      // Set landmarks at center
      landmarks[LANDMARK_INDICES.LEFT_SHOULDER].x = 0.5;
      landmarks[LANDMARK_INDICES.LEFT_SHOULDER].y = 0.5;

      const { container: container1 } = render(
        <PoseLandmarkOverlay {...defaultProps} landmarks={landmarks} width={400} height={300} />,
      );
      const { container: container2 } = render(
        <PoseLandmarkOverlay {...defaultProps} landmarks={landmarks} width={800} height={600} />,
      );

      const circle1 = container1.querySelector('circle');
      const circle2 = container2.querySelector('circle');

      // Both should be at center relative to their dimensions
      expect(circle1?.getAttribute('cx')).toBe('200'); // 50% of 400
      expect(circle1?.getAttribute('cy')).toBe('150'); // 50% of 300
      expect(circle2?.getAttribute('cx')).toBe('400'); // 50% of 800
      expect(circle2?.getAttribute('cy')).toBe('300'); // 50% of 600
    });
  });

  describe('Edge Cases', () => {
    it('should handle landmarks with low visibility', () => {
      const landmarks = createDefaultLandmarks();
      // Set some landmarks to low visibility
      landmarks[LANDMARK_INDICES.LEFT_HIP].visibility = 0.3;
      landmarks[LANDMARK_INDICES.RIGHT_HIP].visibility = 0.4;

      const { container } = render(<PoseLandmarkOverlay {...defaultProps} landmarks={landmarks} />);

      // Should still render but with reduced opacity
      const circles = container.querySelectorAll('circle');
      expect(circles.length).toBe(13); // 8 landmarks + 4 outer rings + 1 debug indicator

      // Check that low visibility landmarks have reduced opacity
      const hipCircles = Array.from(circles).filter((circle) => {
        const r = circle.getAttribute('r');
        return r === '8'; // Hip landmarks have larger radius
      });

      hipCircles.forEach((circle) => {
        const opacity = circle.getAttribute('opacity');
        expect(Number(opacity)).toBeLessThan(1);
      });
    });

    it('should handle different viewport dimensions', () => {
      const { container } = render(<PoseLandmarkOverlay {...defaultProps} width={1920} height={1080} />);

      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('width', '1920');
      expect(svg).toHaveAttribute('height', '1080');

      // Check that landmarks scale properly
      const circles = container.querySelectorAll('circle');
      circles.forEach((circle) => {
        const cx = Number(circle.getAttribute('cx'));
        const cy = Number(circle.getAttribute('cy'));
        expect(cx).toBeLessThanOrEqual(1920);
        expect(cy).toBeLessThanOrEqual(1080);
      });
    });

    it('should handle zero dimensions gracefully', () => {
      const { container } = render(<PoseLandmarkOverlay {...defaultProps} width={0} height={0} />);

      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('width', '0');
      expect(svg).toHaveAttribute('height', '0');
    });
  });
});
