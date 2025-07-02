import { Card } from '@/shared/components/ui/card';
import { cn } from '@/shared/utils/cn';

interface StatsCardProps {
  icon: string;
  value: string;
  label: string;
  className?: string;
  iconLabel?: string;
}

export function StatsCard({ icon, value, label, className, iconLabel }: StatsCardProps) {
  // Extract numeric value if possible for data element
  const numericValue = value.replace(/[^\d.-]/g, '') || value;

  return (
    <Card
      className={cn(
        'flex flex-col items-center justify-center p-4 min-h-[100px] border-border/50',
        'bg-gradient-to-br from-card to-card/80 shadow-sm hover:shadow-md transition-shadow',
        className,
      )}>
      <dl className="flex flex-col items-center justify-center text-center">
        <dd className="text-2xl font-semibold text-primary flex items-center gap-1 order-1">
          <span className="text-lg opacity-80" aria-label={iconLabel} role="img">
            {icon}
          </span>
          <data value={numericValue}>{value}</data>
        </dd>
        <dt className="text-sm text-muted-foreground font-medium order-2">{label}</dt>
      </dl>
    </Card>
  );
}
