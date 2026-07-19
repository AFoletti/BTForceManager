import asyncio
import tempfile
import threading
import time
from pathlib import Path

import pytest
from sqlalchemy import select, delete
from watchdog.observers import Observer

from dotenv import load_dotenv
load_dotenv()

from database import SessionLocal
from models import MechCatalogEntry
from watcher import (
    validate_header,
    process_csv_file,
    handle_dropped_file,
    start_watcher,
    stop_watcher,
    _DebouncedCsvHandler,
)

TEST_MUL_IDS = [990001, 990002]

VALID_CSV = """chassis,model,mul_id,year,BV,tonnage,techBase,role
Test Watcher Mech,TW-1,990001,3050,1500,50,Inner Sphere,Skirmisher
Test Watcher Mech,TW-1,990001,3055,1600,50,Inner Sphere,Skirmisher
"""

MALFORMED_CSV = """foo,bar,baz
1,2,3
"""


async def _cleanup():
    async with SessionLocal() as session:
        await session.execute(delete(MechCatalogEntry).where(MechCatalogEntry.mul_id.in_(TEST_MUL_IDS)))
        await session.commit()


def test_validate_header():
    assert validate_header(["chassis", "model", "mul_id", "BV", "tonnage", "year"]) is True
    assert validate_header(["chassis", "model"]) is False
    assert validate_header(None) is False
    assert validate_header([]) is False


@pytest.mark.asyncio
async def test_process_csv_file_upserts_by_mul_id_within_same_file():
    await _cleanup()
    with tempfile.TemporaryDirectory() as tmp:
        csv_path = Path(tmp) / "drop.csv"
        csv_path.write_text(VALID_CSV)

        async with SessionLocal() as session:
            async with session.begin():
                result = await process_csv_file(session, csv_path)

        assert result["status"] == "ok"
        assert result["rows"] == 2
        assert result["created"] == 1
        assert result["updated"] == 1

        async with SessionLocal() as session:
            entries = (
                await session.execute(select(MechCatalogEntry).where(MechCatalogEntry.mul_id == 990001))
            ).scalars().all()
            assert len(entries) == 1
            assert entries[0].bv == 1600

    await _cleanup()


@pytest.mark.asyncio
async def test_process_csv_file_rejects_malformed_header():
    with tempfile.TemporaryDirectory() as tmp:
        csv_path = Path(tmp) / "bad.csv"
        csv_path.write_text(MALFORMED_CSV)

        async with SessionLocal() as session:
            result = await process_csv_file(session, csv_path)

        assert result["status"] == "error"
        assert "Missing required header" in result["reason"]


@pytest.mark.asyncio
async def test_handle_dropped_file_archives_valid_file_with_timestamp():
    await _cleanup()
    with tempfile.TemporaryDirectory() as tmp:
        watch_dir = Path(tmp)
        csv_path = watch_dir / "good.csv"
        csv_path.write_text(VALID_CSV)

        async with SessionLocal() as session:
            async with session.begin():
                result = await handle_dropped_file(session, csv_path, watch_dir)

        assert result["status"] == "ok"
        assert not csv_path.exists()
        archived = Path(result["archivedTo"])
        assert archived.exists()
        assert archived.parent == watch_dir / "processed"
        assert archived.name.startswith("good_")

    await _cleanup()


@pytest.mark.asyncio
async def test_handle_dropped_file_quarantines_malformed_file_with_log():
    with tempfile.TemporaryDirectory() as tmp:
        watch_dir = Path(tmp)
        csv_path = watch_dir / "bad.csv"
        csv_path.write_text(MALFORMED_CSV)

        async with SessionLocal() as session:
            result = await handle_dropped_file(session, csv_path, watch_dir)

        assert result["status"] == "error"
        assert not csv_path.exists()
        moved = Path(result["movedTo"])
        log_path = Path(result["logPath"])
        assert moved.exists()
        assert moved.parent == watch_dir / "errors"
        assert log_path.exists()
        assert "Missing required header" in log_path.read_text()


def test_real_filesystem_drop_is_detected_and_processed_end_to_end():
    """Full watchdog.Observer integration test against a temp directory -
    no real NAS folder needed, verifiable in CI."""
    with tempfile.TemporaryDirectory() as tmp:
        watch_dir = Path(tmp)
        loop = asyncio.new_event_loop()

        def run_loop():
            asyncio.set_event_loop(loop)
            loop.run_forever()

        thread = threading.Thread(target=run_loop, daemon=True)
        thread.start()

        handler = _DebouncedCsvHandler(loop, watch_dir, debounce_seconds=0.3)
        observer = Observer()
        observer.schedule(handler, str(watch_dir), recursive=False)
        observer.start()

        try:
            csv_path = watch_dir / "live_drop.csv"
            csv_path.write_text(VALID_CSV)

            deadline = time.time() + 5
            processed_dir = watch_dir / "processed"
            while time.time() < deadline:
                if processed_dir.exists() and any(processed_dir.iterdir()):
                    break
                time.sleep(0.2)

            assert processed_dir.exists()
            assert any(processed_dir.iterdir()), "dropped file was not picked up and processed in time"
            assert not csv_path.exists()
        finally:
            observer.stop()
            observer.join(timeout=5)
            loop.call_soon_threadsafe(loop.stop)
            thread.join(timeout=5)

    asyncio.run(_cleanup())


def test_start_watcher_is_disabled_when_env_var_not_set(monkeypatch):
    monkeypatch.delenv("MEK_CATALOG_WATCH_DIR", raising=False)
    loop = asyncio.new_event_loop()
    observer = start_watcher(loop)
    assert observer is None
    stop_watcher()
    loop.close()
