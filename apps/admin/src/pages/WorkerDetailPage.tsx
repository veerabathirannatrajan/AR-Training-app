import { certificateState } from '@ar-training/shared';
import { ArrowLeft, KeyRound, Lock, Pencil, Power } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { AssessmentDialog } from '@/components/AssessmentDialog';
import { AssessmentStatus, CertificateStateDot, CertificationDot } from '@/components/badges';
import { ExportButton } from '@/components/ExportButtons';
import { LanguageToggle, UserMenu } from '@/components/layout/PageHeader';
import { EmptyState, ErrorState, LoadingRows } from '@/components/states';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge, Progress } from '@/components/ui/misc';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { WorkerForm } from '@/components/WorkerForm';
import { useLocale, useText } from '@/i18n';
import { useAppSettings, useSites, useUpdateWorker, useWorker } from '@/lib/queries';
import { useToast } from '@/lib/toast';
import { formatDate, formatDateTime, percent } from '@/lib/utils';

export function WorkerDetailPage() {
  const { workerId } = useParams();
  const { t } = useTranslation();
  const text = useText();
  const locale = useLocale();
  const toast = useToast();
  const worker = useWorker(workerId);
  const sites = useSites();
  const settings = useAppSettings();
  const update = useUpdateWorker();
  const [editing, setEditing] = useState(false);
  const [openResult, setOpenResult] = useState<string | null>(null);
  // "Now" for certificate states, fixed for the life of the page.
  const [now] = useState(() => Date.now());
  const data = worker.data;

  const facts: [string, string][] =
    data == null
      ? []
      : [
          [t('table.workerId'), data.workerId],
          [t('table.role'), data.role],
          [t('table.site'), data.siteName],
          [t('table.district'), data.district],
          [t('table.sector'), t(`filters.sector.${data.sector}`)],
          [t('table.language'), t(`languages.${data.preferredLanguage}`)],
          [t('table.registered'), formatDate(data.createdAt)],
          [
            t('table.lastActivity'),
            data.lastActivityAt != null
              ? formatDateTime(data.lastActivityAt, locale)
              : t('common.never'),
          ],
        ];

  return (
    <>
      <div className="mb-5 flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <Link
            to="/workers"
            className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> {t('nav.workers')}
          </Link>
          <h1 className="text-[22px] leading-tight font-semibold tracking-tight">
            {data?.name ?? workerId}
          </h1>
          {data != null && (
            <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span className="tabular-nums">{data.workerId}</span>
              <CertificationDot state={data.certification} />
              {!data.active && <Badge variant="secondary">{t('workers.inactive')}</Badge>}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <LanguageToggle />
          {data != null && (
            <>
              <Button
                variant="outline"
                onClick={() => setEditing(true)}
                disabled={sites.data == null}
              >
                <Pencil /> {t('actions.edit')}
              </Button>
              <Button
                variant="outline"
                disabled={update.isPending}
                onClick={() =>
                  void update
                    .mutateAsync({ id: data.workerId, body: { active: !data.active } })
                    .then(() => toast(t('common.saved')))
                }
              >
                <Power />{' '}
                {data.active ? t('workers.detail.deactivate') : t('workers.detail.activate')}
              </Button>
            </>
          )}
          <span className="hidden lg:inline-flex">
            <UserMenu />
          </span>
        </div>
      </div>

      {worker.isError && <ErrorState error={worker.error} onRetry={() => void worker.refetch()} />}
      {data == null && !worker.isError && <LoadingRows rows={8} />}

      {data != null && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <Card className="xl:col-span-4">
            <CardHeader>
              <CardTitle>{t('workers.detail.profile')}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 text-sm">
                {facts.map(([label, value]) => (
                  <div key={label} className="contents">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="font-medium">{value}</dd>
                  </div>
                ))}
              </dl>
              {data.lockedUntil != null && Date.parse(data.lockedUntil) > now && (
                <p className="mt-4 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  <Lock className="size-4" />
                  {t('workers.detail.locked', { time: formatDateTime(data.lockedUntil, locale) })}
                </p>
              )}
              <Button variant="outline" size="sm" className="mt-4" onClick={() => setEditing(true)}>
                <KeyRound /> {t('workers.detail.resetPin')}
              </Button>
            </CardContent>
          </Card>

          <Card className="xl:col-span-8">
            <CardHeader>
              <CardTitle>{t('workers.detail.certificates')}</CardTitle>
            </CardHeader>
            <CardContent>
              {data.certificateList.length === 0 ? (
                <EmptyState text={t('workers.detail.noCertificates')} />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('table.certificate')}</TableHead>
                      <TableHead>{t('table.module')}</TableHead>
                      <TableHead className="text-right">{t('table.score')}</TableHead>
                      <TableHead>{t('table.issued')}</TableHead>
                      <TableHead>{t('table.validUntil')}</TableHead>
                      <TableHead>{t('table.status')}</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.certificateList.map((cert) => (
                      <TableRow key={cert.id}>
                        <TableCell>
                          <Link
                            to={`/verify?id=${cert.id}`}
                            className="text-blue-700 underline underline-offset-2"
                          >
                            {cert.id}
                          </Link>
                        </TableCell>
                        <TableCell>
                          {text(data.mastery.find((m) => m.moduleId === cert.moduleId)?.title) ||
                            cert.moduleId}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{cert.score}%</TableCell>
                        <TableCell className="tabular-nums">{formatDate(cert.issuedOn)}</TableCell>
                        <TableCell className="tabular-nums">{formatDate(cert.expiresOn)}</TableCell>
                        <TableCell>
                          <CertificateStateDot
                            state={certificateState(cert, now, settings.data?.expiringSoonDays)}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <ExportButton
                            kind="pdf"
                            path={`/api/certificates/${cert.id}/pdf`}
                            query={{}}
                            filename={`${cert.id}.pdf`}
                            label="PDF"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card className="xl:col-span-5">
            <CardHeader>
              <CardTitle>{t('workers.detail.mastery')}</CardTitle>
              <CardDescription>{t('workers.detail.masteryHint')}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              {data.mastery.length === 0 && <EmptyState text={t('workers.detail.noHistory')} />}
              {data.mastery.map((module) => (
                <div key={module.moduleId}>
                  <p className="mb-2 text-sm font-semibold">{text(module.title)}</p>
                  <ul className="flex flex-col gap-2">
                    {module.steps.map((step) => (
                      <li
                        key={step.stepId}
                        className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 text-xs"
                      >
                        <span className="truncate">{text(step.title)}</span>
                        <span className="text-muted-foreground tabular-nums">
                          {step.mastery}% · {step.clean}/{step.attempts}
                        </span>
                        <Progress value={step.mastery} className="col-span-2" />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="xl:col-span-7">
            <CardHeader>
              <CardTitle>{t('workers.detail.history')}</CardTitle>
            </CardHeader>
            <CardContent>
              {data.attempts.length === 0 ? (
                <EmptyState text={t('workers.detail.noHistory')} />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('table.date')}</TableHead>
                      <TableHead>{t('table.module')}</TableHead>
                      <TableHead>{t('table.type')}</TableHead>
                      <TableHead className="text-right">{t('table.score')}</TableHead>
                      <TableHead>{t('table.mode')}</TableHead>
                      <TableHead>{t('table.status')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.attempts.map((row) => (
                      <TableRow
                        key={row.resultId}
                        data-clickable
                        onClick={() => setOpenResult(row.resultId)}
                      >
                        <TableCell className="tabular-nums">
                          {formatDate(row.completedAt)}
                        </TableCell>
                        <TableCell>{text(row.moduleTitle)}</TableCell>
                        <TableCell>
                          {t(`attemptType.${row.attemptType}`)}
                          {row.attemptNumber > 0 && (
                            <span className="text-muted-foreground"> #{row.attemptNumber}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {percent(row.score)}
                        </TableCell>
                        <TableCell>{t(`mode.${row.mode}`)}</TableCell>
                        <TableCell>
                          <AssessmentStatus row={row} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {editing && data != null && sites.data != null && (
        <WorkerForm open={editing} onOpenChange={setEditing} sites={sites.data} worker={data} />
      )}
      <AssessmentDialog resultId={openResult} onClose={() => setOpenResult(null)} />
    </>
  );
}
