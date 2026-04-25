from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from kinetica.config import get_settings
from kinetica.logging import configure_logging, get_logger
from kinetica.routes.health import router as health_router


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    configure_logging()
    log = get_logger("kinetica.lifespan")
    settings = get_settings()
    log.info("startup", env=settings.env)
    yield
    log.info("shutdown")


def create_app() -> FastAPI:
    app = FastAPI(
        title="Kinetica API",
        version="0.0.0",
        lifespan=lifespan,
    )
    app.include_router(health_router)
    return app


app = create_app()
