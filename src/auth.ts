import type { Env } from "./types";

interface TokenResponse {
  access_token: string;
  expires_in: number;
}

let cachedToken: { value: string; expiresAt: number } | undefined;
let pendingToken: Promise<string> | undefined;

export function clearCachedToken(): void {
  cachedToken = undefined;
}

export async function getDomoToken(env: Env, forceRefresh = false): Promise<string> {
  const now = Date.now();
  if (!forceRefresh && cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.value;
  }
  if (!forceRefresh && pendingToken) return pendingToken;

  pendingToken = requestToken(env).finally(() => {
    pendingToken = undefined;
  });
  return pendingToken;
}

async function requestToken(env: Env): Promise<string> {
  const credentials = btoa(`${env.DOMO_CLIENT_ID}:${env.DOMO_CLIENT_SECRET}`);
  const response = await fetch(
    "https://api.domo.com/oauth/token?grant_type=client_credentials&scope=data",
    { headers: { Authorization: `Basic ${credentials}`, Accept: "application/json" } },
  );
  if (!response.ok) {
    throw new Error(`Domo authentication failed (${response.status}): ${await response.text()}`);
  }
  const body = (await response.json()) as TokenResponse;
  if (!body.access_token || !Number.isFinite(body.expires_in)) {
    throw new Error("Domo authentication returned an invalid token response.");
  }
  cachedToken = { value: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
  return body.access_token;
}
