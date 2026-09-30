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

export const moduleStepSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'step ids are kebab-case'),
  interaction: trainingActionSchema,
  points: z.number().int().min(0),
  instruction: localizedTextSchema,
  fallbackInstruction: localizedTextSchema.optional(),
  success: localizedTextSchema,
  hint: localizedTextSchema.optional(),
  notes: nonEmpty.optional(),
});

export const trainingModuleSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
    version: z.number().int().min(1),
    kind: z.enum(['tutorial', 'assessed']),
    title: localizedTextSchema,
    summary: localizedTextSchema,
    briefing: localizedTextSchema,
    objectives: z.array(localizedTextSchema).min(1),
    estimatedMinutes: z.number().positive(),
    steps: z.array(moduleStepSchema).min(1),
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
  });

// Compile-time guard: every valid TrainingModuleContent must also satisfy the schema's shape.
type SchemaOutput = z.infer<typeof trainingModuleSchema>;
export const typeMatchesSchema: TrainingModuleContent extends SchemaOutput ? true : never = true;
