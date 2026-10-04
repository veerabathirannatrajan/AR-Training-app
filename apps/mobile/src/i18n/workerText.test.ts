import i18next from 'i18next';
import { describe, expect, it } from 'vitest';
import { resources } from './resources';
import { workerText } from './workerText';

async function instance(lng: 'en' | 'hi' | 'sat') {
  const i18n = i18next.createInstance();
  await i18n.init({
    resources,
    lng,
    fallbackLng: { sat: ['hi', 'en'], hi: ['en'], default: ['en'] },
    defaultNS: 'common',
    interpolation: { escapeValue: false },
  });
  return i18n;
}

const ramesh = {
  role: 'Miner',
  siteName: 'Dhanbad Coal Site',
  district: 'Dhanbad',
  sector: 'coal',
} as const;

describe('workerText', () => {
  it('keeps the server text in English', async () => {
    expect(workerText(await instance('en'), ramesh)).toEqual({
      role: 'Miner',
      site: 'Dhanbad Coal Site',
    });
  });

  it('translates known roles and standard site names', async () => {
    expect(workerText(await instance('hi'), ramesh)).toEqual({
      role: 'खनिक',
      site: 'धनबाद कोयला साइट',
    });
  });

  it('falls back to Hindi for Santali', async () => {
    expect(workerText(await instance('sat'), ramesh).role).toBe('खनिक');
  });

  it('shows roles and sites added in the portal as entered', async () => {
    const custom = {
      role: 'Blaster',
      siteName: 'Jharia Colliery No. 4',
      district: 'Dhanbad',
      sector: 'coal',
    } as const;
    expect(workerText(await instance('hi'), custom)).toEqual({
      role: 'Blaster',
      site: 'Jharia Colliery No. 4',
    });
  });

  it('has a Hindi name for every English role, sector and district', () => {
    const { worker: en } = resources.en.common as unknown as {
      worker: Record<string, Record<string, string>>;
    };
    const { worker: hi } = resources.hi.common as unknown as {
      worker: Record<string, Record<string, string>>;
    };
    for (const group of ['roles', 'sectors', 'districts']) {
      expect(Object.keys(hi[group] ?? {}).sort()).toEqual(Object.keys(en[group] ?? {}).sort());
    }
  });
});
