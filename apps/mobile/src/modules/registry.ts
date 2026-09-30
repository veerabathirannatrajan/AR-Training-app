import { AR_BASICS, FIRE_EXPLOSION, type TrainingModuleContent } from '@ar-training/shared';
import { Flame, Hand, type LucideIcon } from 'lucide-react';
import type { ComponentType } from 'react';
import type { FallbackView } from '../engine/fallback/view';
import { ArBasicsScene } from './ar-basics/ArBasicsScene';
import { FireOverlay, FireTray } from './fire-explosion/FireHud';
import { FireScene } from './fire-explosion/FireScene';
import { FIRE_ILLUSTRATIONS } from './fire-explosion/illustrationMap';

/** HUD controls a step needs besides the instruction card. */
export interface StepUi {
  /** Centre crosshair for aiming with the phone. */
  crosshair?: boolean;
  /** Large press-and-hold button. */
  hold?: boolean;
  holdLabel?: 'hold' | 'squeeze';
  /** Crouch meter (AR) / Crouch button (3D mode). */
  crouch?: boolean;
  /** Press-and-hold Move button (walking along a route). */
  move?: boolean;
  /** Show the runner's step progress bar. */
  progress?: boolean;
  /**
   * Decision steps: `panel` shows the generic answer card (the default for steps with
   * options); `scene` means the choice is made in the 3D scene or the module's tray.
   */
  options?: 'panel' | 'scene';
  /** Show the module's own tray instead of the standard control tray. */
  moduleTray?: boolean;
}

export interface ModuleDefinition {
  content: TrainingModuleContent;
  /** 3D content, rendered inside the placed training area (y = 0 is the floor). */
  Scene: ComponentType;
  /** Module-specific tray (shown for steps with `moduleTray`). */
  Tray?: ComponentType;
  /** Module-specific chips shown above the tray (e.g. smoke warnings). */
  Overlay?: ComponentType;
  icon: LucideIcon;
  /** Tile colour on the home screen. */
  accent: string;
  stepUi: Readonly<Record<string, StepUi>>;
  /** Choices assumed for steps skipped during retraining (e.g. the extinguisher in hand). */
  defaultFacts?: Readonly<Record<string, string>>;
  /** Quiz illustrations by id (see QuizQuestion.illustration). */
  illustrations?: Readonly<Record<string, ComponentType>>;
  /** 3D-mode starting camera, framing the module's training area. */
  fallbackView?: FallbackView;
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
  {
    content: FIRE_EXPLOSION,
    Scene: FireScene,
    Tray: FireTray,
    Overlay: FireOverlay,
    icon: Flame,
    accent: '#e8590c',
    stepUi: {
      'choose-extinguisher': { options: 'scene', moduleTray: true },
      'pass-aim': { crosshair: true, progress: true },
      'pass-squeeze': { crosshair: true, hold: true, holdLabel: 'squeeze', progress: true },
      'pass-sweep': { crosshair: true, hold: true, holdLabel: 'squeeze', progress: true },
      'crouch-smoke': { crouch: true, progress: true },
      'move-exit': { move: true, crouch: true, progress: true },
      'choose-exit': { options: 'scene' },
      'reach-assembly': { move: true, crouch: true, progress: true },
    },
    illustrations: FIRE_ILLUSTRATIONS,
    fallbackView: { position: [0.1, 2.0, 3.0], target: [0, 0.7, -0.45] },
    defaultFacts: {
      'identify-fire': 'electrical',
      'choose-extinguisher': 'co2',
      'choose-exit': 'exit-b',
    },
  },
];

export function findModule(moduleId: string): ModuleDefinition | undefined {
  return MODULES.find((module) => module.content.id === moduleId);
}
