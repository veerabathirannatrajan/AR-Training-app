import {
  fillText,
  GAS_CONFINED_SPACE,
  type LocalizedText,
  type StepOption,
} from '@ar-training/shared';
import { haptic, sfx } from '../../engine/feedback/sfx';
import { runner } from '../../engine/runner/runnerStore';
import { gas } from './gasStore';

export const DRESS_STEP_ID = 'dress-entrant';
const DRESS_STEP = GAS_CONFINED_SPACE.steps.find((step) => step.id === DRESS_STEP_ID);

/** PPE on the tray, in content order (labels and wrong-item feedback live in the content). */
export const PPE_OPTIONS: readonly StepOption[] = DRESS_STEP?.options ?? [];
/** What the entrant must wear. */
export const REQUIRED_PPE: readonly string[] = PPE_OPTIONS.filter(
  (option) => option.outcome === 'correct',
).map((option) => option.id);

function joinLabels(itemIds: readonly string[]): LocalizedText {
  const labels = itemIds
    .map((id) => PPE_OPTIONS.find((option) => option.id === id)?.label)
    .filter((label): label is LocalizedText => label != null);
  return {
    en: labels.map((label) => label.en.toLowerCase()).join(', '),
    hi: labels.map((label) => label.hi).join(', '),
  };
}

/** Puts an item on Ravi: required items stay on, wrong ones are refused with the reason. */
export function equipPpe(itemId: string): void {
  const option = PPE_OPTIONS.find((candidate) => candidate.id === itemId);
  const state = gas();
  if (option == null || state.worn.includes(itemId) || state.rejected.includes(itemId)) return;
  if (option.outcome === 'correct') {
    state.wear(itemId);
    sfx.tap();
    haptic.success();
    return;
  }
  state.reject(itemId);
  sfx.error();
  haptic.error();
  runner().recordMistake(DRESS_STEP_ID, 'drag-drop', {
    detail: itemId,
    ...(option.feedback != null ? { message: option.feedback } : {}),
  });
}

/** "Ready": completes the step when everything required is on, otherwise flags what is missing. */
export function checkPpeReady(): void {
  const state = gas();
  const missing = REQUIRED_PPE.filter((id) => !state.worn.includes(id));
  if (missing.length === 0) {
    runner().completeStep(DRESS_STEP_ID, { detail: state.worn.join('+') });
    return;
  }
  state.flag(missing);
  sfx.error();
  haptic.error();
  const template = DRESS_STEP?.messages?.missing;
  runner().recordMistake(DRESS_STEP_ID, 'drag-drop', {
    detail: `missing:${missing.join('+')}`,
    ...(template != null ? { message: fillText(template, { items: joinLabels(missing) }) } : {}),
  });
}
