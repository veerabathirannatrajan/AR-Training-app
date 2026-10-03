"""Portal-controlled settings, synced to phones (pass mark, certificate validity)."""

from sqlalchemy.orm import Session

from app.models import AppSetting
from app.schemas import SyncSettings

DEFAULTS = {"passMark": 70, "certificateValidityDays": 365, "expiringSoonDays": 30}


def get_app_settings(db: Session) -> SyncSettings:
    stored = {row.key: row.value for row in db.query(AppSetting).all()}
    values = {key: int(stored.get(key, default)) for key, default in DEFAULTS.items()}
    return SyncSettings.model_validate(values)


def save_app_settings(db: Session, values: SyncSettings) -> SyncSettings:
    for key, value in values.model_dump(by_alias=True).items():
        row = db.get(AppSetting, key)
        if row is None:
            db.add(AppSetting(key=key, value=str(value)))
        else:
            row.value = str(value)
    db.commit()
    return get_app_settings(db)
