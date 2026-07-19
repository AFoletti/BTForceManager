from contextlib import asynccontextmanager

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from database import engine
from routers.forces import router as forces_router
from routers.special_abilities import router as special_abilities_router
from routers.achievements import router as achievements_router
from routers.sp_choices import router as sp_choices_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await engine.dispose()


app = FastAPI(
    title="BTForceManager API",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
app.include_router(forces_router)
app.include_router(special_abilities_router)
app.include_router(achievements_router)
app.include_router(sp_choices_router)
