from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String
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
