import { BarChart3, Edit, MoreVertical, Share, Trash2 } from 'lucide-react';

import { Button } from '@/shared/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { cn } from '@/shared/utils/cn';

interface MetricPillProps {
  icon: string;
  text: string;
  variant: 'success' | 'warning' | 'error';
}

function MetricPill({ icon, text, variant }: MetricPillProps) {
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
        'inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border',
        variantStyles[variant],
      )}
      aria-label={`${text}: ${variant}`}>
      <span aria-hidden="true">{icon}</span>
      {text}
    </li>
  );
}

interface WorkoutCardProps {
  title: string;
  subtitle: string;
  rating: number;
  metrics: {
    icon: string;
    text: string;
    variant: 'success' | 'warning' | 'error';
  }[];
  onEdit?: () => void;
  onViewStats?: () => void;
  onShare?: () => void;
  onDelete?: () => void;
  className?: string;
}

export function WorkoutCard({
  title,
  subtitle,
  rating,
  metrics,
  onEdit,
  onViewStats,
  onShare,
  onDelete,
  className,
}: WorkoutCardProps) {
  const renderStars = (rating: number) => {
    return (
      <div role="img" aria-label={`${rating} out of 5 stars`} className="flex text-lg">
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i} aria-hidden="true" className={i < rating ? 'text-amber-400' : 'text-muted-foreground/40'}>
            ★
          </span>
        ))}
      </div>
    );
  };

  return (
    <Card
      className={cn(
        'hover:bg-card/50 transition-all duration-200 border-border/50',
        'shadow-sm hover:shadow-md hover:border-border/80',
        className,
      )}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg">{title}</CardTitle>
            <div className="text-sm text-muted-foreground">{subtitle}</div>
          </div>
          <div className="flex items-center gap-2">
            {renderStars(rating)}
            <CardAction>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {onEdit && (
                    <DropdownMenuItem onClick={onEdit}>
                      <Edit className="h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                  )}
                  {onViewStats && (
                    <DropdownMenuItem onClick={onViewStats}>
                      <BarChart3 className="h-4 w-4" />
                      View Stats
                    </DropdownMenuItem>
                  )}
                  {onShare && (
                    <DropdownMenuItem onClick={onShare}>
                      <Share className="h-4 w-4" />
                      Share
                    </DropdownMenuItem>
                  )}
                  {onDelete && (
                    <DropdownMenuItem onClick={onDelete} variant="destructive">
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </CardAction>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <ul className="flex flex-wrap gap-2 list-none" role="list">
          {metrics.map((metric) => (
            <MetricPill key={metric.text} icon={metric.icon} text={metric.text} variant={metric.variant} />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
