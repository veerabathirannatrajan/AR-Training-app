/**
 * The virtual 4-gas monitor: what the pit contains, the entry limits and how readings are
 * judged. The numbers are illustrative; the test steps' success texts in the module content
 * quote them (readings.test.ts keeps the two in sync).
 */

export interface GasReadings {
  /** Oxygen, % volume. */
  o2: number;
  /** Flammable gas, % of the lower explosive limit. */
  lel: number;
  /** Hydrogen sulphide, ppm. */
  h2s: number;
  /** Carbon monoxide, ppm. */
  co: number;
}

export type Gas = keyof GasReadings;
export const GASES: readonly Gas[] = ['o2', 'lel', 'h2s', 'co'];

/** Monitor tests, in the order they must be done before entry. */
export type GasChannel = 'oxygen' | 'flammable' | 'toxic';
export const TEST_ORDER: readonly GasChannel[] = ['oxygen', 'flammable', 'toxic'];
export const CHANNEL_GASES: Record<GasChannel, readonly Gas[]> = {
  oxygen: ['o2'],
  flammable: ['lel'],
  toxic: ['h2s', 'co'],
};
/** The step that tests each channel. */
export const TEST_STEP: Record<GasChannel, string> = {
  oxygen: 'test-oxygen',
  flammable: 'test-flammable',
  toxic: 'test-toxic',
};

export function channelForStep(stepId: string | undefined): GasChannel | null {
  return TEST_ORDER.find((channel) => TEST_STEP[channel] === stepId) ?? null;
}

/** Fresh air, which the probe reads whenever it is not in the pit. */
export const AMBIENT: GasReadings = { o2: 20.9, lel: 0, h2s: 0, co: 0 };
/** The pit after the leak, before ventilation. */
export const PIT_BEFORE: GasReadings = { o2: 17.8, lel: 32, h2s: 18, co: 4 };
/** The pit once forced ventilation has cleared it. */
export const PIT_VENTILATED: GasReadings = { o2: 20.9, lel: 0, h2s: 0, co: 1 };

/** Acceptable entry conditions (common 4-gas monitor alarm settings; site permits take precedence). */
export const LIMITS = { o2Min: 19.5, o2Max: 23.5, lelMax: 10, h2sMax: 10, coMax: 25 } as const;

/** Seconds of forced ventilation to clear the pit completely. */
export const VENT_SECONDS = 10;
/** Sensor response: readings settle with this time constant (seconds). */
export const SENSOR_TAU = 0.45;

export type GasStatus = 'ok' | 'low' | 'high';

export function gasStatus(gas: Gas, value: number): GasStatus {
  switch (gas) {
    case 'o2':
      return value < LIMITS.o2Min ? 'low' : value > LIMITS.o2Max ? 'high' : 'ok';
    case 'lel':
      return value >= LIMITS.lelMax ? 'high' : 'ok';
    case 'h2s':
      return value >= LIMITS.h2sMax ? 'high' : 'ok';
    case 'co':
      return value >= LIMITS.coMax ? 'high' : 'ok';
  }
}

/** The worst status among a channel's gases. */
export function channelStatus(channel: GasChannel, readings: GasReadings): GasStatus {
  const statuses = CHANNEL_GASES[channel].map((gas) => gasStatus(gas, readings[gas]));
  return statuses.find((status) => status !== 'ok') ?? 'ok';
}

export function allSafe(readings: GasReadings): boolean {
  return GASES.every((gas) => gasStatus(gas, readings[gas]) === 'ok');
}

const smoothstep = (x: number) => {
  const k = Math.min(1, Math.max(0, x));
  return k * k * (3 - 2 * k);
};

/** What the pit contains, `ventSeconds` after the blower started (null: not ventilated). */
export function pitAtmosphere(ventSeconds: number | null, out: GasReadings): GasReadings {
  const k = ventSeconds == null ? 0 : smoothstep(ventSeconds / VENT_SECONDS);
  for (const gas of GASES) out[gas] = PIT_BEFORE[gas] + (PIT_VENTILATED[gas] - PIT_BEFORE[gas]) * k;
  return out;
}

/** 0 (as found) … 1 (fully cleared): how far ventilation has got. */
export function ventProgress(ventSeconds: number | null): number {
  return ventSeconds == null ? 0 : smoothstep(ventSeconds / VENT_SECONDS);
}

/** Monitor display precision: oxygen to 0.1 %, the others in whole units. */
export function roundGas(gas: Gas, value: number): number {
  return gas === 'o2' ? Math.round(value * 10) / 10 : Math.round(value);
}

export function formatGas(gas: Gas, value: number): string {
  return gas === 'o2' ? roundGas(gas, value).toFixed(1) : String(roundGas(gas, value));
}
