import { AlertTriangle, Inbox, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/misc';
import { apiBase, NetworkError } from '@/lib/api';
import { cn } from '@/lib/utils';

export function ErrorState({
  error,
  onRetry,
  className,
}: {
  error: unknown;
  onRetry?: () => void;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <div
      className={cn(
        'flex flex-col items-start gap-3 rounded-lg border border-dashed p-4 text-sm',
        className,
      )}
      role="alert"
    >
      <p className="flex items-start gap-2 text-red-700">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        {error instanceof NetworkError
          ? t('common.apiDown', { url: apiBase() })
          : `${t('common.error')} ${error instanceof Error ? error.message : ''}`}
      </p>
      {onRetry != null && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw /> {t('actions.retry')}
        </Button>
      )}
    </div>
  );
}

export function EmptyState({ text, className }: { text?: string; className?: string }) {
  const { t } = useTranslation();
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 py-8 text-center text-sm text-muted-foreground',
        className,
      )}
    >
      <Inbox className="size-6 opacity-60" />
      {text ?? t('common.empty')}
    </div>
  );
}

export function LoadingRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-8 w-full" />
      ))}
    </div>
  );
}
