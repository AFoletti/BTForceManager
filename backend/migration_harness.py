"""Minimal migration harness.

BTForceManager already uses Alembic (backend/alembic/) as its migration
tool: every schema change is a versioned revision file under
`backend/alembic/versions/`, and the applied revision is tracked in the
`alembic_version` table inside `data/btforce.db` itself. That table is the
mapping between "what version is this btforce.db file at" and "what's the
latest version the code expects".

`run_migrations()` is the run-on-start half of the harness: it applies any
pending revisions up to head automatically whenever the backend boots (both
in this dev sandbox and in the Docker entrypoint, which already runs
`alembic upgrade head` as a separate step - calling it again here is a safe
no-op if the DB is already current). On a fresh or up-to-date database this
does nothing; on a database that predates a new revision, it brings it up
to date before the app starts serving requests.

To add a new migration in the future: `cd backend && alembic revision
--autogenerate -m "describe the change"`, review the generated file under
`alembic/versions/`, and it will be picked up here automatically on the
next restart. No schema changes are introduced by this module itself.
"""
import os

from alembic import command
from alembic.config import Config

_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
_ALEMBIC_INI = os.path.join(_BASE_DIR, "alembic.ini")


def run_migrations():
    config = Config(_ALEMBIC_INI)
    command.upgrade(config, "head")
