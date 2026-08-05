import type { DomoQueryResponse, Env } from "./types";

interface TokenResponse {
  access_token: string;
  expires_in: number;
}

const DOMO_API_BASE = "https://api.domo.com";
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
    `${DOMO_API_BASE}/oauth/token?grant_type=client_credentials&scope=data`,
    {
      method: "GET",
      headers: { Authorization: `Basic ${credentials}`, Accept: "application/json" },
    },
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

export async function queryDomo(env: Env, sql: string): Promise<DomoQueryResponse> {
  let token = await getDomoToken(env);
  let response = await execute(env, token, sql);

  if (response.status === 401) {
    clearCachedToken();
    token = await getDomoToken(env, true);
    response = await execute(env, token, sql);
  }
  if (!response.ok) {
    throw new Error(`Domo query failed (${response.status}): ${await response.text()}`);
  }
  const body = (await response.json()) as DomoQueryResponse;
  if (
    !Array.isArray(body.columns) ||
    !Array.isArray(body.metadata) ||
    !Array.isArray(body.rows) ||
    !Number.isInteger(body.numRows)
  ) {
    throw new Error("Domo query returned an unexpected response shape.");
  }
  return body;
}

function execute(env: Env, token: string, sql: string): Promise<Response> {
  return fetch(`${DOMO_API_BASE}/v1/datasets/query/execute/${env.DOMO_DATASET_ID}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ sql }),
  });
}
