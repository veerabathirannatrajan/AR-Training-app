from datetime import datetime
from typing import Any

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class Site(Base):
    __tablename__ = "sites"

    id: Mapped[str] = mapped_column(String(8), primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    district: Mapped[str] = mapped_column(String(60))
    sector: Mapped[str] = mapped_column(String(16))  # coal | steel | mica
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)

    workers: Mapped[list["Worker"]] = relationship(back_populates="site")


class Worker(Base):
    __tablename__ = "workers"

    id: Mapped[str] = mapped_column(String(5), primary_key=True)  # 5-digit worker ID
    name: Mapped[str] = mapped_column(String(120))
    role: Mapped[str] = mapped_column(String(60))
    site_id: Mapped[str] = mapped_column(ForeignKey("sites.id"))
    preferred_language: Mapped[str] = mapped_column(String(3))  # en | hi | sat
    pin_salt: Mapped[str] = mapped_column(String(64))
    pin_hash: Mapped[str] = mapped_column(String(128))
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    failed_logins: Mapped[int] = mapped_column(Integer, default=0)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    site: Mapped[Site] = relationship(back_populates="workers")


class Admin(Base):
    """A person who signs in to the admin compliance portal."""

    __tablename__ = "admins"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(160), unique=True)
    name: Mapped[str] = mapped_column(String(120))
    password_salt: Mapped[str] = mapped_column(String(64))
    password_hash: Mapped[str] = mapped_column(String(128))
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Device(Base):
    """A phone that uploads results (one per app install)."""

    __tablename__ = "devices"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    app_version: Mapped[str] = mapped_column(String(32))
    last_sync_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    last_worker_id: Mapped[str | None] = mapped_column(ForeignKey("workers.id"), nullable=True)
    pending_count: Mapped[int] = mapped_column(Integer, default=0)
    results_uploaded: Mapped[int] = mapped_column(Integer, default=0)


class Result(Base):
    """A completed attempt at a module, uploaded by a phone (see ModuleResult in shared)."""

    __tablename__ = "results"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)  # client UUID
    session_id: Mapped[str] = mapped_column(String(36), index=True)
    worker_id: Mapped[str] = mapped_column(ForeignKey("workers.id"), index=True)
    module_id: Mapped[str] = mapped_column(String(40), index=True)
    module_version: Mapped[int] = mapped_column(Integer)
    attempt_type: Mapped[str] = mapped_column(String(12), index=True)
    mode: Mapped[str] = mapped_column(String(12))
    language: Mapped[str | None] = mapped_column(String(3), nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    score: Mapped[int] = mapped_column(Integer)
    max_score: Mapped[int] = mapped_column(Integer)
    total_percent: Mapped[int] = mapped_column(Integer)
    practical_percent: Mapped[int | None] = mapped_column(Integer, nullable=True)
    quiz_percent: Mapped[int | None] = mapped_column(Integer, nullable=True)
    passed: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    fail_reason: Mapped[str | None] = mapped_column(String(20), nullable=True)
    pass_mark: Mapped[int | None] = mapped_column(Integer, nullable=True)
    critical_errors: Mapped[list[str]] = mapped_column(JSON, default=list)
    steps: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    quiz: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    certificate_id: Mapped[str | None] = mapped_column(String(16), nullable=True)
    device_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    # "device" for real uploads, "demo-seed" for the generated demo history.
    source: Mapped[str] = mapped_column(String(12), default="device")

    worker: Mapped[Worker] = relationship()


class TrainingEventRecord(Base):
    """Step-level event log from the phones (see TrainingEvent in shared)."""

    __tablename__ = "events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    session_id: Mapped[str] = mapped_column(String(36), index=True)
    worker_id: Mapped[str] = mapped_column(ForeignKey("workers.id"), index=True)
    module_id: Mapped[str] = mapped_column(String(40))
    step_id: Mapped[str] = mapped_column(String(60))
    action: Mapped[str] = mapped_column(String(20))
    correct: Mapped[bool] = mapped_column(Boolean)
    critical: Mapped[bool] = mapped_column(Boolean)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    time_taken_ms: Mapped[int] = mapped_column(Integer)
    detail: Mapped[str | None] = mapped_column(String(120), nullable=True)


class Certificate(Base):
    __tablename__ = "certificates"

    id: Mapped[str] = mapped_column(String(16), primary_key=True)  # CERT-0001
    seq: Mapped[int] = mapped_column(Integer, unique=True)
    worker_id: Mapped[str] = mapped_column(ForeignKey("workers.id"), index=True)
    worker_name: Mapped[str] = mapped_column(String(120))
    module_id: Mapped[str] = mapped_column(String(40), index=True)
    module_version: Mapped[int] = mapped_column(Integer)
    score: Mapped[int] = mapped_column(Integer)
    issued_on: Mapped[str] = mapped_column(String(10))  # YYYY-MM-DD (IST)
    expires_on: Mapped[str] = mapped_column(String(10), index=True)
    result_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    provisional_id: Mapped[str | None] = mapped_column(String(16), nullable=True)
    hash: Mapped[str] = mapped_column(String(64), index=True)
    signature: Mapped[str] = mapped_column(String(100))
    key_id: Mapped[str] = mapped_column(String(16))
    status: Mapped[str] = mapped_column(String(12), default="valid")  # valid | revoked
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    revoked_by: Mapped[str | None] = mapped_column(String(160), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    # Blockchain anchor (see app.chain)
    anchor_status: Mapped[str] = mapped_column(String(16), default="not-anchored")
    anchor_network: Mapped[str | None] = mapped_column(String(32), nullable=True)
    anchor_tx_hash: Mapped[str | None] = mapped_column(String(80), nullable=True)
    anchor_block: Mapped[int | None] = mapped_column(Integer, nullable=True)
    anchored_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    anchor_error: Mapped[str | None] = mapped_column(Text, nullable=True)

    worker: Mapped[Worker] = relationship()


class AppSetting(Base):
    """Portal-controlled settings (pass mark, certificate validity), key → string value."""

    __tablename__ = "app_settings"

    key: Mapped[str] = mapped_column(String(60), primary_key=True)
    value: Mapped[str] = mapped_column(String(200))
