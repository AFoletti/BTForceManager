"""Admin namespace router.

Separate from the existing "play" APIs (forces, mechs, pilots, missions,
downtime, etc.) - reserved for future global configuration and operational
tooling. Currently exposes only a health/ping endpoint.
"""
from fastapi import APIRouter

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/health")
async def admin_health():
    return {"status": "ok", "namespace": "admin"}
