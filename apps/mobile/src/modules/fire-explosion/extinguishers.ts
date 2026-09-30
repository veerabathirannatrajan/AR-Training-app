/** Extinguisher types in the tray, with the colour-band convention shown on the models and cards. */
export type ExtinguisherType = 'water' | 'foam' | 'co2' | 'powder';

export const EXTINGUISHER_TYPES: readonly ExtinguisherType[] = ['water', 'foam', 'co2', 'powder'];

export const EXTINGUISHER_STYLE: Record<
  ExtinguisherType,
  { band: string; spray: string; horn: boolean }
> = {
  water: { band: '#c62828', spray: '#9fd3ff', horn: false },
  foam: { band: '#f2e1a6', spray: '#fff6d8', horn: false },
  co2: { band: '#1d1f22', spray: '#eef5ff', horn: true },
  powder: { band: '#2f6fd6', spray: '#f4f0e6', horn: false },
};

export function isExtinguisherType(value: string | undefined): value is ExtinguisherType {
  return value === 'water' || value === 'foam' || value === 'co2' || value === 'powder';
}
