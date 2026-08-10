"""Watched-folder auto-import for the mech catalog.

Monitors MEK_CATALOG_WATCH_DIR (if set) for dropped *.csv files, debounced on
write-completion, and upserts rows into mech_catalog keyed on mul_id.
Processed files are archived with a timestamp; malformed files (missing
required header columns) are moved to an errors/ subfolder alongside a log
explaining why.

The file-processing logic (`process_csv_file`, `handle_dropped_file`) is
pure/async and takes no dependency on watchdog, so it's directly unit
testable against a temp directory without spinning up a real filesystem
watcher. `start_watcher`/`stop_watcher` wire that logic to a real
`watchdog.Observer` for the running app.
"""
import asyncio
import csv
import logging
import os
import shutil
import threading
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import select
from watchdog.events import FileSystemEventHandler
from watchdog.observers import Observer

from database import SessionLocal
from models import MechCatalogEntry

logger = logging.getLogger("mech_catalog_watcher")

REQUIRED_HEADERS = {"chassis", "model", "mul_id", "BV", "tonnage"}
MAX_HISTORY = 20

_observer = None
_status = {
    "enabled": False,
    "watchDir": None,
    "running": False,
    "debounceSeconds": None,
}
_history = []


def get_status():
    return {**_status, "recentImports": list(reversed(_history[-MAX_HISTORY:]))}


def _record_history(entry):
    _history.append(entry)
    del _history[:-MAX_HISTORY]


def _parse_int(value):
    if value is None:
        return None
    value = value.strip()
    if not value:
        return None
    try:
        return int(float(value))
    except ValueError:
        return None


def validate_header(fieldnames):
    if not fieldnames:
        return False
    return REQUIRED_HEADERS.issubset(set(fieldnames))


async def upsert_rows_by_mul_id(session, rows):
    """Upsert catalog rows keyed strictly on mul_id. Rows missing chassis or
    mul_id are counted as skipped (this watcher assumes incoming drops always
    carry a mul_id, unlike Phase 6's bulk loader which also handles blanks)."""
    created = updated = skipped = 0
    for row in rows:
        chassis = (row.get("chassis") or "").strip()
        mul_id = _parse_int(row.get("mul_id"))
        if not chassis or mul_id is None:
            skipped += 1
            continue

        model = (row.get("model") or "").strip()
        bv = _parse_int(row.get("BV")) or 0
        tonnage = _parse_int(row.get("tonnage")) or 0
        year = _parse_int(row.get("year"))
        techbase = (row.get("techBase") or "").strip() or None
        role = (row.get("role") or "").strip() or None

        existing = (
            await session.execute(select(MechCatalogEntry).where(MechCatalogEntry.mul_id == mul_id))
        ).scalar_one_or_none()

        now = datetime.now(timezone.utc).isoformat()
        if existing:
            existing.chassis = chassis
            existing.model = model
            existing.bv = bv
            existing.tonnage = tonnage
            existing.year = year
            existing.techbase = techbase
            existing.role = role
            existing.updated_at = now
            updated += 1
        else:
            session.add(
                MechCatalogEntry(
                    mul_id=mul_id,
                    chassis=chassis,
                    model=model,
                    bv=bv,
                    tonnage=tonnage,
                    year=year,
                    techbase=techbase,
                    role=role,
                    updated_at=now,
                )
            )
            created += 1

    return created, updated, skipped


async def process_csv_file(session, filepath: Path) -> dict:
    """Validate + import a single CSV file. Does not touch the filesystem
    beyond reading, so this is directly unit testable."""
    with open(filepath, encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        if not validate_header(reader.fieldnames):
            return {
                "status": "error",
                "reason": f"Missing required header column(s). Found: {reader.fieldnames}",
            }
        rows = list(reader)

    created, updated, skipped = await upsert_rows_by_mul_id(session, rows)
    return {"status": "ok", "rows": len(rows), "created": created, "updated": updated, "skipped": skipped}


async def handle_dropped_file(session, filepath: Path, watch_dir: Path) -> dict:
    """Process a dropped file end-to-end: validate/import, then archive
    (processed/) or quarantine (errors/ + a .log) depending on the outcome."""
    processed_dir = watch_dir / "processed"
    errors_dir = watch_dir / "errors"
    processed_dir.mkdir(parents=True, exist_ok=True)
    errors_dir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%f")
    result = await process_csv_file(session, filepath)
    result["filename"] = filepath.name
    result["timestamp"] = timestamp

    if result["status"] == "ok":
        dest = processed_dir / f"{filepath.stem}_{timestamp}{filepath.suffix}"
        shutil.move(str(filepath), str(dest))
        result["archivedTo"] = str(dest)
    else:
        dest = errors_dir / f"{filepath.stem}_{timestamp}{filepath.suffix}"
        shutil.move(str(filepath), str(dest))
        log_path = errors_dir / f"{filepath.stem}_{timestamp}.log"
        log_path.write_text(f"{timestamp} - {result['reason']}\n")
        result["movedTo"] = str(dest)
        result["logPath"] = str(log_path)

    _record_history(result)
    return result


class _DebouncedCsvHandler(FileSystemEventHandler):
    def __init__(self, loop, watch_dir, debounce_seconds):
        self.loop = loop
        self.watch_dir = watch_dir
        self.debounce_seconds = debounce_seconds
        self._timers = {}
        self._lock = threading.Lock()

    def _schedule(self, src_path):
        if not src_path.lower().endswith(".csv"):
            return
        with self._lock:
            existing_timer = self._timers.get(src_path)
            if existing_timer:
                existing_timer.cancel()
            timer = threading.Timer(self.debounce_seconds, self._fire, args=(src_path,))
            self._timers[src_path] = timer
            timer.daemon = True
            timer.start()

    def _fire(self, src_path):
        with self._lock:
            self._timers.pop(src_path, None)
        path = Path(src_path)
        if not path.exists():
            return
        asyncio.run_coroutine_threadsafe(self._process(path), self.loop)

    async def _process(self, path):
        try:
            async with SessionLocal() as session:
                async with session.begin():
                    await handle_dropped_file(session, path, self.watch_dir)
        except Exception:
            logger.exception("Failed to process dropped mech catalog file %s", path)

    def on_created(self, event):
        if not event.is_directory:
            self._schedule(event.src_path)

    def on_modified(self, event):
        if not event.is_directory:
            self._schedule(event.src_path)


def start_watcher(loop):
    global _observer

    watch_dir_env = os.environ.get("MEK_CATALOG_WATCH_DIR")
    _status["debounceSeconds"] = float(os.environ.get("MEK_CATALOG_WATCH_DEBOUNCE_SECONDS", "2"))

    if not watch_dir_env:
        _status["enabled"] = False
        _status["watchDir"] = None
        _status["running"] = False
        return None

    watch_dir = Path(watch_dir_env)
    watch_dir.mkdir(parents=True, exist_ok=True)

    handler = _DebouncedCsvHandler(loop, watch_dir, _status["debounceSeconds"])
    observer = Observer()
    observer.schedule(handler, str(watch_dir), recursive=False)
    observer.start()

    _observer = observer
    _status["enabled"] = True
    _status["watchDir"] = str(watch_dir)
    _status["running"] = True
    return observer


def stop_watcher():
    global _observer
    if _observer:
        _observer.stop()
        _observer.join(timeout=5)
        _observer = None
    _status["running"] = False
