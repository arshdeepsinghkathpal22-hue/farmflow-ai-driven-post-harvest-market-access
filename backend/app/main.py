"""The API. See app/brand.py for the product name."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.db import Base, get_engine, session_scope
from app.routes import router
from app.seed import seed

# Import for the side effect of registering every mapper on Base.metadata.
import app.models  # noqa: F401

settings = get_settings()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Create the schema and seed on startup. There is no migration tool here on
    # purpose: the database is a file, and a fresh clone should simply run.
    Base.metadata.create_all(get_engine())
    with session_scope() as session:
        seed(session)

    print("\n  FarmFlow API ready")
    print(f"  Docs:  http://localhost:8000/docs")
    print(f"  Login: {settings.demo_username} / {settings.demo_password}\n")
    yield


app = FastAPI(
    title="FarmFlow API",
    description=(
        "Micro cold storage and market access for small Indian farmers. "
        "Capacity is sold in micro-slots, so a 50 kg lot is a first-class booking."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/", include_in_schema=False)
def root() -> dict:
    return {"service": "farmflow-api", "docs": "/docs", "health": "/api/health"}
