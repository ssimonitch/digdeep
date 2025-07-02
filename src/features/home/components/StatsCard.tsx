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
        'border-border/50 flex min-h-[100px] flex-col items-center justify-center p-4',
        'from-card to-card/80 bg-gradient-to-br shadow-sm transition-shadow hover:shadow-md',
        className,
      )}
    >
      <dl className="flex flex-col items-center justify-center text-center">
        <dd className="text-primary order-1 flex items-center gap-1 text-2xl font-semibold">
          <span className="text-lg opacity-80" aria-label={iconLabel} role="img">
            {icon}
          </span>
          <data value={numericValue}>{value}</data>
        </dd>
        <dt className="text-muted-foreground order-2 text-sm font-medium">{label}</dt>
      </dl>
    </Card>
  );
}
