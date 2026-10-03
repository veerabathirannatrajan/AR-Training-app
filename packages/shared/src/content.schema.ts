/**
 * Runtime schema for module content JSON. Used by tests and tooling only (not bundled into
 * the apps), so reviewers' edits to content/*.json are caught before they reach a phone.
 */
import { z } from 'zod';
import type { TrainingModuleContent } from './content';

const nonEmpty = z.string().trim().min(1);

export const santaliTextSchema = z.object({
  text: nonEmpty,
  needsReview: z.boolean(),
  source: nonEmpty,
});

export const localizedTextSchema = z.object({
  en: nonEmpty,
  hi: nonEmpty,
  sat: santaliTextSchema.optional(),
});

const trainingActionSchema = z.enum([
  'place',
  'rotate',
  'tap',
  'drag-drop',
  'hold',
  'aim',
  'swipe',
  'crouch',
  'move',
  'select-option',
]);

const kebab = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'ids are kebab-case');

export const stepOptionSchema = z.object({
  id: kebab,
  label: localizedTextSchema,
  outcome: z.enum(['correct', 'acceptable', 'wrong', 'critical']),
  feedback: localizedTextSchema.optional(),
  criticalErrorId: kebab.optional(),
  points: z.number().int().min(0).optional(),
});

export const moduleStepSchema = z.object({
  id: kebab,
  title: localizedTextSchema,
  interaction: trainingActionSchema,
  points: z.number().int().min(0),
  timeLimitSeconds: z.number().int().positive().optional(),
  group: kebab.optional(),
  badge: z.string().min(1).max(3).optional(),
  headline: localizedTextSchema.optional(),
  tone: z.enum(['info', 'danger']).optional(),
  instruction: localizedTextSchema,
  fallbackInstruction: localizedTextSchema.optional(),
  warning: localizedTextSchema.optional(),
  success: localizedTextSchema,
  hint: localizedTextSchema.optional(),
  options: z.array(stepOptionSchema).min(2).optional(),
  messages: z.record(kebab, localizedTextSchema).optional(),
  notes: nonEmpty.optional(),
});

export const criticalErrorSchema = z.object({
  id: kebab,
  title: localizedTextSchema,
  explanation: localizedTextSchema,
  notes: nonEmpty.optional(),
});

export const quizQuestionSchema = z.object({
  id: kebab,
  prompt: localizedTextSchema,
  illustration: kebab,
  options: z
    .array(z.object({ id: kebab, label: localizedTextSchema, correct: z.boolean() }))
    .min(2)
    .refine((options) => options.filter((option) => option.correct).length === 1, {
      message: 'exactly one correct answer',
    }),
  explanation: localizedTextSchema,
  notes: nonEmpty.optional(),
});

export const trainingModuleSchema = z
  .object({
    id: kebab,
    version: z.number().int().min(1),
    kind: z.enum(['tutorial', 'assessed']),
    title: localizedTextSchema,
    summary: localizedTextSchema,
    briefing: localizedTextSchema,
    objectives: z.array(localizedTextSchema).min(1),
    estimatedMinutes: z.number().positive(),
    steps: z.array(moduleStepSchema).min(1),
    criticalErrors: z.array(criticalErrorSchema).optional(),
    quiz: z.array(quizQuestionSchema).optional(),
    review: z.object({
      source: nonEmpty,
      notes: z.string(),
      reviewedBy: z.string().nullable(),
      reviewedAt: z.string().nullable(),
    }),
  })
  .superRefine((module, ctx) => {
    const seen = new Set<string>();
    for (const step of module.steps) {
      if (seen.has(step.id)) {
        ctx.addIssue({ code: 'custom', message: `duplicate step id "${step.id}"` });
      }
      seen.add(step.id);
    }
    // Every critical option must point at a critical error the module explains.
    const criticalIds = new Set((module.criticalErrors ?? []).map((error) => error.id));
    for (const step of module.steps) {
      for (const option of step.options ?? []) {
        if (option.outcome === 'critical' && !criticalIds.has(option.criticalErrorId ?? '')) {
          ctx.addIssue({
            code: 'custom',
            message: `step "${step.id}" option "${option.id}" needs a known criticalErrorId`,
          });
        }
      }
    }
    if (module.kind === 'assessed' && (module.quiz?.length ?? 0) === 0) {
      ctx.addIssue({ code: 'custom', message: 'assessed modules need a scenario quiz' });
    }
  });

// Compile-time guard: every valid TrainingModuleContent must also satisfy the schema's shape.
type SchemaOutput = z.infer<typeof trainingModuleSchema>;
export const typeMatchesSchema: TrainingModuleContent extends SchemaOutput ? true : never = true;
