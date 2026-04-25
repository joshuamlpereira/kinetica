from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from kinetica.config import get_settings

_engine = create_async_engine(
    get_settings().database_url,
    pool_pre_ping=True,
    future=True,
)

_session_maker: async_sessionmaker[AsyncSession] = async_sessionmaker(
    _engine,
    expire_on_commit=False,
)


async def get_session() -> AsyncIterator[AsyncSession]:
    async with _session_maker() as session:
        yield session
