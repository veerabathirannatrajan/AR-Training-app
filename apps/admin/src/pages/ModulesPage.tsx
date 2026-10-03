import type { ModuleStats } from '@ar-training/shared';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState, ErrorState, LoadingRows } from '@/components/states';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge, Progress, Skeleton } from '@/components/ui/misc';
import { useLocale, useText } from '@/i18n';
import { useAppSettings, useModule, useModules } from '@/lib/queries';
import { cn, percent } from '@/lib/utils';

const AXIS = { fontSize: 11, fill: '#71717a' };
const TOOLTIP = { borderRadius: 8, border: '1px solid #e4e4e7', fontSize: 12 };

function ModuleCard({ module, active }: { module: ModuleStats; active: boolean }) {
  const { t } = useTranslation();
  const text = useText();
  const assessed = module.kind === 'assessed';
  const stats: [string, string][] = [
    [assessed ? t('modules.assessments') : t('modules.completions'), String(module.assessments)],
    [t('table.passRate'), percent(module.passRate)],
    [t('table.avgScore'), percent(module.avgScore)],
    [
      t('modules.avgDuration'),
      module.avgDurationSeconds != null
        ? t('modules.minutes', { count: Math.max(1, Math.round(module.avgDurationSeconds / 60)) })
        : '—',
    ],
  ];
  return (
    <Link to={`/modules/${module.moduleId}`} className="block">
      <Card
        className={cn(
          'h-full gap-3 px-5 py-4 transition-colors hover:bg-zinc-50',
          active && 'ring-2 ring-zinc-900/80',
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold">{text(module.title)}</p>
          <Badge variant={assessed ? 'outline' : 'secondary'}>
            {assessed ? t('modules.assessed') : t('modules.tutorial')}
          </Badge>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          {stats.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        {assessed && (
          <p className="text-xs text-muted-foreground">
            {t('modules.certifiedWorkers')}:{' '}
            <span className="font-medium text-foreground">{module.certifiedWorkers}</span>
          </p>
        )}
      </Card>
    </Link>
  );
}

function ModuleDetailView({ moduleId }: { moduleId: string }) {
  const { t } = useTranslation();
  const text = useText();
  const locale = useLocale();
  const detail = useModule(moduleId);
  const settings = useAppSettings();
  const data = detail.data;

  if (detail.isError)
    return <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />;
  if (data == null) return <LoadingRows rows={8} />;

  const hardest = [...data.steps]
    .filter((step) => step.attempts > 0)
    .sort((a, b) => a.cleanRate - b.cleanRate);
  const buckets = data.scoreBuckets.map((count, index) => ({
    bucket: index === 9 ? '90–100' : `${index * 10}–${index * 10 + 9}`,
    count,
    pass: index * 10 >= (settings.data?.passMark ?? 70),
  }));
  const trend = data.trend.map((point) => ({
    ...point,
    label: new Date(`${point.month}-01T00:00:00`).toLocaleDateString(locale, { month: 'short' }),
  }));
  const assessed = data.kind === 'assessed';

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
      <Card className="xl:col-span-7">
        <CardHeader>
          <CardTitle>{t('modules.hardest')}</CardTitle>
          <CardDescription>{text(data.summary)}</CardDescription>
        </CardHeader>
        <CardContent>
          {hardest.length === 0 ? (
            <EmptyState />
          ) : (
            <ul className="flex flex-col gap-3">
              {hardest.map((step) => (
                <li key={step.stepId} className="text-sm">
                  <div className="mb-1.5 flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate font-medium">{text(step.title)}</span>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {t('modules.cleanRate')} {step.cleanRate}% ·{' '}
                      {t('modules.struggled', {
                        count: step.workersWithMistakes,
                        total: step.workers,
                      })}
                      {step.criticalCount > 0 && (
                        <span className="ml-1 text-red-700">· {step.criticalCount} ⚠</span>
                      )}
                    </span>
                  </div>
                  <Progress value={step.cleanRate} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4 xl:col-span-5">
        <Card>
          <CardHeader>
            <CardTitle>{t('modules.distribution')}</CardTitle>
            {assessed && (
              <CardDescription>
                {t('modules.passMark', { mark: settings.data?.passMark ?? 70 })}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={buckets} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                <CartesianGrid vertical={false} stroke="#ececef" />
                <XAxis
                  dataKey="bucket"
                  tick={AXIS}
                  tickLine={false}
                  axisLine={{ stroke: '#d4d4d8' }}
                  interval={1}
                />
                <YAxis allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={TOOLTIP} cursor={{ fill: 'rgb(0 0 0 / 0.04)' }} />
                <Bar
                  dataKey="count"
                  name={t('modules.assessments')}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={24}
                  shape={(props: unknown) => {
                    const { x, y, width, height, payload } = props as {
                      x: number;
                      y: number;
                      width: number;
                      height: number;
                      payload: { pass: boolean };
                    };
                    const r = Math.min(4, width / 2, height);
                    return (
                      <path
                        d={`M${x},${y + height}V${y + r}Q${x},${y} ${x + r},${y}H${x + width - r}Q${x + width},${y} ${x + width},${y + r}V${y + height}Z`}
                        fill={payload.pass ? '#3f3f46' : '#a1a1aa'}
                      />
                    );
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('modules.trend')}</CardTitle>
            <CardDescription>
              <span className="mr-3 inline-flex items-center gap-1.5">
                <span className="h-0.5 w-3 bg-zinc-700" /> {t('table.passRate')}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-0.5 w-3 bg-zinc-400" /> {t('table.avgScore')}
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[170px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 6, right: 8, bottom: 0, left: -24 }}>
                <CartesianGrid vertical={false} stroke="#ececef" />
                <XAxis
                  dataKey="label"
                  tick={AXIS}
                  tickLine={false}
                  axisLine={{ stroke: '#d4d4d8' }}
                />
                <YAxis
                  domain={[0, 100]}
                  ticks={[0, 50, 100]}
                  tick={AXIS}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={TOOLTIP}
                  formatter={(value) => (value == null ? '—' : `${String(value)}%`)}
                />
                {assessed && (
                  <Line
                    dataKey="passRate"
                    name={t('table.passRate')}
                    stroke="#3f3f46"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls
                  />
                )}
                <Line
                  dataKey="avgScore"
                  name={t('table.avgScore')}
                  stroke="#a1a1aa"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {data.quiz.length > 0 && (
        <Card className="xl:col-span-7">
          <CardHeader>
            <CardTitle>{t('modules.quiz')}</CardTitle>
            <CardDescription>{t('modules.correctRate')}</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-3">
              {data.quiz.map((question) => (
                <li key={question.questionId} className="text-sm">
                  <div className="mb-1.5 flex items-baseline justify-between gap-3">
                    <span className="min-w-0">{text(question.prompt)}</span>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {percent(question.correctRate)} · {question.answered}
                    </span>
                  </div>
                  <Progress value={question.correctRate ?? 0} />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {assessed && (
        <Card className="xl:col-span-5">
          <CardHeader>
            <CardTitle>{t('dashboard.critical')}</CardTitle>
            <CardDescription>{t('dashboard.criticalHint')}</CardDescription>
          </CardHeader>
          <CardContent>
            {data.criticalErrors.length === 0 ? (
              <EmptyState text={t('dashboard.noCritical')} />
            ) : (
              <ul className="flex flex-col divide-y text-sm">
                {data.criticalErrors.map((stat) => (
                  <li key={stat.errorId} className="flex items-start gap-3 py-2.5 first:pt-0">
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-red-600" aria-hidden />
                    <span className="min-w-0 flex-1">{text(stat.title)}</span>
                    <span className="text-xs text-muted-foreground">
                      {t('dashboard.workersCount', { count: stat.workers })}
                    </span>
                    <span className="font-semibold tabular-nums">{stat.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function ModulesPage() {
  const { t } = useTranslation();
  const { moduleId } = useParams();
  const modules = useModules();
  const selected = moduleId ?? modules.data?.find((module) => module.kind === 'assessed')?.moduleId;

  return (
    <>
      <PageHeader title={t('modules.title')} subtitle={t('modules.subtitle')} filters />
      {modules.isError && (
        <ErrorState error={modules.error} onRetry={() => void modules.refetch()} />
      )}
      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        {modules.data == null
          ? Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-40" />)
          : modules.data.map((module) => (
              <ModuleCard
                key={module.moduleId}
                module={module}
                active={module.moduleId === selected}
              />
            ))}
      </div>
      {selected != null && <ModuleDetailView moduleId={selected} />}
    </>
  );
}
