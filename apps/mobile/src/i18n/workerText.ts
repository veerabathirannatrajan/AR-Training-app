import type { WorkerProfile } from '@ar-training/shared';
import type { i18n as I18n } from 'i18next';

type WorkerPlace = Pick<WorkerProfile, 'role' | 'siteName' | 'district' | 'sector'>;

/** A common-namespace string in the current language, following the fallback chain. */
function lookup(i18n: I18n, key: string): string | undefined {
  for (const lang of i18n.languages) {
    const value: unknown = i18n.getResource(lang, 'common', key);
    if (typeof value === 'string') return value;
  }
  return undefined;
}

/**
 * A worker's role and site come from the server in English. Known roles, districts and the
 * standard "<District> <Sector> Site" names are shown in the app language; anything else (a role
 * or site added in the admin portal) is shown as entered.
 */
export function workerText(i18n: I18n, worker: WorkerPlace): { role: string; site: string } {
  const role = lookup(i18n, `worker.roles.${worker.role}`) ?? worker.role;
  const sectorEn: unknown = i18n.getResource('en', 'common', `worker.sectors.${worker.sector}`);
  if (worker.siteName !== `${worker.district} ${String(sectorEn)} Site`) {
    return { role, site: worker.siteName };
  }
  const site = i18n.t('worker.siteName', {
    district: lookup(i18n, `worker.districts.${worker.district}`) ?? worker.district,
    sector: lookup(i18n, `worker.sectors.${worker.sector}`) ?? worker.sector,
  });
  return { role, site };
}
