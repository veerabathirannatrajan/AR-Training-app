import { BarChart3, Clock, FileCheck2, Users } from 'lucide-react';
import { lazy, Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { AssessmentTable } from '@/components/AssessmentTable';
import { Insights as InsightsIcon } from '@/components/dashboard/icons';
import { InsightsList } from '@/components/dashboard/Insights';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { ModuleResultsChart, ModuleResultsLegend } from '@/components/dashboard/ModuleResultsChart';
import { SitesMap } from '@/components/dashboard/SitesMap';
import { ExportButton } from '@/components/ExportButtons';
import { PageHeader } from '@/components/layout/PageHeader';
import { Pagination } from '@/components/Pagination';
import { EmptyState, ErrorState, LoadingRows } from '@/components/states';
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Progress, Skeleton } from '@/components/ui/misc';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/overlays';
import { VerifyWidget } from '@/components/verify/VerifyWidget';
import { useText } from '@/i18n';
import { useFilters } from '@/lib/filters';
import { useAssessments, useDashboard } from '@/lib/queries';

const ModulePreview3D = lazy(() => import('@/components/dashboard/ModulePreview3D'));
const PAGE_SIZE = 5;

export function DashboardPage() {
  const { t } = useTranslation();
  const text = useText();
  const navigate = useNavigate();
  const { range, sector } = useFilters();
  const dashboard = useDashboard();
  const [page, setPage] = useState(1);
  const recent = useAssessments({ page, pageSize: PAGE_SIZE });
  const [preview, setPreview] = useState<'fire' | 'gas'>('fire');
  const data = dashboard.data;
  const kpis = data?.kpis;
  const loading = dashboard.isPending;

  return (
    <>
      <PageHeader
        title={t('dashboard.title')}
        subtitle={t('dashboard.subtitle')}
        filters
        actions={
          <>
            <ExportButton
              kind="pdf"
              path="/api/reports/compliance.pdf"
              query={{ range, sector }}
              filename="compliance-report.pdf"
            />
            <ExportButton
              kind="csv"
              path="/api/reports/compliance.csv"
              query={{ range, sector }}
              filename="compliance-register.csv"
            />
          </>
        }
      />

      {dashboard.isError && (
        <ErrorState
          error={dashboard.error}
          onRetry={() => void dashboard.refetch()}
          className="mb-4"
        />
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <KpiCard
          label={t('dashboard.kpi.workers')}
          icon={Users}
          loading={loading}
          value={kpis?.workersRegistered ?? '—'}
          detail={kpis != null ? t('dashboard.kpi.workersNew', { count: kpis.workersNew }) : null}
        />
        <KpiCard
          label={t('dashboard.kpi.certified')}
          icon={FileCheck2}
          loading={loading}
          value={kpis?.certifiedWorkers ?? '—'}
          aside={
            kpis != null ? t('dashboard.kpi.certifiedOf', { percent: kpis.certifiedPercent }) : null
          }
          detail={
            kpis == null
              ? null
              : kpis.anchoredCertificates > 0
                ? t('dashboard.kpi.anchored', { count: kpis.anchoredCertificates })
                : t('dashboard.kpi.notAnchored')
          }
        />
        <KpiCard
          label={t('dashboard.kpi.avgScore')}
          icon={BarChart3}
          loading={loading}
          value={kpis?.avgScore != null ? `${kpis.avgScore}%` : '—'}
          detail={
            kpis == null
              ? null
              : kpis.assessments > 0
                ? t('dashboard.kpi.avgScoreSub', {
                    count: kpis.assessments,
                    rate: `${kpis.passRate ?? 0}%`,
                  })
                : t('dashboard.kpi.noAssessments')
          }
        />
        <KpiCard
          label={t('dashboard.kpi.expiring')}
          icon={Clock}
          loading={loading}
          value={kpis?.expiringSoon ?? '—'}
          detail={
            data != null
              ? t('dashboard.kpi.expiringSub', { days: data.settings.expiringSoonDays })
              : null
          }
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-12">
        <Card className="xl:col-span-5">
          <CardHeader>
            <CardTitle>{t('dashboard.sites')}</CardTitle>
          </CardHeader>
          <CardContent className="min-h-[260px] flex-1">
            {data != null ? (
              <SitesMap sites={data.sites} />
            ) : (
              <Skeleton className="h-full w-full" />
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-4">
          <CardHeader>
            <CardTitle>{t('dashboard.moduleResults')}</CardTitle>
            <CardAction>
              <ModuleResultsLegend />
            </CardAction>
          </CardHeader>
          <CardContent className="min-h-[260px] flex-1">
            {data != null ? (
              <ModuleResultsChart modules={data.modules} />
            ) : (
              <Skeleton className="h-full w-full" />
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 xl:col-span-3">
          <CardHeader>
            <CardTitle>{t('dashboard.insights')}</CardTitle>
            <CardAction>
              <InsightsIcon />
            </CardAction>
          </CardHeader>
          <CardContent>
            {data != null ? (
              <InsightsList insights={data.insights.slice(0, 4)} />
            ) : (
              <LoadingRows rows={3} />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-8">
          <CardHeader>
            <CardTitle>{t('dashboard.recent')}</CardTitle>
          </CardHeader>
          <CardContent>
            {recent.isError ? (
              <ErrorState error={recent.error} onRetry={() => void recent.refetch()} />
            ) : recent.data == null ? (
              <LoadingRows />
            ) : recent.data.items.length === 0 ? (
              <EmptyState />
            ) : (
              <>
                <AssessmentTable
                  rows={recent.data.items}
                  onOpen={(row) => navigate(`/assessments?open=${row.resultId}`)}
                />
                <Pagination
                  page={page}
                  pageSize={PAGE_SIZE}
                  total={recent.data.total}
                  shown={recent.data.items.length}
                  onPage={setPage}
                />
              </>
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-4">
          <CardHeader>
            <CardTitle>{t('dashboard.verify')}</CardTitle>
          </CardHeader>
          <CardContent>
            <VerifyWidget />
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-12">
        <Card className="xl:col-span-5">
          <CardHeader>
            <CardTitle>{t('dashboard.mistakes')}</CardTitle>
            <CardDescription>{t('dashboard.mistakesHint')}</CardDescription>
          </CardHeader>
          <CardContent>
            {data == null ? (
              <LoadingRows rows={4} />
            ) : data.commonMistakes.length === 0 ? (
              <EmptyState />
            ) : (
              <ul className="flex flex-col gap-3.5">
                {data.commonMistakes.map((stat) => {
                  const share = Math.round(
                    (stat.workersWithMistakes / Math.max(1, stat.workers)) * 100,
                  );
                  return (
                    <li key={`${stat.moduleId}:${stat.stepId}`} className="text-sm">
                      <div className="mb-1.5 flex items-baseline justify-between gap-3">
                        <span className="min-w-0 truncate">
                          <span className="font-medium">{text(stat.title)}</span>
                          <span className="text-muted-foreground">
                            {' · '}
                            {text(data.modules.find((m) => m.moduleId === stat.moduleId)?.title)}
                          </span>
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                          {t('modules.struggled', {
                            count: stat.workersWithMistakes,
                            total: stat.workers,
                          })}
                        </span>
                      </div>
                      <Progress value={share} />
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-3">
          <CardHeader>
            <CardTitle>{t('dashboard.critical')}</CardTitle>
            <CardDescription>{t('dashboard.criticalHint')}</CardDescription>
          </CardHeader>
          <CardContent>
            {data == null ? (
              <LoadingRows rows={3} />
            ) : data.criticalErrors.length === 0 ? (
              <EmptyState text={t('dashboard.noCritical')} />
            ) : (
              <ul className="flex flex-col divide-y text-sm">
                {data.criticalErrors.map((stat) => (
                  <li
                    key={`${stat.moduleId}:${stat.errorId}`}
                    className="flex items-start gap-3 py-2.5 first:pt-0"
                  >
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-red-600" aria-hidden />
                    <span className="min-w-0 flex-1">{text(stat.title)}</span>
                    <span className="font-semibold tabular-nums">{stat.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 xl:col-span-4">
          <CardHeader>
            <CardTitle>{t('dashboard.preview')}</CardTitle>
            <CardDescription>{t('dashboard.previewHint')}</CardDescription>
            <CardAction>
              <Tabs value={preview} onValueChange={(value) => setPreview(value as 'fire' | 'gas')}>
                <TabsList>
                  <TabsTrigger value="fire">
                    {text(data?.modules.find((m) => m.moduleId === 'fire-explosion')?.title).split(
                      ' ',
                    )[0] || 'Fire'}
                  </TabsTrigger>
                  <TabsTrigger value="gas">
                    {text(
                      data?.modules.find((m) => m.moduleId === 'gas-confined-space')?.title,
                    ).split(' ')[0] || 'Gas'}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </CardAction>
          </CardHeader>
          <CardContent className="h-[230px]">
            <Suspense fallback={<Skeleton className="h-full w-full" />}>
              <ModulePreview3D module={preview} />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
