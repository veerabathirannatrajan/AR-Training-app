import type { LanguageCode } from '@ar-training/shared';
import enAuth from './locales/en/auth.json';
import enCertificates from './locales/en/certificates.json';
import enCommon from './locales/en/common.json';
import enFire from './locales/en/fire.json';
import enGas from './locales/en/gas.json';
import enHome from './locales/en/home.json';
import enTraining from './locales/en/training.json';
import hiAuth from './locales/hi/auth.json';
import hiCertificates from './locales/hi/certificates.json';
import hiCommon from './locales/hi/common.json';
import hiFire from './locales/hi/fire.json';
import hiGas from './locales/hi/gas.json';
import hiHome from './locales/hi/home.json';
import hiTraining from './locales/hi/training.json';
import satAuth from './locales/sat/auth.json';
import satCertificates from './locales/sat/certificates.json';
import satCommon from './locales/sat/common.json';
import satFire from './locales/sat/fire.json';
import satGas from './locales/sat/gas.json';
import satHome from './locales/sat/home.json';
import satTraining from './locales/sat/training.json';
import { toPlainResource, type PlainTree, type ReviewedTree } from './santali';

export const NAMESPACES = [
  'common',
  'auth',
  'home',
  'training',
  'fire',
  'gas',
  'certificates',
] as const;
export type Namespace = (typeof NAMESPACES)[number];

export const englishResources = {
  common: enCommon,
  auth: enAuth,
  home: enHome,
  training: enTraining,
  fire: enFire,
  gas: enGas,
  certificates: enCertificates,
};

/** Santali files in their review format (text + needsReview + source per string). */
export const santaliReviewed: Record<Namespace, ReviewedTree> = {
  common: satCommon,
  auth: satAuth,
  home: satHome,
  training: satTraining,
  fire: satFire,
  gas: satGas,
  // No Santali yet: these strings fall back to Hindi until a native speaker translates them.
  certificates: satCertificates,
};

export const resources: Record<LanguageCode, Record<Namespace, PlainTree>> = {
  en: englishResources,
  hi: {
    common: hiCommon,
    auth: hiAuth,
    home: hiHome,
    training: hiTraining,
    fire: hiFire,
    gas: hiGas,
    certificates: hiCertificates,
  },
  sat: {
    common: toPlainResource(santaliReviewed.common),
    auth: toPlainResource(santaliReviewed.auth),
    home: toPlainResource(santaliReviewed.home),
    training: toPlainResource(santaliReviewed.training),
    fire: toPlainResource(santaliReviewed.fire),
    gas: toPlainResource(santaliReviewed.gas),
    certificates: toPlainResource(santaliReviewed.certificates),
  },
};
