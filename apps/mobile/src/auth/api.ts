// Thin fetch wrapper around the auth endpoints.
//
// Base URL comes from process.env via Expo's constant injection. For
// dev (simulator + local docker-compose), the default points at the
// host's loopback as seen from the simulator. Override via
// EXPO_PUBLIC_API_URL when running against a real backend.

import type { RegistrationPayload } from './registration.ts';

const DEFAULT_API_URL = 'http://localhost:8000';
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_API_URL;

export type RegisterResponse = {
  user_id: string;
  device_id: string;
  access_token: string;
  refresh_token: string;
  access_token_expires_at: string;
  token_type: 'DPoP';
};

export type ChallengeResponse = {
  nonce: string;
  expires_at: string;
};

export type LoginResponse = RegisterResponse;

export class ApiError extends Error {
  // Plain fields rather than constructor parameter properties — Node's
  // strip-only TypeScript loader (used by node:test) doesn't support
  // the `public readonly` shorthand, so we declare and assign manually.
  readonly status: number;
  readonly detail?: unknown;

  constructor(message: string, status: number, detail?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    let detail: unknown;
    try {
      detail = await response.json();
    } catch {
      detail = await response.text();
    }
    throw new ApiError(
      `${path} returned ${response.status}`,
      response.status,
      detail,
    );
  }
  return response.json() as Promise<T>;
}

export function postRegister(payload: RegistrationPayload): Promise<RegisterResponse> {
  return postJson<RegisterResponse>('/auth/register', payload);
}

export function postChallenge(
  email: string,
  devicePubkeyB64: string,
): Promise<ChallengeResponse> {
  return postJson<ChallengeResponse>('/auth/challenge', {
    email,
    device_pubkey: devicePubkeyB64,
  });
}

export function postLogin(args: {
  email: string;
  device_pubkey: string;
  nonce: string;
  signature: string;
}): Promise<LoginResponse> {
  return postJson<LoginResponse>('/auth/login', args);
}
