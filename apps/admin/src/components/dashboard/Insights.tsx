import type { Insight } from '@ar-training/shared';
import { CircleCheck, Sparkle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useText } from '@/i18n';
import { cn } from '@/lib/utils';

const TONE: Record<Insight['tone'], string> = {
  critical: 'text-red-600',
  warn: 'text-amber-600',
  info: 'text-zinc-500',
  ok: 'text-green-600',
};

/** Turns a rule-based insight (kind + params) into a sentence in the portal language. */
export function useInsightText() {
  const { t } = useTranslation();
  const text = useText();
  // Insight params are dynamic, so the typed key/params pairing does not apply here.
  const tr = t as unknown as (key: string, options: Record<string, unknown>) => string;
  return (insight: Insight): string => {
    const labels = Object.fromEntries(
      Object.entries(insight.labels).map(([key, value]) => [key, text(value)]),
    );
    const values = { ...insight.params, ...labels };
    if (insight.kind === 'not-certified') {
      return insight.params.scope === 'all'
        ? tr('insight.not-certified-all', values)
        : tr('insight.not-certified-new', values);
    }
    return tr(`insight.${insight.kind}`, values);
  };
}

export function InsightsList({ insights }: { insights: Insight[] }) {
  const sentence = useInsightText();
  return (
    <ul className="flex flex-col gap-2.5">
      {insights.map((insight) => (
        <li
          key={insight.id}
          className="flex items-start gap-3 rounded-lg border px-3.5 py-3 text-[13px] leading-snug"
        >
          {insight.kind === 'all-good' ? (
            <CircleCheck className={cn('mt-0.5 size-4 shrink-0', TONE.ok)} />
          ) : (
            <Sparkle className={cn('mt-0.5 size-4 shrink-0', TONE[insight.tone])} />
          )}
          <span>{sentence(insight)}</span>
        </li>
      ))}
    </ul>
  );
}
