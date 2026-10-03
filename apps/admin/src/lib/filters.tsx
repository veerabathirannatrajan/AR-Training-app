import { DATE_RANGES, type DateRange, type SectorFilter } from '@ar-training/shared';
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

interface Filters {
  range: DateRange;
  sector: SectorFilter;
  setRange: (range: DateRange) => void;
  setSector: (sector: SectorFilter) => void;
}

const KEY = 'armt-admin-filters';
const SECTORS: SectorFilter[] = ['all', 'coal', 'steel', 'mica'];

function load(): { range: DateRange; sector: SectorFilter } {
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? '{}') as Record<string, unknown>;
    return {
      range: DATE_RANGES.includes(raw.range as DateRange) ? (raw.range as DateRange) : '30d',
      sector: SECTORS.includes(raw.sector as SectorFilter) ? (raw.sector as SectorFilter) : 'all',
    };
  } catch {
    return { range: '30d', sector: 'all' };
  }
}

function save(value: { range: DateRange; sector: SectorFilter }) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    // not remembered
  }
}

const FiltersContext = createContext<Filters | null>(null);

/** Period and sector, shared by the dashboard, modules, assessments and reports. */
export function FiltersProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(load);
  const value = useMemo<Filters>(
    () => ({
      ...state,
      setRange: (range) =>
        setState((current) => {
          const next = { ...current, range };
          save(next);
          return next;
        }),
      setSector: (sector) =>
        setState((current) => {
          const next = { ...current, sector };
          save(next);
          return next;
        }),
    }),
    [state],
  );
  return <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>;
}

export function useFilters(): Filters {
  const filters = useContext(FiltersContext);
  if (filters == null) throw new Error('useFilters outside FiltersProvider');
  return filters;
}

export { SECTORS };
