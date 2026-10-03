import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

export function Pagination({
  page,
  pageSize,
  total,
  shown,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  shown: number;
  onPage: (page: number) => void;
}) {
  const { t } = useTranslation();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex items-center justify-between gap-2 pt-3 text-xs text-muted-foreground">
      <span>{t('common.showing', { count: shown, total })}</span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          {t('actions.previous')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
        >
          {t('actions.next')}
        </Button>
      </div>
    </div>
  );
}
