import { CircleCheck, CircleX, OctagonAlert, TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { AssessmentStatus } from '@/components/badges';
import { ErrorState, LoadingRows } from '@/components/states';
import { Badge } from '@/components/ui/misc';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/overlays';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useLocale, useText } from '@/i18n';
import { useAssessment } from '@/lib/queries';
import { formatDateTime } from '@/lib/utils';

function seconds(ms: number) {
  return `${Math.round(ms / 1000)} s`;
}

/** One attempt: score split, critical errors, every step and every quiz answer. */
export function AssessmentDialog({
  resultId,
  onClose,
}: {
  resultId: string | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const text = useText();
  const locale = useLocale();
  const detail = useAssessment(resultId);
  const data = detail.data;

  return (
    <Dialog open={resultId != null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent side="right">
        <DialogHeader>
          <DialogTitle>{t('assessments.detail')}</DialogTitle>
          {data != null && (
            <DialogDescription>
              {text(data.moduleTitle)} · {formatDateTime(data.completedAt, locale)}
            </DialogDescription>
          )}
        </DialogHeader>
        {detail.isError && <ErrorState error={detail.error} />}
        {data == null && !detail.isError && <LoadingRows rows={8} />}
        {data != null && (
          <div className="flex flex-col gap-5 text-sm">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <Link
                to={`/workers/${data.workerId}`}
                className="font-semibold hover:underline"
                onClick={onClose}
              >
                {data.workerName} · {data.workerId}
              </Link>
              <span className="text-muted-foreground">{data.siteName}</span>
              <AssessmentStatus row={data} />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                [t('table.score'), `${data.score}%`],
                [
                  t('table.practical'),
                  data.practicalPercent != null ? `${data.practicalPercent}%` : '—',
                ],
                [t('table.quiz'), data.quizPercent != null ? `${data.quizPercent}%` : '—'],
                [t('table.attempt'), data.attemptNumber || t(`attemptType.${data.attemptType}`)],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-lg border px-3 py-2">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-lg font-semibold tabular-nums">{value}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{t(`attemptType.${data.attemptType}`)}</Badge>
              <Badge variant="outline">{t(`mode.${data.mode}`)}</Badge>
              {data.language != null && (
                <Badge variant="outline">{t(`languages.${data.language}`)}</Badge>
              )}
              {data.certificateId != null && <Badge variant="success">{data.certificateId}</Badge>}
            </div>

            {data.steps.some((step) => step.critical) && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="mb-1 flex items-center gap-2 font-semibold text-red-800">
                  <OctagonAlert className="size-4" /> {t('assessments.criticalErrors')}
                </p>
                <ul className="list-disc pl-6 text-red-800">
                  {data.steps.flatMap((step) =>
                    step.criticalErrors.map((error, index) => (
                      <li key={`${step.stepId}-${index}`}>{text(error)}</li>
                    )),
                  )}
                </ul>
              </div>
            )}

            <div>
              <h3 className="mb-2 font-semibold">{t('assessments.steps')}</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('table.step')}</TableHead>
                    <TableHead className="text-right">{t('table.mistakes')}</TableHead>
                    <TableHead className="text-right">{t('table.points')}</TableHead>
                    <TableHead className="text-right">{t('table.time')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.steps.map((step) => (
                    <TableRow
                      key={step.stepId}
                      className={step.skipped ? 'text-muted-foreground' : ''}
                    >
                      <TableCell className="whitespace-normal">
                        <span className="flex items-center gap-2">
                          {step.skipped ? (
                            <span className="size-4" />
                          ) : step.critical ? (
                            <OctagonAlert className="size-4 shrink-0 text-red-600" />
                          ) : step.mistakes > 0 || step.points < step.maxPoints ? (
                            <TriangleAlert className="size-4 shrink-0 text-amber-600" />
                          ) : (
                            <CircleCheck className="size-4 shrink-0 text-green-600" />
                          )}
                          {text(step.title)}
                          {step.skipped && (
                            <span className="text-xs">({t('assessments.skipped')})</span>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {step.skipped ? '—' : step.mistakes}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {step.skipped ? '—' : `${step.points}/${step.maxPoints}`}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {step.skipped ? '—' : seconds(step.timeTakenMs)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {data.quiz.length > 0 && (
              <div>
                <h3 className="mb-2 font-semibold">{t('assessments.quiz')}</h3>
                <ul className="flex flex-col gap-2">
                  {data.quiz.map((answer) => (
                    <li key={answer.questionId} className="flex items-start gap-2">
                      {answer.correct ? (
                        <CircleCheck className="mt-0.5 size-4 shrink-0 text-green-600" />
                      ) : (
                        <CircleX className="mt-0.5 size-4 shrink-0 text-red-600" />
                      )}
                      <span>{text(answer.prompt)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
