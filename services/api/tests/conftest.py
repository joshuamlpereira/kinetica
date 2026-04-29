import pytest
from httpx import ASGITransport, AsyncClient

from kinetica.db import reset_engine
from kinetica.main import create_app


@pytest.fixture(autouse=True)
def _fresh_engine_per_test() -> None:
    # Each test gets its own event loop under asyncio_mode = "auto".
    # The app's async engine is process-cached, so without resetting
    # before AND after we'd hit "Event loop is closed" once the first
    # test's loop tears down with the engine still bound to it.
    reset_engine()
    yield
    reset_engine()


@pytest.fixture
async def client() -> AsyncClient:
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
