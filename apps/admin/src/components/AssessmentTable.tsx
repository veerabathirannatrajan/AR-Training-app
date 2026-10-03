import type { AssessmentRow } from '@ar-training/shared';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { AssessmentStatus } from '@/components/badges';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useText } from '@/i18n';
import { formatDate } from '@/lib/utils';

/** Recent assessments as in the dashboard: worker, site, module, attempts, score, language… */
export function AssessmentTable({
  rows,
  showDate = false,
  onOpen,
}: {
  rows: AssessmentRow[];
  showDate?: boolean;
  onOpen?: (row: AssessmentRow) => void;
}) {
  const { t } = useTranslation();
  const text = useText();
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {showDate && <TableHead>{t('table.date')}</TableHead>}
          <TableHead>{t('table.worker')}</TableHead>
          <TableHead>{t('table.site')}</TableHead>
          <TableHead>{t('table.module')}</TableHead>
          <TableHead className="text-right">{t('table.attempts')}</TableHead>
          <TableHead className="text-right">{t('table.score')}</TableHead>
          <TableHead>{t('table.language')}</TableHead>
          <TableHead>{t('table.certificate')}</TableHead>
          <TableHead>{t('table.status')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow
            key={row.resultId}
            data-clickable={onOpen != null}
            onClick={onOpen != null ? () => onOpen(row) : undefined}
          >
            {showDate && (
              <TableCell className="tabular-nums">{formatDate(row.completedAt)}</TableCell>
            )}
            <TableCell>
              <Link
                to={`/workers/${row.workerId}`}
                className="font-medium hover:underline"
                onClick={(event) => event.stopPropagation()}
              >
                {row.workerName}
              </Link>
            </TableCell>
            <TableCell>{row.district}</TableCell>
            <TableCell>
              {text(row.moduleTitle).replace(' Response', '').replace(' & Confined Space', '')}
              {row.attemptType !== 'assessment' && (
                <span className="ml-1 text-xs text-muted-foreground">
                  · {t(`attemptType.${row.attemptType}`)}
                </span>
              )}
            </TableCell>
            <TableCell className="text-right tabular-nums">{row.attemptNumber || '—'}</TableCell>
            <TableCell className="text-right font-medium tabular-nums">{row.score}%</TableCell>
            <TableCell>{row.language != null ? t(`languages.${row.language}`) : '—'}</TableCell>
            <TableCell>
              {row.certificateId != null ? (
                <Link
                  to={`/verify?id=${row.certificateId}`}
                  className="text-blue-700 underline underline-offset-2"
                  onClick={(event) => event.stopPropagation()}
                >
                  {row.certificateId}
                </Link>
              ) : (
                '—'
              )}
            </TableCell>
            <TableCell>
              <AssessmentStatus row={row} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
