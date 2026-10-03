"""API models. JSON uses camelCase to match packages/shared (TypeScript)."""

from datetime import datetime
from typing import Any, Generic, Literal, TypeVar

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

LanguageCode = Literal["en", "hi", "sat"]
Sector = Literal["coal", "steel", "mica"]
SectorFilter = Literal["all", "coal", "steel", "mica"]
DateRange = Literal["7d", "30d", "90d", "365d", "all"]
AttemptType = Literal["practice", "assessment", "retraining"]
RenderMode = Literal["ar", "fallback3d"]
FailReason = Literal["critical-error", "below-pass-mark"]
CertificateStatus = Literal["provisional", "valid", "revoked"]
CertificateState = Literal["provisional", "valid", "expiring", "expired", "revoked"]
AnchorStatus = Literal["not-anchored", "pending", "anchored", "failed"]
Verdict = Literal["valid", "expired", "revoked", "provisional", "unknown-key", "invalid", "not-found"]
LocalizedText = dict[str, Any]

T = TypeVar("T")


class ApiModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class Page(ApiModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int


class HealthResponse(ApiModel):
    """Mirrors `HealthResponse` in packages/shared/src/api.ts."""

    status: Literal["ok"]
    service: str
    version: str
    time: str


# ---- Worker auth ------------------------------------------------------------------------------


class WorkerLoginRequest(ApiModel):
    worker_id: str = Field(pattern=r"^\d{5}$")
    pin: str = Field(pattern=r"^\d{4}$")


class WorkerProfile(ApiModel):
    worker_id: str
    name: str
    role: str
    site_id: str
    site_name: str
    district: str
    sector: Sector
    preferred_language: LanguageCode


class WorkerLoginResponse(ApiModel):
    token: str
    expires_at: datetime
    worker: WorkerProfile


# ---- Admin auth -------------------------------------------------------------------------------


class AdminLoginRequest(ApiModel):
    email: str = Field(min_length=3, max_length=160)
    password: str = Field(min_length=1, max_length=200)


class AdminProfile(ApiModel):
    id: int
    email: str
    name: str
    active: bool
    created_at: str
    last_login_at: str | None


class AdminLoginResponse(ApiModel):
    token: str
    expires_at: str
    admin: AdminProfile


class AdminCreateRequest(ApiModel):
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$", max_length=160)
    name: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=8, max_length=200)


