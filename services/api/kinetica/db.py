from collections.abc import AsyncIterator
from functools import lru_cache

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from kinetica.config import get_settings


@lru_cache(maxsize=1)
def _get_engine() -> AsyncEngine:
    # Lazily constructed so the engine binds to whichever event loop the
    # app first uses. In production that's the uvicorn loop; in tests
    # pytest-asyncio gives each test a fresh loop, and `reset_engine()`
    # below clears the cache between tests so the next loop sees a new
    # engine.
    return create_async_engine(
        get_settings().database_url,
        pool_pre_ping=True,
        future=True,
    )


@lru_cache(maxsize=1)
def _get_session_maker() -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(_get_engine(), expire_on_commit=False)


def reset_engine() -> None:
    """Drop the cached engine and session maker. Tests call this between
    test functions so the next event loop gets a fresh engine."""
    _get_engine.cache_clear()
    _get_session_maker.cache_clear()


async def get_session() -> AsyncIterator[AsyncSession]:
    async with _get_session_maker()() as session:
        yield session
