import csv
import tempfile
from pathlib import Path

import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select, func, delete

from server import app
from database import SessionLocal
from models import MechCatalogEntry
from import_mech_catalog import import_catalog

SYNTHETIC_ROWS = [
    {"chassis": "Test Catalog Mech", "model": "TCM-1", "mul_id": "900001", "BV": "1000", "tonnage": "50"},
    {"chassis": "Test Catalog Mech", "model": "TCM-2", "mul_id": "900002", "BV": "1200", "tonnage": "55"},
    {"chassis": "Test Catalog No Mul", "model": "", "mul_id": "", "BV": "800", "tonnage": "35"},
]


def _write_synthetic_csv(tmp_path):
    csv_path = tmp_path / "synthetic_mechs.csv"
    with open(csv_path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["chassis", "model", "mul_id", "BV", "tonnage"])
        writer.writeheader()
        writer.writerows(SYNTHETIC_ROWS)
    return csv_path


async def _cleanup_synthetic(session):
    await session.execute(delete(MechCatalogEntry).where(MechCatalogEntry.mul_id.in_([900001, 900002])))
    await session.execute(delete(MechCatalogEntry).where(MechCatalogEntry.chassis == "Test Catalog No Mul"))
    await session.commit()


@pytest.mark.asyncio
async def test_reimport_is_idempotent_for_a_dropped_csv(tmp_path):
    csv_path = _write_synthetic_csv(tmp_path)

    async with SessionLocal() as session:
        await _cleanup_synthetic(session)

        async with session.begin():
            created1, updated1 = await import_catalog(session, csv_path)
        assert created1 == len(SYNTHETIC_ROWS)
        assert updated1 == 0

        async with session.begin():
            created2, updated2 = await import_catalog(session, csv_path)
        assert created2 == 0, "second import must not create any new rows"
        assert updated2 == len(SYNTHETIC_ROWS)

        rows = (
            await session.execute(
                select(func.count()).select_from(MechCatalogEntry).where(MechCatalogEntry.mul_id.in_([900001, 900002]))
            )
        ).scalar_one()
        assert rows == 2

        await _cleanup_synthetic(session)


@pytest.mark.asyncio
async def test_search_below_min_length_returns_empty():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/mech-catalog", params={"search": "a"})
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_search_accuracy_matches_chassis_and_model():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/mech-catalog", params={"search": "atlas"})
        assert resp.status_code == 200
        results = resp.json()
        assert len(results) > 0
        assert all("atlas" in r["name"].lower() for r in results)

        resp2 = await client.get("/api/mech-catalog", params={"search": "AS7-D"})
        assert resp2.status_code == 200
        assert any(r["model"] == "AS7-D" for r in resp2.json())


@pytest.mark.asyncio
async def test_search_results_capped_at_50():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/mech-catalog", params={"search": "e"})
    assert resp.status_code == 200
    assert len(resp.json()) <= 50


@pytest.mark.asyncio
async def test_search_no_results_for_unknown_term():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/mech-catalog", params={"search": "zzzznotamechzzzz"})
    assert resp.status_code == 200
    assert resp.json() == []
