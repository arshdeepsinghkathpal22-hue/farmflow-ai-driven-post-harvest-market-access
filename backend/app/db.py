"""
Database setup.

SQLite on purpose: the whole system runs from a folder with no account to
create, no server to install and no connection string to paste. For a demo
machine that is a feature, not a compromise.

The one thing that matters is still guaranteed. A micro-slot must never be sold
to two farmers, and here that comes from SQLite serialising writers rather than
from PostgreSQL row locks:

* `journal_mode=WAL` lets readers carry on while a writer holds the lock.
* `isolation_level = None` disables pysqlite's implicit BEGIN, so we control it.
* Every transaction opens with `BEGIN IMMEDIATE`, taking the write lock up
  front instead of half way through - which is what turns "last writer wins"
  into "second writer waits".
* `busy_timeout` makes a competing writer wait for the lock instead of failing.

`tests/test_concurrency.py` races real threads at a single slot and asserts that
exactly one wins.
"""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings


class Base(DeclarativeBase):
    """Declarative base for every model."""


def _configure(engine) -> None:
    @event.listens_for(engine, "connect")
    def _on_connect(dbapi_connection, _record):  # noqa: ANN001
        # Hand transaction control to us; see the module docstring.
        dbapi_connection.isolation_level = None

        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA busy_timeout=10000")
        cursor.close()

    @event.listens_for(engine, "begin")
    def _on_begin(connection):  # noqa: ANN001
        connection.exec_driver_sql("BEGIN IMMEDIATE")


_engine = None
_SessionLocal: sessionmaker[Session] | None = None


def build_engine(url: str | None = None):
    settings = get_settings()
    target = url or settings.database_url

    if target.startswith("sqlite"):
        # Make sure the folder exists before SQLite is asked to write into it.
        path = target.split("///", 1)[-1]
        if path and path != ":memory:":
            Path(path).parent.mkdir(parents=True, exist_ok=True)

    engine = create_engine(
        target,
        # A file-backed SQLite database is shared across request threads.
        connect_args={"check_same_thread": False},
        future=True,
    )
    _configure(engine)
    return engine


def get_engine():
    global _engine
    if _engine is None:
        _engine = build_engine()
    return _engine


def get_sessionmaker() -> sessionmaker[Session]:
    global _SessionLocal
    if _SessionLocal is None:
        _SessionLocal = sessionmaker(
            bind=get_engine(), autoflush=False, expire_on_commit=False, future=True
        )
    return _SessionLocal


def get_db() -> Iterator[Session]:
    """FastAPI dependency: one session per request, always closed."""
    session = get_sessionmaker()()
    try:
        yield session
    finally:
        session.close()


@contextmanager
def session_scope() -> Iterator[Session]:
    session = get_sessionmaker()()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
