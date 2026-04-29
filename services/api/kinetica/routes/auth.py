"""Auth routes. Phase 2 turn 1: registration only.

Subsequent turns add /auth/challenge + /auth/login (login),
/auth/refresh (rotation), and DPoP middleware on protected endpoints.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from kinetica.auth.registration import (
    EmailAlreadyRegistered,
    InvalidBootstrapSignature,
    PepperUnavailable,
    register_user,
)
from kinetica.config import Settings, get_settings
from kinetica.db import get_session
from kinetica.schemas.auth import RegisterRequest, RegisterResponse

router = APIRouter(prefix="/auth", tags=["auth"])

SessionDep = Annotated[AsyncSession, Depends(get_session)]
SettingsDep = Annotated[Settings, Depends(get_settings)]


@router.post(
    "/register",
    response_model=RegisterResponse,
    status_code=status.HTTP_201_CREATED,
)
async def register(
    body: RegisterRequest,
    session: SessionDep,
    settings: SettingsDep,
) -> RegisterResponse:
    try:
        result = await register_user(body, session, settings)
    except InvalidBootstrapSignature as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="bootstrap_signature does not verify",
        ) from e
    except EmailAlreadyRegistered as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="email already registered",
        ) from e
    except PepperUnavailable as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="server not provisioned",
        ) from e

    return RegisterResponse(
        user_id=result.user_id,
        device_id=result.device_id,
        access_token=result.access_token,
        refresh_token=result.refresh_token,
        access_token_expires_at=result.access_token_expires_at,
    )
