from contextlib import asynccontextmanager
import asyncio
import os

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from database import engine
from migration_harness import run_migrations
import watcher
from admin.router import router as admin_router
from admin.sp_choices import router as admin_sp_choices_router
from admin.downtime_actions import router as admin_downtime_actions_router
from admin.achievements import router as admin_achievements_router
from admin.mech_catalog import router as admin_mech_catalog_router
from routers.forces import router as forces_router
from routers.special_abilities import router as special_abilities_router
from routers.achievements import router as achievements_router
from routers.sp_choices import router as sp_choices_router
from routers.pilot_special_abilities import router as pilot_special_abilities_router
from routers.mech_catalog import router as mech_catalog_router
from routers.forces_write import router as forces_write_router
from routers.mechs import router as mechs_router
from routers.pilots import router as pilots_router
from routers.elementals import router as elementals_router
from routers.missions_write import router as missions_write_router
from routers.downtime import router as downtime_router
from routers.downtime_actions import router as downtime_actions_router
from routers.snapshots import router as snapshots_router
from routers.force_snapshots import router as force_snapshots_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await asyncio.get_event_loop().run_in_executor(None, run_migrations)
    watcher.start_watcher(asyncio.get_event_loop())
    yield
    watcher.stop_watcher()
    await engine.dispose()


app = FastAPI(
    title="BTForceManager API",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# Only needed if the frontend is deployed on a different origin than the
# backend (see frontend/Dockerfile's REACT_APP_BACKEND_URL comment). Default
# same-origin deployment via nginx's /api/ proxy needs no CORS at all.
_cors_origins = [
    origin.strip()
    for origin in os.environ.get("CORS_ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def health_check():
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception:
        db_status = "error"
    return {"status": "ok", "db": db_status}


app.get("/health")(health_check)

router = APIRouter(prefix="/api")
router.get("/health")(health_check)
app.include_router(router)
app.include_router(admin_router)
app.include_router(admin_sp_choices_router)
app.include_router(admin_downtime_actions_router)
app.include_router(admin_achievements_router)
app.include_router(admin_mech_catalog_router)
app.include_router(forces_router)
app.include_router(special_abilities_router)
app.include_router(achievements_router)
app.include_router(sp_choices_router)
app.include_router(pilot_special_abilities_router)
app.include_router(mech_catalog_router)
app.include_router(forces_write_router)
app.include_router(mechs_router)
app.include_router(pilots_router)
app.include_router(elementals_router)
app.include_router(missions_write_router)
app.include_router(downtime_router)
app.include_router(downtime_actions_router)
app.include_router(snapshots_router)
app.include_router(force_snapshots_router)
