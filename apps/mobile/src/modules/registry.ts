import {
  AR_BASICS,
  FIRE_EXPLOSION,
  GAS_CONFINED_SPACE,
  type TrainingModuleContent,
} from '@ar-training/shared';
import { Flame, Hand, Wind, type LucideIcon } from 'lucide-react';
import { lazy, type ComponentType } from 'react';
import type { OrientationNeed } from '../app/orientation';
import type { FallbackView } from '../engine/fallback/view';
import type { HoldLabel } from '../engine/hud/controls';
import { FireOverlay, FireTray } from './fire-explosion/FireHud';
import { FIRE_ILLUSTRATIONS } from './fire-explosion/illustrationMap';
import { GasOverlay, GasTray } from './gas-confined-space/GasHud';
import { GAS_ILLUSTRATIONS } from './gas-confined-space/illustrationMap';

// 3D scenes load with the engine, after the first screen (see engine/stageStatus.ts).
const scenes = () => import('./scenes');
const ArBasicsScene = lazy(() => scenes().then((module) => ({ default: module.ArBasicsScene })));
const FireScene = lazy(() => scenes().then((module) => ({ default: module.FireScene })));
const GasScene = lazy(() => scenes().then((module) => ({ default: module.GasScene })));

/** HUD controls a step needs besides the instruction card. */
export interface StepUi {
  /** Centre crosshair for aiming with the phone. */
  crosshair?: boolean;
  /** Large press-and-hold button. */
  hold?: boolean;
  holdLabel?: HoldLabel;
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
  /** Screen orientation while training (locked in the installed app). Defaults to portrait. */
  orientation?: OrientationNeed;
}

export const MODULES: readonly ModuleDefinition[] = [
  {
    content: AR_BASICS,
    Scene: ArBasicsScene,
    icon: Hand,
    accent: '#2f80ed',
    // Simple one-control steps: works held either way.
    orientation: 'any',
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
    // HUD (instruction card, P-A-S-S dots, extinguisher tray) is laid out for portrait.
    orientation: 'portrait',
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
  {
    content: GAS_CONFINED_SPACE,
    Scene: GasScene,
    Tray: GasTray,
    Overlay: GasOverlay,
    icon: Wind,
    accent: '#0f8b8d',
    // Gas-monitor and PPE trays are laid out for portrait.
    orientation: 'portrait',
    stepUi: {
      'identify-zones': { progress: true },
      'go-upwind': { options: 'scene' },
      'test-oxygen': { crosshair: true, progress: true, moduleTray: true },
      'test-flammable': { crosshair: true, progress: true, moduleTray: true },
      'test-toxic': { crosshair: true, progress: true, moduleTray: true },
      'sign-permit': { crosshair: true, moduleTray: true },
      'dress-entrant': { options: 'scene', moduleTray: true },
      'comms-check': { hold: true, holdLabel: 'talk', progress: true },
      'winch-rescue': { hold: true, holdLabel: 'winch', progress: true },
    },
    illustrations: GAS_ILLUSTRATIONS,
    // High enough to see both gathering points and the windsock on a portrait screen.
    fallbackView: { position: [0.05, 3.3, 2.5], target: [0.05, 0.1, -0.45] },
  },
];

export function findModule(moduleId: string): ModuleDefinition | undefined {
  return MODULES.find((module) => module.content.id === moduleId);
}
