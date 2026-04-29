import secrets
from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_prefix="KINETICA_",
        extra="ignore",
    )

    env: str = Field(default="dev")
    database_url: str = Field(
        default="postgresql+asyncpg://kinetica:kinetica@localhost:5432/kinetica",
    )
    log_level: str = Field(default="INFO")
    log_json: bool = Field(default=False)

    # JWT signing key for access tokens. Defaults to a fresh random value
    # per process so dev / test runs don't need to set anything; production
    # MUST set KINETICA_JWT_SECRET to a stable 256-bit value (base64 or
    # hex), otherwise issued tokens will not survive a server restart.
    jwt_secret: bytes = Field(default_factory=lambda: secrets.token_bytes(32))
    access_token_ttl_seconds: int = Field(default=900)  # 15 minutes per spec
    refresh_token_bytes: int = Field(default=32)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
