"""Vercel entry point for the hosted API (deployed by `npm run deploy:api`).

The deploy bundle puts this file in api/, the `app` package and the module content next to it,
and vercel.json routes every path here. Vercel serves the ASGI `app` below.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.main import app  # noqa: E402

__all__ = ["app"]
