"""Demo data: 4 Jharkhand sites, 48 workers, a portal admin and a training history.

Every demo worker's PIN is 1234; the demo admin is admin@test.com / admin1234 (see config).
Run manually with `python -m app.seed [--reset] [--no-history]` (from services/api), or let the
API seed an empty database on startup (disable with ARMT_SEED_DEMO=0, or only the generated
training history with ARMT_SEED_HISTORY=0).
"""

import sys
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.db import Base, SessionLocal, engine, init_db
from app.demo_history import seed_history
from app.models import Admin, Site, Worker
from app.security import hash_password, hash_pin, new_salt

DEMO_PIN = "1234"

# (id, name, district, sector, latitude, longitude, worker-id prefix)
SITES = [
    ("DHN", "Dhanbad Coal Site", "Dhanbad", "coal", 23.7957, 86.4304, "11"),
    ("BKR", "Bokaro Steel Site", "Bokaro", "steel", 23.6693, 86.1511, "12"),
    ("RNC", "Ranchi Coal Site", "Ranchi", "coal", 23.3441, 85.3096, "13"),
    ("KDM", "Koderma Mica Site", "Koderma", "mica", 24.4677, 85.5949, "14"),
]

ROLES = {
    "coal": ["Miner", "Shot-firer", "Dumper operator", "Electrician", "Fitter", "Loader",
             "Pump operator", "Helper"],
    "steel": ["Furnace operator", "Crane operator", "Fitter", "Electrician", "Rigger", "Welder",
              "Gas cutter", "Helper"],
    "mica": ["Mica cutter", "Sorter", "Driller", "Loader", "Helper", "Splitter",
             "Machine operator", "Packer"],
}
SUPERVISOR_ROLE = {"coal": "Mining sirdar", "steel": "Shift supervisor", "mica": "Site supervisor"}

# 12 workers per site, in SITES order; the last of each group is the site supervisor.
WORKERS = [
    # Dhanbad
    ("Ramesh Mahto", "hi"), ("Sunita Devi", "hi"), ("Birsa Murmu", "sat"),
    ("Phulmani Hansda", "sat"), ("Anil Kumar Singh", "hi"), ("Lakhan Soren", "sat"),
    ("Manoj Yadav", "hi"), ("Salomi Tudu", "sat"), ("Deepak Ravidas", "hi"),
    ("Budhan Kisku", "sat"), ("Pooja Kumari", "hi"), ("Vijay Prasad", "en"),
    # Bokaro
    ("Sanjay Gope", "hi"), ("Anita Mandal", "hi"), ("Somra Besra", "sat"),
    ("Rajesh Kumar", "hi"), ("Basanti Marandi", "sat"), ("Suresh Mahato", "hi"),
    ("Rina Hembrom", "sat"), ("Ajay Pandey", "hi"), ("Mangal Baskey", "sat"),
    ("Mamta Kumari", "hi"), ("Jitu Tudu", "sat"), ("Arvind Sinha", "en"),
    # Ranchi
    ("Birendra Munda", "hi"), ("Sushila Oraon", "hi"), ("Etwa Toppo", "hi"),
    ("Lalita Kujur", "hi"), ("Mahesh Lakra", "hi"), ("Sukhmani Tirkey", "hi"),
    ("Sombari Minz", "hi"), ("Ravi Ekka", "hi"), ("Chamru Soren", "sat"),
    ("Sita Murmu", "sat"), ("Pradeep Kachhap", "hi"), ("Nirmala Xalxo", "en"),
    # Koderma
    ("Shankar Yadav", "hi"), ("Kavita Devi", "hi"), ("Dukhan Rana", "hi"),
    ("Reshma Khatoon", "hi"), ("Bablu Saw", "hi"), ("Parvati Kumari", "hi"),
    ("Kailash Turi", "hi"), ("Meena Bhuiyan", "hi"), ("Sunil Hansda", "sat"),
    ("Mary Hembrom", "sat"), ("Gopal Rajak", "hi"), ("Ashok Mehta", "en"),
]

WORKERS_PER_SITE = 12


def seed(session: Session) -> int:
    """Adds any missing demo sites/workers. Returns the number of workers created."""
    now = datetime.now(UTC)
    created = 0
    for site_index, (site_id, name, district, sector, lat, lng, prefix) in enumerate(SITES):
        if session.get(Site, site_id) is None:
            session.add(Site(id=site_id, name=name, district=district, sector=sector,
                             latitude=lat, longitude=lng))
        group = WORKERS[site_index * WORKERS_PER_SITE:(site_index + 1) * WORKERS_PER_SITE]
        for offset, (worker_name, language) in enumerate(group):
            worker_id = f"{prefix}{offset + 1:03d}"
            if session.get(Worker, worker_id) is not None:
                continue
            is_supervisor = offset == WORKERS_PER_SITE - 1
            roles = ROLES[sector]
            salt = new_salt()
            session.add(Worker(
                id=worker_id,
                name=worker_name,
                role=SUPERVISOR_ROLE[sector] if is_supervisor else roles[offset % len(roles)],
                site_id=site_id,
                preferred_language=language,
                pin_salt=salt,
                pin_hash=hash_pin(DEMO_PIN, salt),
                active=True,
                failed_logins=0,
                created_at=now,
            ))
            created += 1
    session.commit()
    return created


def database_is_empty(session: Session) -> bool:
    return session.scalars(select(Site.id).limit(1)).first() is None


def seed_admin(session: Session) -> bool:
    """Creates the demo portal admin when there is no admin yet."""
    if session.scalars(select(Admin.id).limit(1)).first() is not None:
        return False
    salt = new_salt()
    session.add(Admin(
        email=settings.demo_admin_email.lower(),
        name="Training Admin",
        password_salt=salt,
        password_hash=hash_password(settings.demo_admin_password, salt),
        active=True,
        created_at=datetime.now(UTC),
    ))
    session.commit()
    return True


def main(argv: list[str]) -> None:
    if "--reset" in argv:
        Base.metadata.drop_all(engine)
    init_db()
    with SessionLocal() as session:
        created = seed(session)
        seed_admin(session)
        results = 0 if "--no-history" in argv else seed_history(session)
    print(f"Seeded {created} workers across {len(SITES)} sites (demo PIN {DEMO_PIN}), "
          f"{results} training results. Admin: {settings.demo_admin_email}.")


if __name__ == "__main__":
    main(sys.argv[1:])
