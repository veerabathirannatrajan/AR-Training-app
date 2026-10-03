import type { LanguageCode } from './languages';
import type { Sector } from './auth';
import type {
  AnchorStatus,
  Certificate,
  CertificateState,
  VerificationChecks,
  VerificationVerdict,
} from './certificates';
import type { LocalizedText, ModuleKind } from './content';
import type { AttemptType } from './results';
import type { RenderMode } from './render';
import type { SyncSettings } from './sync';

// ---- Auth ------------------------------------------------------------------------------------

export interface AdminLoginRequest {
  email: string;
  password: string;
}

export interface AdminProfile {
  id: number;
  email: string;
  name: string;
  active: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

/** POST /api/auth/admin/login */
export interface AdminLoginResponse {
  token: string;
  expiresAt: string;
  admin: AdminProfile;
}

export interface AdminCreateRequest {
  email: string;
  name: string;
  password: string;
}

export interface AdminUpdateRequest {
  name?: string;
  active?: boolean;
  password?: string;
}

// ---- Common ----------------------------------------------------------------------------------

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** Period filter used across the portal. */
export const DATE_RANGES = ['7d', '30d', '90d', '365d', 'all'] as const;
export type DateRange = (typeof DATE_RANGES)[number];
export type SectorFilter = Sector | 'all';

// ---- Sites -----------------------------------------------------------------------------------

export interface Site {
  id: string;
  name: string;
  district: string;
  sector: Sector;
  latitude: number;
  longitude: number;
  workers: number;
}

export interface SiteCreateRequest {
  id: string;
  name: string;
  district: string;
  sector: Sector;
  latitude: number;
  longitude: number;
}

export type SiteUpdateRequest = Partial<Omit<SiteCreateRequest, 'id'>>;

// ---- Dashboard and analytics -----------------------------------------------------------------

export interface Kpis {
  workersRegistered: number;
  /** Registered during the selected period. */
  workersNew: number;
  /** Workers holding at least one valid (unexpired, unrevoked) certificate. */
  certifiedWorkers: number;
  certifiedPercent: number;
  validCertificates: number;
  anchoredCertificates: number;
  /** Average assessment score in the period, percent. */
  avgScore: number | null;
  assessments: number;
  passRate: number | null;
  /** Valid certificates expiring within `expiringSoonDays`. */
  expiringSoon: number;
}

export interface SiteOverview {
  id: string;
  name: string;
  district: string;
  sector: Sector;
  latitude: number;
  longitude: number;
  workers: number;
  certified: number;
  /** Certified workers / workers, percent. */
  compliancePercent: number;
  avgScore: number | null;
  assessments: number;
}

export interface ModuleStats {
  moduleId: string;
  title: LocalizedText;
  kind: ModuleKind;
  version: number;
  assessments: number;
  workersAttempted: number;
  /** Percent of assessments passed. */
  passRate: number | null;
  avgScore: number | null;
  certifiedWorkers: number;
  avgDurationSeconds: number | null;
}

export interface StepStat {
  moduleId: string;
  stepId: string;
  title: LocalizedText;
  /** Attempts that included this step. */
  attempts: number;
  workers: number;
  /** Workers who made a mistake or a critical error on this step at least once. */
  workersWithMistakes: number;
  /** Share of attempts done right first time, percent. */
  cleanRate: number;
  avgMistakes: number;
  criticalCount: number;
}

export interface CriticalErrorStat {
  moduleId: string;
  errorId: string;
  title: LocalizedText;
  count: number;
  workers: number;
}

export type InsightKind =
  | 'step-failures'
  | 'critical-errors'
  | 'not-certified'
  | 'expiring'
  | 'low-site'
  | 'pending-sync'
  | 'all-good';

/** Rule-based insight; the portal turns `kind` + `params` into a sentence in its language. */
export interface Insight {
  id: string;
  kind: InsightKind;
  tone: 'info' | 'warn' | 'critical' | 'ok';
  params: Record<string, string | number>;
  /** Module or step titles referenced by the params. */
  labels: Record<string, LocalizedText>;
}

export interface AssessmentRow {
  resultId: string;
  workerId: string;
  workerName: string;
  siteId: string;
  siteName: string;
  district: string;
  moduleId: string;
  moduleTitle: LocalizedText;
  attemptType: AttemptType;
  /** This was the worker's n-th assessment of the module. */
  attemptNumber: number;
  score: number;
  practicalPercent: number | null;
  quizPercent: number | null;
  passed: boolean | null;
  failReason: 'critical-error' | 'below-pass-mark' | null;
  criticalErrors: string[];
  language: LanguageCode | null;
  mode: RenderMode;
  startedAt: string;
  completedAt: string;
  certificateId: string | null;
}

export interface AssessmentStep {
  stepId: string;
  title: LocalizedText;
  completed: boolean;
  skipped: boolean;
  mistakes: number;
  points: number;
  maxPoints: number;
  timeTakenMs: number;
  critical: boolean;
  criticalErrors: LocalizedText[];
}

export interface AssessmentDetail extends AssessmentRow {
  steps: AssessmentStep[];
  quiz: { questionId: string; prompt: LocalizedText; correct: boolean }[];
}

export interface SyncOverview {
  /** Results received from phones in the period. */
  resultsSynced: number;
  /** Results phones reported as still waiting to upload (at their last sync). */
  pendingOnDevices: number;
  devices: number;
  lastSyncAt: string | null;
}

export interface DashboardResponse {
  range: DateRange;
  sector: SectorFilter;
  kpis: Kpis;
  sites: SiteOverview[];
  modules: ModuleStats[];
  insights: Insight[];
  commonMistakes: StepStat[];
  criticalErrors: CriticalErrorStat[];
  sync: SyncOverview;
  settings: SyncSettings;
}

export interface ModuleDetail extends ModuleStats {
  summary: LocalizedText;
  estimatedMinutes: number;
  steps: StepStat[];
  criticalErrors: CriticalErrorStat[];
  quiz: {
    questionId: string;
    prompt: LocalizedText;
    answered: number;
    correctRate: number | null;
  }[];
  /** Assessment score histogram in 10-point buckets (0–9 … 90–100). */
  scoreBuckets: number[];
  /** Monthly pass rate trend. */
  trend: { month: string; assessments: number; passRate: number | null; avgScore: number | null }[];
}

// ---- Workers ---------------------------------------------------------------------------------

export type CertificationState = 'certified' | 'partial' | 'expiring' | 'not-certified';

export interface WorkerCertificateBadge {
  moduleId: string;
  certificateId: string;
  state: CertificateState;
  expiresOn: string;
}

export interface WorkerRow {
  workerId: string;
  name: string;
  role: string;
  siteId: string;
  siteName: string;
  district: string;
  sector: Sector;
  preferredLanguage: LanguageCode;
  active: boolean;
  createdAt: string;
  lastActivityAt: string | null;
  assessments: number;
  avgScore: number | null;
  /** Assessed modules with a valid certificate. */
  modulesCertified: number;
  modulesTotal: number;
  certificates: WorkerCertificateBadge[];
  certification: CertificationState;
}

export interface StepMasteryRow {
  stepId: string;
  title: LocalizedText;
  attempts: number;
  clean: number;
  /** Percent. */
  mastery: number;
}

export interface WorkerDetail extends WorkerRow {
  lockedUntil: string | null;
  attempts: AssessmentRow[];
  certificateList: Certificate[];
  mastery: { moduleId: string; title: LocalizedText; steps: StepMasteryRow[] }[];
}

export interface WorkerCreateRequest {
  name: string;
  role: string;
  siteId: string;
  preferredLanguage: LanguageCode;
  /** 4 digits. */
  pin: string;
}

export interface WorkerUpdateRequest {
  name?: string;
  role?: string;
  siteId?: string;
  preferredLanguage?: LanguageCode;
  active?: boolean;
  /** Sets a new PIN and clears any lockout. */
  pin?: string;
}

// ---- Certificates ----------------------------------------------------------------------------

export interface CertificateRow extends Certificate {
  state: CertificateState;
  siteId: string;
  siteName: string;
  moduleTitle: LocalizedText;
}

export interface RevokeRequest {
  reason: string;
}

/** GET /api/verify/{id} and POST /api/verify (QR text). Public. */
export interface VerifyResponse {
  verdict: VerificationVerdict | 'not-found';
  certificate: CertificateRow | null;
  checks: VerificationChecks | null;
  checkedAt: string;
}

// ---- Blockchain ------------------------------------------------------------------------------

export interface ChainStatus {
  /** `stub`: anchoring is off until a Polygon Amoy wallet is configured on the API. */
  adapter: 'stub' | 'polygon-amoy';
  configured: boolean;
  network: string;
  chainId: number | null;
  address: string | null;
  /** Wallet balance in POL, when reachable. */
  balance: string | null;
  explorerUrl: string | null;
  message: string | null;
}

export interface AnchorRow {
  certificateId: string;
  workerName: string;
  moduleId: string;
  hash: string;
  status: AnchorStatus;
  txHash: string | null;
  blockNumber: number | null;
  explorerUrl: string | null;
  anchoredAt: string | null;
  error: string | null;
  issuedOn: string;
}

export interface AnchorRunResponse {
  attempted: number;
  anchored: number;
  pending: number;
  failed: number;
  message: string | null;
}

// ---- Devices ---------------------------------------------------------------------------------

export interface DeviceRow {
  deviceId: string;
  appVersion: string;
  lastSyncAt: string;
  lastWorkerId: string | null;
  lastWorkerName: string | null;
  pendingCount: number;
  resultsUploaded: number;
}

// ---- Settings --------------------------------------------------------------------------------

export type AppSettings = SyncSettings;
