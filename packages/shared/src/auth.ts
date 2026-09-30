import type { LanguageCode } from './languages';

export type Sector = 'coal' | 'steel' | 'mica';

/** Worker IDs are 5 digits so they can be typed on a numeric keypad. */
export const WORKER_ID_PATTERN = /^\d{5}$/;
export const PIN_LENGTH = 4;
export const PIN_PATTERN = /^\d{4}$/;

export interface WorkerLoginRequest {
  workerId: string;
  pin: string;
}

export interface WorkerProfile {
  workerId: string;
  name: string;
  role: string;
  siteId: string;
  siteName: string;
  district: string;
  sector: Sector;
  preferredLanguage: LanguageCode;
}

/** POST /api/auth/worker/login */
export interface WorkerLoginResponse {
  token: string;
  /** ISO timestamp. */
  expiresAt: string;
  worker: WorkerProfile;
}

export type ApiErrorCode = 'invalid-credentials' | 'locked' | 'inactive' | 'validation';

/** Body of every non-2xx API response. */
export interface ApiErrorBody {
  detail: {
    code: ApiErrorCode;
    message: string;
    retryAfterSeconds?: number;
  };
}
