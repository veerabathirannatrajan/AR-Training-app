import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/misc';

export function KpiCard({
  label,
  value,
  icon: Icon,
  aside,
  detail,
  loading,
}: {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  /** Small text right of the number (e.g. "66.7% of registered"). */
  aside?: ReactNode;
  detail?: ReactNode;
  loading?: boolean;
}) {
  return (
    <Card className="gap-2 px-5 py-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-zinc-700">{label}</p>
        <Icon className="size-5 shrink-0 text-zinc-500" strokeWidth={1.7} />
      </div>
      {loading ? (
        <Skeleton className="h-9 w-24" />
      ) : (
        <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
          <p className="text-[32px] leading-none font-semibold tracking-tight tabular-nums">
            {value}
          </p>
          {aside != null && <p className="pb-1 text-xs text-muted-foreground">{aside}</p>}
        </div>
      )}
      {detail != null && <p className="text-xs text-muted-foreground">{detail}</p>}
    </Card>
  );
}
