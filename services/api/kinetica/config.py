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


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
