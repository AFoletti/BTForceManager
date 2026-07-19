from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_session
from models import MechCatalogEntry
import watcher

router = APIRouter(prefix="/api")

MAX_RESULTS = 50
MIN_SEARCH_LENGTH = 2


def catalog_entry_name(chassis, model):
    return f"{chassis} {model}" if model else chassis


def catalog_entry_to_dict(entry):
    return {
        "id": entry.id,
        "mulId": entry.mul_id,
        "chassis": entry.chassis,
        "model": entry.model,
        "name": catalog_entry_name(entry.chassis, entry.model),
        "bv": entry.bv,
        "tonnage": entry.tonnage,
        "year": entry.year,
        "techbase": entry.techbase,
        "role": entry.role,
    }


@router.get("/mech-catalog")
async def search_mech_catalog(search: str = "", session: AsyncSession = Depends(get_session)):
    if len(search.strip()) < MIN_SEARCH_LENGTH:
        return []

    search_lower = search.strip().lower()
    entries = (await session.execute(select(MechCatalogEntry))).scalars().all()

    matches = [
        entry
        for entry in entries
        if search_lower in catalog_entry_name(entry.chassis, entry.model).lower()
        or search_lower in (entry.chassis or "").lower()
        or search_lower in (entry.model or "").lower()
    ]

    return [catalog_entry_to_dict(e) for e in matches[:MAX_RESULTS]]


@router.get("/mech-catalog/import-status")
async def get_mech_catalog_import_status():
    return watcher.get_status()
