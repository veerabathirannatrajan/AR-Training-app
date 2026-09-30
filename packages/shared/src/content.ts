import type { TrainingAction } from './events';
import type { LanguageCode } from './languages';

/**
 * A Santali string. Santali text must never be invented: machine-assisted drafts are allowed
 * only when marked, and every string keeps `needsReview: true` until a native speaker signs it off.
 */
export interface SantaliText {
  text: string;
  needsReview: boolean;
  /** Where the text came from, e.g. "machine-draft" or "native-speaker:<reviewer>". */
  source: string;
}

/** Text in every app language. Santali falls back to Hindi (then English) while it is missing. */
export interface LocalizedText {
  en: string;
  hi: string;
  sat?: SantaliText;
}

/** Reviewer metadata required on all module content so a safety expert can check it. */
export interface ContentReview {
  /** Standards / practice the content follows, or why no safety source applies. */
  source: string;
  notes: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
}

export interface ModuleStep {
  /** Unique within the module; also the key for audio files: audio/{lang}/{moduleId}.{stepId}.mp3 */
  id: string;
  interaction: TrainingAction;
  points: number;
  instruction: LocalizedText;
  /** Replaces `instruction` in 3D fallback mode where the physical action differs. */
  fallbackInstruction?: LocalizedText;
  success: LocalizedText;
  /** Shown (and spoken) after a mistake. */
  hint?: LocalizedText;
  notes?: string;
}

export type ModuleKind = 'tutorial' | 'assessed';

export interface TrainingModuleContent {
  id: string;
  version: number;
  kind: ModuleKind;
  title: LocalizedText;
  summary: LocalizedText;
  /** Narrated on the module intro screen. */
  briefing: LocalizedText;
  objectives: LocalizedText[];
  estimatedMinutes: number;
  steps: ModuleStep[];
  review: ContentReview;
}

export interface ResolvedText {
  text: string;
  /** Language the text is actually in (Santali may fall back to Hindi). */
  lang: LanguageCode;
  /** True when the text is an unreviewed Santali draft. */
  needsReview: boolean;
}

/** Picks the text for a language, falling back sat → hi → en. */
export function resolveText(text: LocalizedText, lang: LanguageCode): ResolvedText {
  if (lang === 'sat') {
    if (text.sat != null && text.sat.text.trim() !== '') {
      return { text: text.sat.text, lang: 'sat', needsReview: text.sat.needsReview };
    }
    return { text: text.hi, lang: 'hi', needsReview: false };
  }
  return { text: text[lang], lang, needsReview: false };
}

export function totalPoints(module: TrainingModuleContent): number {
  return module.steps.reduce((sum, step) => sum + step.points, 0);
}
