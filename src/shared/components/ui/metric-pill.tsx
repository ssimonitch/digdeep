import { cn } from '@/shared/utils/cn';

interface MetricPillProps {
  icon: string;
  text: string;
  variant: 'success' | 'warning' | 'error';
  className?: string;
}

/**
 * MetricPill displays a workout metric with an icon and colored variant
 * Used in workout cards to show form analysis results (depth, balance, etc.)
 *
 * @param icon - Emoji or icon character to display
 * @param text - Metric label text
 * @param variant - Visual style indicating metric status
 * @param className - Additional CSS classes
 */
function MetricPill({ icon, text, variant, className }: MetricPillProps) {
  const variantStyles = {
    success:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-green-500/20 dark:text-green-400 dark:border-green-500/30',
    warning:
      'bg-amber-50 text-amber-700 border-amber-200 dark:bg-yellow-500/20 dark:text-yellow-400 dark:border-yellow-500/30',
    error: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30',
  };

  return (
    <li
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium',
        variantStyles[variant],
        className,
      )}
      aria-label={`${text}: ${variant}`}
    >
      <span aria-hidden="true">{icon}</span>
      {text}
    </li>
  );
}

export { MetricPill, type MetricPillProps };
