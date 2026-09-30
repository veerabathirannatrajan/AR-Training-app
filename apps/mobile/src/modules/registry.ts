import { AR_BASICS, type TrainingModuleContent } from '@ar-training/shared';
import { Hand, type LucideIcon } from 'lucide-react';
import type { ComponentType } from 'react';
import { ArBasicsScene } from './ar-basics/ArBasicsScene';

/** HUD controls a step needs besides the instruction card. */
export interface StepUi {
  /** Centre crosshair for aiming with the phone. */
  crosshair?: boolean;
  /** Large press-and-hold button. */
  hold?: boolean;
  /** Crouch meter (AR) / Crouch button (3D mode). */
  crouch?: boolean;
  /** Show the runner's step progress bar. */
  progress?: boolean;
}

export interface ModuleDefinition {
  content: TrainingModuleContent;
  /** 3D content, rendered inside the placed training area (y = 0 is the floor). */
  Scene: ComponentType;
  icon: LucideIcon;
  /** Tile colour on the home screen. */
  accent: string;
  stepUi: Readonly<Record<string, StepUi>>;
}

export const MODULES: readonly ModuleDefinition[] = [
  {
    content: AR_BASICS,
    Scene: ArBasicsScene,
    icon: Hand,
    accent: '#2f80ed',
    stepUi: {
      rotate: { progress: true },
      'aim-target': { crosshair: true, progress: true },
      'hold-target': { crosshair: true, hold: true, progress: true },
      crouch: { crouch: true, progress: true },
    },
  },
];

export function findModule(moduleId: string): ModuleDefinition | undefined {
  return MODULES.find((module) => module.content.id === moduleId);
}
