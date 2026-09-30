import type { ComponentType } from 'react';
import {
  AimIllustration,
  EscapeIllustration,
  LiftIllustration,
  PassIllustration,
  SmokeIllustration,
} from './illustrations';

/** Quiz illustrations for the Fire module, by the ids used in its content JSON. */
export const FIRE_ILLUSTRATIONS: Record<string, ComponentType> = {
  pass: PassIllustration,
  aim: AimIllustration,
  smoke: SmokeIllustration,
  lift: LiftIllustration,
  escape: EscapeIllustration,
};
