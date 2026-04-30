"""Auth routes. Phase 2 turn 1: registration. Turn 2: login.

Subsequent turns add DPoP middleware on protected endpoints and
/auth/refresh (rotation + family revocation).
"""

from __future__ import annotations

import base64
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from kinetica.auth.login import (
    ChallengeNotFound,
    LoginFailed,
    complete_login,
    issue_challenge,
)
from kinetica.auth.login import PepperUnavailable as LoginPepperUnavailable
from kinetica.auth.registration import (
    EmailAlreadyRegistered,
    InvalidBootstrapSignature,
    PepperUnavailable,
    register_user,
)
from kinetica.config import Settings, get_settings
from kinetica.db import get_session
from kinetica.schemas.auth import (
    ChallengeRequest,
    ChallengeResponse,
    LoginRequest,
    LoginResponse,
    RegisterRequest,
    RegisterResponse,
)

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


@router.post(
    "/challenge",
    response_model=ChallengeResponse,
    status_code=status.HTTP_200_OK,
)
async def challenge(
    body: ChallengeRequest,
    session: SessionDep,
) -> ChallengeResponse:
    try:
        result = await issue_challenge(body.email, base64.b64decode(body.device_pubkey), session)
    except ChallengeNotFound as e:
        # Same opaque 401 for unknown email and unknown / revoked device.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid credentials",
        ) from e
    except LoginPepperUnavailable as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="server not provisioned",
        ) from e

    return ChallengeResponse(
        nonce=base64.b64encode(result.nonce).decode("ascii"),
        expires_at=result.expires_at,
    )


@router.post(
    "/login",
    response_model=LoginResponse,
    status_code=status.HTTP_200_OK,
)
async def login(
    body: LoginRequest,
    session: SessionDep,
    settings: SettingsDep,
) -> LoginResponse:
    try:
        result = await complete_login(
            body.email,
            base64.b64decode(body.device_pubkey),
            base64.b64decode(body.nonce),
            base64.b64decode(body.signature),
            session,
            settings,
        )
    except (ChallengeNotFound, LoginFailed) as e:
        # Single 401 for every authentication-failure path so a probing
        # attacker can't tell unknown-email apart from bad-signature.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid credentials",
        ) from e
    except LoginPepperUnavailable as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="server not provisioned",
        ) from e

    return LoginResponse(
        user_id=result.user_id,
        device_id=result.device_id,
        access_token=result.access_token,
        refresh_token=result.refresh_token,
        access_token_expires_at=result.access_token_expires_at,
    )
