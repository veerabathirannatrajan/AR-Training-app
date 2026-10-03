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

export type StepOptionOutcome = 'correct' | 'acceptable' | 'wrong' | 'critical';

/** An answer choice on a decision step (fire type, extinguisher, exit, …). */
export interface StepOption {
  id: string;
  label: LocalizedText;
  outcome: StepOptionOutcome;
  /** Shown (and spoken) when this option is chosen. */
  feedback?: LocalizedText;
  /** For `critical` outcomes: the module's critical error this choice triggers. */
  criticalErrorId?: string;
  /** Points awarded for an `acceptable` choice (the step's full points go to `correct`). */
  points?: number;
}

export interface ModuleStep {
  /** Unique within the module; also the key for audio files: audio/{lang}/{moduleId}.{stepId}.mp3 */
  id: string;
  /** Short name for result screens and reports, e.g. "Tap the safety cone". */
  title: LocalizedText;
  interaction: TrainingAction;
  points: number;
  /** Taking longer than this costs part of the step's points (the "time" part of the practical score). */
  timeLimitSeconds?: number;
  /** Steps sharing a group count as one step in the progress bar (e.g. the four PASS actions). */
  group?: string;
  /** Short badge for a sub-step inside its group, e.g. "P", "A", "S", "S". */
  badge?: string;
  /** Situation line on the instruction card, e.g. "Electrical fire detected". */
  headline?: LocalizedText;
  /** `danger` shows the instruction card with a red alert style. */
  tone?: 'info' | 'danger';
  instruction: LocalizedText;
  /** Replaces `instruction` in 3D fallback mode where the physical action differs. */
  fallbackInstruction?: LocalizedText;
  /** Red safety banner under the instruction, e.g. "Do not use water on electrical fires". */
  warning?: LocalizedText;
  success: LocalizedText;
  /** Shown (and spoken) after a mistake. */
  hint?: LocalizedText;
  /** Answer choices for decision steps. */
  options?: StepOption[];
  /**
   * Extra feedback the module scene shows in specific situations, keyed by situation id
   * (e.g. "missing"). `{{name}}` placeholders are filled in by the scene (see fillText).
   */
  messages?: Record<string, LocalizedText>;
  notes?: string;
}

/** A life-threatening action. Any one of them fails the attempt, with this explanation. */
export interface CriticalError {
  id: string;
  title: LocalizedText;
  /** Why it is dangerous and what to do instead. */
  explanation: LocalizedText;
  notes?: string;
}

export interface QuizOption {
  id: string;
  label: LocalizedText;
  correct: boolean;
}

/** Scenario quiz question: an illustration, a narrated prompt and one correct answer. */
export interface QuizQuestion {
  id: string;
  prompt: LocalizedText;
  /** Id of an illustration bundled with the app. */
  illustration: string;
  options: QuizOption[];
  explanation: LocalizedText;
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
  criticalErrors?: CriticalError[];
  quiz?: QuizQuestion[];
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

/** Fills `{{name}}` placeholders in every language of a text with the matching values. */
export function fillText(
  template: LocalizedText,
  values: Readonly<Record<string, LocalizedText>>,
): LocalizedText {
  const fill = (text: string, pick: (value: LocalizedText) => string) =>
    text.replace(/\{\{(\w+)\}\}/g, (match, name: string) => {
      const value = values[name];
      return value == null ? match : pick(value);
    });
  const filled: LocalizedText = {
    en: fill(template.en, (value) => value.en),
    hi: fill(template.hi, (value) => value.hi),
  };
  if (template.sat != null) {
    // Values without Santali fall back to Hindi, so the result is a draft until reviewed.
    filled.sat = {
      text: fill(template.sat.text, (value) => value.sat?.text ?? value.hi),
      needsReview:
        template.sat.needsReview ||
        Object.values(values).some((value) => value.sat == null || value.sat.needsReview),
      source: template.sat.source,
    };
  }
  return filled;
}

export function totalPoints(module: TrainingModuleContent): number {
  return module.steps.reduce((sum, step) => sum + step.points, 0);
}

/** Display step groups in order: consecutive steps with the same `group` form one entry. */
export function stepGroups(module: TrainingModuleContent): string[][] {
  const groups: string[][] = [];
  let currentKey: string | null = null;
  for (const step of module.steps) {
    const key = step.group ?? `step:${step.id}`;
    if (key === currentKey) groups[groups.length - 1]?.push(step.id);
    else groups.push([step.id]);
    currentKey = key;
  }
  return groups;
}

/** 0-based index of the display group that contains the step. */
export function groupIndexOf(module: TrainingModuleContent, stepId: string): number {
  return stepGroups(module).findIndex((group) => group.includes(stepId));
}
