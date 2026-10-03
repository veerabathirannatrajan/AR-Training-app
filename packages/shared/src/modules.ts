import arBasicsJson from '../content/modules/ar-basics.json';
import fireExplosionJson from '../content/modules/fire-explosion.json';
import gasConfinedSpaceJson from '../content/modules/gas-confined-space.json';
import type { TrainingModuleContent } from './content';

// JSON imports widen string unions to `string`; content.test.ts validates every file
// against the schema, which is what makes these casts safe.
export const AR_BASICS = arBasicsJson as TrainingModuleContent;
export const FIRE_EXPLOSION = fireExplosionJson as TrainingModuleContent;
export const GAS_CONFINED_SPACE = gasConfinedSpaceJson as TrainingModuleContent;

/** All module content, in the order modules appear on the home screen. */
export const MODULE_CONTENT: readonly TrainingModuleContent[] = [
  AR_BASICS,
  FIRE_EXPLOSION,
  GAS_CONFINED_SPACE,
];

export function findModuleContent(moduleId: string): TrainingModuleContent | undefined {
  return MODULE_CONTENT.find((module) => module.id === moduleId);
}