class AdminUpdateRequest(ApiModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    active: bool | None = None
    password: str | None = Field(default=None, min_length=8, max_length=200)


# ---- Certificates -----------------------------------------------------------------------------


class CertificateAnchor(ApiModel):
    status: AnchorStatus
    network: str | None
    tx_hash: str | None
    block_number: int | None
    explorer_url: str | None
    anchored_at: str | None
    error: str | None


class CertificateOut(ApiModel):
    v: Literal[1] = 1
    id: str
    worker_id: str
    worker_name: str
    module_id: str
    score: int
    issued_on: str
    expires_on: str
    hash: str
    signature: str | None
    key_id: str | None
    status: CertificateStatus
    module_version: int
    result_id: str | None
    provisional_id: str | None
    revoked_at: str | None
    revoked_reason: str | None
    anchor: CertificateAnchor


class CertificateRow(CertificateOut):
    state: CertificateState
    site_id: str
    site_name: str
    module_title: LocalizedText


class SigningKeyOut(ApiModel):
    key_id: str
    algorithm: Literal["Ed25519"]
    public_key: str


class TrustBundle(ApiModel):
    signing_keys: list[SigningKeyOut]
    revoked_certificate_ids: list[str]
    server_time: str


class RevokeRequest(ApiModel):
    reason: str = Field(min_length=3, max_length=500)


class VerificationChecks(ApiModel):
    hash_matches: bool
    signature_valid: bool | None
    expired: bool
    revoked: bool | None


class VerifyResponse(ApiModel):
    verdict: Verdict
    certificate: CertificateRow | None
    checks: VerificationChecks | None
    checked_at: str


# ---- Sync -------------------------------------------------------------------------------------


class StepOutcomeIn(ApiModel):
    step_id: str = Field(max_length=60)
    completed: bool
    skipped: bool | None = None
    mistakes: int = Field(ge=0, le=1000)
    points: int = Field(ge=0, le=1000)
    max_points: int = Field(ge=0, le=1000)
    time_taken_ms: int = Field(ge=0)
    critical: bool
    critical_error_ids: list[str] | None = None


class QuizAnswerIn(ApiModel):
    question_id: str = Field(max_length=60)
    option_id: str = Field(max_length=60)
    correct: bool


class ModuleResultIn(ApiModel):
    id: str = Field(min_length=8, max_length=36)
    session_id: str = Field(min_length=8, max_length=36)
    worker_id: str = Field(pattern=r"^\d{5}$")
    module_id: str = Field(max_length=40)
    module_version: int
    mode: RenderMode
    attempt_type: AttemptType | None = None
    started_at: int
    completed_at: int
    score: int = Field(ge=0)
    max_score: int = Field(ge=0)
    practical_percent: int | None = None
    quiz_percent: int | None = None
    total_percent: int | None = None
    passed: bool | None
    fail_reason: FailReason | None = None
    critical_errors: list[str] | None = None
    quiz: list[QuizAnswerIn] | None = None
    steps: list[StepOutcomeIn] = Field(max_length=100)
    language: LanguageCode | None = None
    pass_mark: int | None = None


class TrainingSessionIn(ApiModel):
    id: str
    worker_id: str
    module_id: str
    module_version: int
    mode: RenderMode
    attempt_type: AttemptType | None = None
    started_at: int
    ended_at: int | None
    status: str


class TrainingEventIn(ApiModel):
    id: str = Field(min_length=8, max_length=36)
    session_id: str
    worker_id: str
    module_id: str
    step_id: str = Field(max_length=60)
    action: str = Field(max_length=20)
    correct: bool
    critical: bool
    timestamp: int
    time_taken_ms: int
    detail: str | None = Field(default=None, max_length=120)


class SyncItem(ApiModel):
    result: ModuleResultIn
    session: TrainingSessionIn | None = None
    events: list[TrainingEventIn] = Field(default_factory=list, max_length=500)


class SyncRequest(ApiModel):
    device_id: str = Field(min_length=8, max_length=64)
    app_version: str = Field(max_length=32)
    pending_count: int = Field(ge=0)
    items: list[SyncItem] = Field(default_factory=list, max_length=50)


class SyncSettings(ApiModel):
    pass_mark: int = Field(ge=40, le=100)
    certificate_validity_days: int = Field(ge=30, le=1825)
    expiring_soon_days: int = Field(ge=7, le=180)


class SyncedResult(ApiModel):
    result_id: str
    status: Literal["accepted", "duplicate", "rejected"]
    reason: str | None
    passed: bool | None
    fail_reason: FailReason | None
    certificate_id: str | None


class SyncResponse(ApiModel):
    results: list[SyncedResult]
    certificates: list[CertificateOut]
    revoked_certificate_ids: list[str]
    signing_keys: list[SigningKeyOut]
    settings: SyncSettings
    server_time: str


# ---- Sites ------------------------------------------------------------------------------------


class SiteOut(ApiModel):
    id: str
    name: str
    district: str
    sector: Sector
    latitude: float
    longitude: float
    workers: int


class SiteCreateRequest(ApiModel):
    id: str = Field(pattern=r"^[A-Z]{3,6}$")
    name: str = Field(min_length=2, max_length=120)
    district: str = Field(min_length=2, max_length=60)
    sector: Sector
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class SiteUpdateRequest(ApiModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    district: str | None = Field(default=None, min_length=2, max_length=60)
    sector: Sector | None = None
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)


# ---- Analytics --------------------------------------------------------------------------------


class Kpis(ApiModel):
    workers_registered: int
    workers_new: int
    certified_workers: int
    certified_percent: float
    valid_certificates: int
    anchored_certificates: int
    avg_score: int | None
    assessments: int
    pass_rate: int | None
    expiring_soon: int


class SiteOverview(ApiModel):
    id: str
    name: str
    district: str
    sector: Sector
    latitude: float
    longitude: float
    workers: int
    certified: int
    compliance_percent: int
    avg_score: int | None
    assessments: int


class ModuleStats(ApiModel):
    module_id: str
    title: LocalizedText
    kind: Literal["tutorial", "assessed"]
    version: int
    assessments: int
    workers_attempted: int
    pass_rate: int | None
    avg_score: int | None
    certified_workers: int
    avg_duration_seconds: int | None


class StepStat(ApiModel):
    module_id: str
    step_id: str
    title: LocalizedText
    attempts: int
    workers: int
    workers_with_mistakes: int
    clean_rate: int
    avg_mistakes: float
    critical_count: int


class CriticalErrorStat(ApiModel):
    module_id: str
    error_id: str
    title: LocalizedText
    count: int
    workers: int


class Insight(ApiModel):
    id: str
    kind: Literal[
        "step-failures", "critical-errors", "not-certified", "expiring", "low-site",
        "pending-sync", "all-good",
    ]
    tone: Literal["info", "warn", "critical", "ok"]
    params: dict[str, str | int]
    labels: dict[str, LocalizedText]


class AssessmentRow(ApiModel):
    result_id: str
    worker_id: str
    worker_name: str
    site_id: str
    site_name: str
    district: str
    module_id: str
    module_title: LocalizedText
    attempt_type: AttemptType
    attempt_number: int
    score: int
    practical_percent: int | None
    quiz_percent: int | None
    passed: bool | None
    fail_reason: FailReason | None
    critical_errors: list[str]
    language: LanguageCode | None
    mode: RenderMode
    started_at: str
    completed_at: str
    certificate_id: str | None


class AssessmentStep(ApiModel):
    step_id: str
    title: LocalizedText
    completed: bool
    skipped: bool
    mistakes: int
    points: int
    max_points: int
    time_taken_ms: int
    critical: bool
    critical_errors: list[LocalizedText]


class AssessmentQuizAnswer(ApiModel):
    question_id: str
    prompt: LocalizedText
    correct: bool


class AssessmentDetail(AssessmentRow):
    steps: list[AssessmentStep]
    quiz: list[AssessmentQuizAnswer]


class SyncOverview(ApiModel):
    results_synced: int
    pending_on_devices: int
    devices: int
    last_sync_at: str | None


class DashboardResponse(ApiModel):
    range: DateRange
    sector: SectorFilter
    kpis: Kpis
    sites: list[SiteOverview]
    modules: list[ModuleStats]
    insights: list[Insight]
    common_mistakes: list[StepStat]
    critical_errors: list[CriticalErrorStat]
    sync: SyncOverview
    settings: SyncSettings


class QuizStat(ApiModel):
    question_id: str
    prompt: LocalizedText
    answered: int
    correct_rate: int | None


class TrendPoint(ApiModel):
    month: str
    assessments: int
    pass_rate: int | None
    avg_score: int | None


class ModuleDetail(ModuleStats):
    summary: LocalizedText
    estimated_minutes: int
    steps: list[StepStat]
    critical_errors: list[CriticalErrorStat]
    quiz: list[QuizStat]
    score_buckets: list[int]
    trend: list[TrendPoint]


# ---- Workers ----------------------------------------------------------------------------------


class WorkerCertificateBadge(ApiModel):
    module_id: str
    certificate_id: str
    state: CertificateState
    expires_on: str


class WorkerRow(ApiModel):
    worker_id: str
    name: str
    role: str
    site_id: str
    site_name: str
    district: str
    sector: Sector
    preferred_language: LanguageCode
    active: bool
    created_at: str
    last_activity_at: str | None
    assessments: int
    avg_score: int | None
    modules_certified: int
    modules_total: int
    certificates: list[WorkerCertificateBadge]
    certification: Literal["certified", "partial", "expiring", "not-certified"]


class StepMasteryRow(ApiModel):
    step_id: str
    title: LocalizedText
    attempts: int
    clean: int
    mastery: int


class ModuleMastery(ApiModel):
    module_id: str
    title: LocalizedText
    steps: list[StepMasteryRow]


class WorkerDetail(WorkerRow):
    locked_until: str | None
    attempts: list[AssessmentRow]
    certificate_list: list[CertificateOut]
    mastery: list[ModuleMastery]


class WorkerCreateRequest(ApiModel):
    name: str = Field(min_length=2, max_length=120)
    role: str = Field(min_length=2, max_length=60)
    site_id: str
    preferred_language: LanguageCode
    pin: str = Field(pattern=r"^\d{4}$")


class WorkerUpdateRequest(ApiModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    role: str | None = Field(default=None, min_length=2, max_length=60)
    site_id: str | None = None
    preferred_language: LanguageCode | None = None
    active: bool | None = None
    pin: str | None = Field(default=None, pattern=r"^\d{4}$")


# ---- Blockchain and devices -------------------------------------------------------------------


class ChainStatus(ApiModel):
    adapter: Literal["stub", "polygon-amoy"]
    configured: bool
    network: str
    chain_id: int | None
    address: str | None
    balance: str | None
    explorer_url: str | None
    message: str | None


class AnchorRow(ApiModel):
    certificate_id: str
    worker_name: str
    module_id: str
    hash: str
    status: AnchorStatus
    tx_hash: str | None
    block_number: int | None
    explorer_url: str | None
    anchored_at: str | None
    error: str | None
    issued_on: str


class AnchorRunResponse(ApiModel):
    attempted: int
    anchored: int
    pending: int
    failed: int
    message: str | None


class DeviceRow(ApiModel):
    device_id: str
    app_version: str
    last_sync_at: str
    last_worker_id: str | None
    last_worker_name: str | None
    pending_count: int
    results_uploaded: int
