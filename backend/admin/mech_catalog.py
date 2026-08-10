"""Admin-triggered mech catalog CSV import.

Wraps the same idempotent upsert-by-MUL-ID logic used by the operational
`import_mech_catalog.py` script and the watched-folder mechanism
(watcher.py), so all three paths (manual script, watched folder, admin
upload) stay in sync. This endpoint is the primary in-app path; the watched
folder remains available for Docker/ops workflows (see DEPLOYMENT.md).
"""
import tempfile
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_session
from import_mech_catalog import import_catalog

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.post("/mech-catalog/import")
async def admin_import_mech_catalog(
    file: UploadFile = File(...), session: AsyncSession = Depends(get_session)
):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are supported")

    contents = await file.read()
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(mode="wb", suffix=".csv", delete=False) as tmp:
            tmp.write(contents)
            tmp_path = Path(tmp.name)

        created, updated = await import_catalog(session, tmp_path)
        await session.commit()
    except Exception as exc:
        await session.rollback()
        raise HTTPException(status_code=400, detail=f"Failed to import CSV: {exc}")
    finally:
        if tmp_path is not None:
            tmp_path.unlink(missing_ok=True)

    return {"filename": file.filename, "created": created, "updated": updated, "errors": []}
