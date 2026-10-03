"""Time helpers. Timestamps are stored in UTC; certificate dates are calendar dates in India."""

from datetime import UTC, date, datetime, timedelta

IST = timedelta(hours=5, minutes=30)


def utcnow() -> datetime:
    return datetime.now(UTC)


def as_utc(value: datetime) -> datetime:
    # SQLite returns naive datetimes even for timezone-aware columns.
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)


def as_utc_or_none(value: datetime | None) -> datetime | None:
    return None if value is None else as_utc(value)


def from_ms(ms: int | float) -> datetime:
    return datetime.fromtimestamp(ms / 1000, UTC)


def to_ms(value: datetime) -> int:
    return int(as_utc(value).timestamp() * 1000)


def iso(value: datetime | None) -> str | None:
    return None if value is None else as_utc(value).isoformat().replace("+00:00", "Z")


def ist_date(value: datetime) -> str:
    """The calendar date in India at this instant, YYYY-MM-DD (matches istDate in TS)."""
    return (as_utc(value) + IST).date().isoformat()


def ist_today() -> str:
    return ist_date(utcnow())


def add_days(day: str, days: int) -> str:
    return (date.fromisoformat(day) + timedelta(days=days)).isoformat()


def days_between(start: str, end: str) -> int:
    return (date.fromisoformat(end) - date.fromisoformat(start)).days


def js_round(value: float) -> int:
    """Math.round for non-negative numbers (Python's round() rounds halves to even)."""
    return int(value + 0.5)
