import csv
from pathlib import Path

import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select, func

from server import app
from database import SessionLocal
from models import MechCatalogEntry
from import_mech_catalog import import_catalog

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
CSV_PATH = REPO_ROOT / "data" / "mek_catalog.csv"


def count_unique_csv_entries():
    with open(CSV_PATH, encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        keys = set()
        for row in reader:
            chassis = (row.get("chassis") or "").strip()
            if not chassis:
                continue
            model = (row.get("model") or "").strip()
            mul_id = (row.get("mul_id") or "").strip()
            key = ("mul", mul_id) if mul_id else ("cm", chassis, model)
            keys.add(key)
        return len(keys)


@pytest.mark.asyncio
async def test_reimport_is_idempotent_and_row_count_matches_unique_csv_entries():
    expected_unique = count_unique_csv_entries()

    async with SessionLocal() as session:
        async with session.begin():
            await import_catalog(session)

    async with SessionLocal() as session:
        count_after_first = (
            await session.execute(select(func.count()).select_from(MechCatalogEntry))
        ).scalar_one()

    async with SessionLocal() as session:
        async with session.begin():
            created2, _updated2 = await import_catalog(session)

    async with SessionLocal() as session:
        count_after_second = (
            await session.execute(select(func.count()).select_from(MechCatalogEntry))
        ).scalar_one()

    assert count_after_first == expected_unique
    assert count_after_second == expected_unique
    assert created2 == 0, "second import must not create any new rows"
    assert count_after_first == count_after_second


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
