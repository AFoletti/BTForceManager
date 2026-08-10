"""Phase 1 health check tests for BTForceManager backend."""
import os
import sqlite3
import requests
import pytest

from dotenv import load_dotenv
load_dotenv()

PREVIEW_URL = os.environ.get("preview_endpoint", "https://force-manager-dev.preview.emergentagent.com").rstrip("/")
INTERNAL_URL = "http://localhost:8001"
# Derived from DATABASE_URL (sqlite+aiosqlite:////abs/path.db) rather than
# hardcoded - Issue 5 moved the live DB to the repo's data/btforce.db.
DB_PATH = os.environ.get("DATABASE_URL", "").split("sqlite+aiosqlite:///")[-1] or "/app/data/btforce.db"


class TestHealthEndpoints:
    def test_internal_health_no_prefix(self):
        r = requests.get(f"{INTERNAL_URL}/health", timeout=10)
        assert r.status_code == 200
        body = r.json()
        assert body == {"status": "ok", "db": "connected"}

    def test_internal_api_health(self):
        r = requests.get(f"{INTERNAL_URL}/api/health", timeout=10)
        assert r.status_code == 200
        assert r.json() == {"status": "ok", "db": "connected"}

    def test_external_api_health_via_ingress(self):
        r = requests.get(f"{PREVIEW_URL}/api/health", timeout=15)
        assert r.status_code == 200
        assert r.json() == {"status": "ok", "db": "connected"}


class TestAlembicBaseline:
    def test_sqlite_db_file_exists(self):
        assert os.path.exists(DB_PATH), f"SQLite DB not found at {DB_PATH}"

    def test_alembic_version_table_and_baseline_revision(self):
        conn = sqlite3.connect(DB_PATH)
        try:
            tables = [r[0] for r in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            ).fetchall()]
            assert "alembic_version" in tables
            versions = conn.execute("SELECT version_num FROM alembic_version").fetchall()
            assert len(versions) == 1, f"Expected exactly 1 alembic version row, got {versions}"
            assert versions[0][0], "alembic version_num is empty"
        finally:
            conn.close()


class TestFrontendUntouched:
    def test_frontend_root_loads(self):
        r = requests.get(f"{PREVIEW_URL}/", timeout=15)
        assert r.status_code == 200
        assert "<html" in r.text.lower() or "<!doctype" in r.text.lower()
