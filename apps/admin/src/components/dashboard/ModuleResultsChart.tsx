import type { ModuleStats } from '@ar-training/shared';
import { useTranslation } from 'react-i18next';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useText } from '@/i18n';

// Grey and white portal: the two measures are told apart by lightness (dark vs light grey),
// a legend, and a value on every column cap.
const PASS = '#3f3f46';
const SCORE = '#a1a1aa';

function Legend() {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-4 text-xs text-zinc-600">
      <span className="flex items-center gap-1.5">
        <span className="size-3 rounded-full" style={{ background: PASS }} />
        {t('dashboard.passRate')}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-3 rounded-full" style={{ background: SCORE }} />
        {t('dashboard.avgScore')}
      </span>
    </div>
  );
}

export { Legend as ModuleResultsLegend };

/** Pass rate and average score per assessed module (both percent, one axis). */
export function ModuleResultsChart({ modules }: { modules: ModuleStats[] }) {
  const { t } = useTranslation();
  const text = useText();
  const data = modules
    .filter((module) => module.kind === 'assessed')
    .map((module) => ({
      name: text(module.title).replace(' Response', '').replace(' Protocol', ''),
      pass: module.passRate,
      score: module.avgScore,
      assessments: module.assessments,
    }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 22, right: 4, bottom: 0, left: -18 }} barGap={2}>
        <CartesianGrid vertical={false} stroke="#ececef" />
        <XAxis
          dataKey="name"
          tickLine={false}
          axisLine={{ stroke: '#d4d4d8' }}
          tick={{ fontSize: 12, fill: '#18181b', fontWeight: 500 }}
          interval={0}
        />
        <YAxis
          domain={[0, 100]}
          ticks={[0, 20, 40, 60, 80, 100]}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: '#71717a' }}
        />
        <Tooltip
          cursor={{ fill: 'rgb(0 0 0 / 0.04)' }}
          contentStyle={{ borderRadius: 8, border: '1px solid #e4e4e7', fontSize: 12 }}
          formatter={(value, name) => [
            value == null ? '—' : `${String(value)}%`,
            name === 'pass' ? t('dashboard.passRate') : t('dashboard.avgScore'),
          ]}
        />
        <Bar dataKey="pass" fill={PASS} radius={[4, 4, 0, 0]} maxBarSize={44}>
          <LabelList
            dataKey="pass"
            position="top"
            formatter={(value: unknown) => (value == null ? '' : `${String(value)}%`)}
            style={{ fontSize: 12, fontWeight: 600, fill: '#18181b' }}
          />
        </Bar>
        <Bar dataKey="score" fill={SCORE} radius={[4, 4, 0, 0]} maxBarSize={44}>
          <LabelList
            dataKey="score"
            position="top"
            formatter={(value: unknown) => (value == null ? '' : `${String(value)}%`)}
            style={{ fontSize: 12, fontWeight: 600, fill: '#18181b' }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
