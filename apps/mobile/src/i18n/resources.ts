import type { LanguageCode } from '@ar-training/shared';
import enAuth from './locales/en/auth.json';
import enCommon from './locales/en/common.json';
import enHome from './locales/en/home.json';
import enTraining from './locales/en/training.json';
import hiAuth from './locales/hi/auth.json';
import hiCommon from './locales/hi/common.json';
import hiHome from './locales/hi/home.json';
import hiTraining from './locales/hi/training.json';
import satAuth from './locales/sat/auth.json';
import satCommon from './locales/sat/common.json';
import satHome from './locales/sat/home.json';
import satTraining from './locales/sat/training.json';
import { toPlainResource, type PlainTree, type ReviewedTree } from './santali';

export const NAMESPACES = ['common', 'auth', 'home', 'training'] as const;
export type Namespace = (typeof NAMESPACES)[number];

export const englishResources = {
  common: enCommon,
  auth: enAuth,
  home: enHome,
  training: enTraining,
};

/** Santali files in their review format (text + needsReview + source per string). */
export const santaliReviewed: Record<Namespace, ReviewedTree> = {
  common: satCommon,
  auth: satAuth,
  home: satHome,
  training: satTraining,
};

export const resources: Record<LanguageCode, Record<Namespace, PlainTree>> = {
  en: englishResources,
  hi: { common: hiCommon, auth: hiAuth, home: hiHome, training: hiTraining },
  sat: {
    common: toPlainResource(santaliReviewed.common),
    auth: toPlainResource(santaliReviewed.auth),
    home: toPlainResource(santaliReviewed.home),
    training: toPlainResource(santaliReviewed.training),
  },
};
