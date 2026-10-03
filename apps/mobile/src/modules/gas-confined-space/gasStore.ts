import { create } from 'zustand';
import { AMBIENT, type GasChannel, type GasReadings } from './readings';

/**
 * Module state shared between the 3D scene and the HUD trays. Per-frame values (monitor
 * readings) are published by the scene at a low rate, like the engine's height tracker.
 */
interface GasState {
  /** What the monitor shows, rounded to display precision. */
  display: GasReadings;
  /** The probe is in the manhole (the crosshair is on it). */
  sampling: boolean;
  /** Test steps: the test chosen on the monitor (only the right one is accepted). */
  channel: GasChannel | null;
  /** Test steps: a test chosen out of order, marked until the right one is chosen. */
  wrongChannel: GasChannel | null;
  /** Permit step: the probe has been in the pit long enough for the readings to settle. */
  sampleSettled: boolean;
  /** Permit step: settled readings show the pit is safe. */
  confirmedSafe: boolean;
  /** PPE on Ravi, wrong items tried, and required items flagged after an early Ready. */
  worn: string[];
  rejected: string[];
  flagged: string[];
  /** PPE tray card picked with a first tap (a second tap puts it on). */
  preview: string | null;

  publishReadings: (display: GasReadings, sampling: boolean) => void;
  setChannel: (channel: GasChannel | null) => void;
  setWrongChannel: (channel: GasChannel | null) => void;
  setPermitCheck: (sampleSettled: boolean, confirmedSafe: boolean) => void;
  wear: (itemId: string) => void;
  reject: (itemId: string) => void;
  flag: (itemIds: readonly string[]) => void;
  setPreview: (itemId: string | null) => void;
  reset: () => void;
}

const initial = () => ({
  display: { ...AMBIENT },
  sampling: false,
  channel: null,
  wrongChannel: null,
  sampleSettled: false,
  confirmedSafe: false,
  worn: [] as string[],
  rejected: [] as string[],
  flagged: [] as string[],
  preview: null,
});

const sameReadings = (a: GasReadings, b: GasReadings) =>
  a.o2 === b.o2 && a.lel === b.lel && a.h2s === b.h2s && a.co === b.co;

export const useGasStore = create<GasState>()((set, get) => ({
  ...initial(),

  publishReadings: (display, sampling) => {
    const state = get();
    if (state.sampling === sampling && sameReadings(state.display, display)) return;
    set({ display: { ...display }, sampling });
  },
  setChannel: (channel) => set({ channel, wrongChannel: null }),
  setWrongChannel: (wrongChannel) => set({ wrongChannel }),
  setPermitCheck: (sampleSettled, confirmedSafe) => {
    const state = get();
    if (state.sampleSettled !== sampleSettled || state.confirmedSafe !== confirmedSafe)
      set({ sampleSettled, confirmedSafe });
  },
  wear: (itemId) =>
    set((state) => ({
      worn: state.worn.includes(itemId) ? state.worn : [...state.worn, itemId],
      flagged: state.flagged.filter((id) => id !== itemId),
      preview: null,
    })),
  reject: (itemId) =>
    set((state) => ({
      rejected: state.rejected.includes(itemId) ? state.rejected : [...state.rejected, itemId],
      preview: null,
    })),
  flag: (itemIds) => set({ flagged: [...itemIds] }),
  setPreview: (preview) => set({ preview }),
  reset: () => {
    gasSignals.ventStartedAt = null;
    gasSignals.lift = 0;
    set(initial());
  },
}));

export const gas = () => useGasStore.getState();

/**
 * Per-frame values several scene systems share (not React state, like the engine's
 * signals): when the blower started (performance.now() seconds, null before) and how far
 * the winch has pulled Ravi up (0..1). Cleared by reset().
 */
export const gasSignals = { ventStartedAt: null as number | null, lift: 0 };

/**
 * Where Ravi is on screen (CSS pixels), updated every frame by the scene, so the PPE tray can
 * tell whether a card was dropped on him. Mutable on purpose: it changes every frame.
 */
export const raviOnScreen = { visible: false, left: 0, right: 0, top: 0, bottom: 0 };
