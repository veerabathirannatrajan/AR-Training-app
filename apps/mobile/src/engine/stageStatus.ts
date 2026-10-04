import { create } from 'zustand';

/**
 * The 3D stage (canvas + WebXR, see Stage.tsx) is loaded after the first screen so the app
 * opens fast. An AR session can only start once it is mounted: the device check waits for this.
 */
export const useStageStatus = create<{ ready: boolean }>()(() => ({ ready: false }));

/** Starts loading the training engine (stage, device check, training screen, module scenes). */
export function preloadEngine(): void {
  void import('./Stage');
  void import('../screens/DeviceCheckScreen');
  void import('../screens/TrainingScreen');
  void import('../modules/scenes');
}
