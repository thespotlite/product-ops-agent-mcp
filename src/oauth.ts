import { createRemoteJWKSet, jwtVerify } from "jose";
import { AuthorizationError, type AuthRequest, type OAuthHelpers } from "@cloudflare/workers-oauth-provider";
import { authenticatedEmail } from "./identity";
import type { Env } from "./types";

const STATE_TTL_SECONDS = 600;
const CSRF_COOKIE = "__Host-DOMO_MCP_CSRF";

type OAuthEnv = Env & { OAUTH_PROVIDER: OAuthHelpers };

interface StoredAuthorization {
  request: AuthRequest;
  verifier: string;
}

function base64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function pkce(): Promise<{ verifier: string; challenge: string }> {
  const verifier = base64Url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return { verifier, challenge: base64Url(new Uint8Array(digest)) };
}

async function signState(id: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(id));
  return `${id}.${base64Url(new Uint8Array(signature))}`;
}

async function verifiedStateId(state: string, secret: string): Promise<string | undefined> {
  const separator = state.lastIndexOf(".");
  if (separator < 1) return undefined;
  const id = state.slice(0, separator);
  const expected = await signState(id, secret);
  if (expected.length !== state.length) return undefined;
  let mismatch = 0;
  for (let index = 0; index < state.length; index++) mismatch |= state.charCodeAt(index) ^ expected.charCodeAt(index);
  return mismatch === 0 ? id : undefined;
}

function csrfCookie(token: string, maxAge: number): string {
  return `${CSRF_COOKIE}=${token}; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=${maxAge}`;
}

function cookieValue(request: Request, name: string): string | undefined {
  return request.headers
    .get("Cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

async function storeAuthorization(env: OAuthEnv, request: AuthRequest): Promise<{ state: string; challenge: string }> {
  const id = crypto.randomUUID();
  const state = await signState(id, env.COOKIE_ENCRYPTION_KEY);
  const { verifier, challenge } = await pkce();
  const stored: StoredAuthorization = { request, verifier };
  await env.OAUTH_KV.put(`upstream:${id}`, JSON.stringify(stored), { expirationTtl: STATE_TTL_SECONDS });
  return { state, challenge };
}

function redirectToAccess(request: Request, env: OAuthEnv, state: string, challenge: string): Response {
  const url = new URL(env.ACCESS_AUTHORIZATION_URL);
  url.searchParams.set("client_id", env.ACCESS_CLIENT_ID);
  url.searchParams.set("redirect_uri", new URL("/callback", request.url).href);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return Response.redirect(url, 302);
}

async function authorize(request: Request, env: OAuthEnv): Promise<Response> {
  if (request.method === "GET") {
    let oauthRequest: AuthRequest;
    try {
      oauthRequest = await env.OAUTH_PROVIDER.parseAuthRequest(request);
    } catch (error) {
      if (!(error instanceof AuthorizationError)) throw error;
      if (!error.redirectUri) return new Response(error.description, { status: 400 });
      const redirect = new URL(error.redirectUri);
      redirect.searchParams.set("error", error.code);
      redirect.searchParams.set("error_description", error.description);
      if (error.state) redirect.searchParams.set("state", error.state);
      if (error.issuer) redirect.searchParams.set("iss", error.issuer);
      return Response.redirect(redirect, 302);
    }
    const client = await env.OAUTH_PROVIDER.lookupClient(oauthRequest.clientId);
    if (!client) return new Response("Unknown OAuth client", { status: 400 });

    const approvalId = crypto.randomUUID();
    const csrf = crypto.randomUUID();
    await env.OAUTH_KV.put(`approval:${approvalId}`, JSON.stringify(oauthRequest), { expirationTtl: STATE_TTL_SECONDS });
    const clientName = escapeHtml(client.clientName ?? oauthRequest.clientId);
    const body = `<!doctype html><html><body><main><h1>Authorize DOMO MCP</h1><p>Allow ${clientName} to query Product Sales History as you?</p><form method="post"><input type="hidden" name="approval" value="${approvalId}"><input type="hidden" name="csrf" value="${csrf}"><button type="submit">Approve</button></form></main></body></html>`;
    return new Response(body, {
      headers: { "Content-Type": "text/html; charset=utf-8", "Set-Cookie": csrfCookie(csrf, STATE_TTL_SECONDS) },
    });
  }

  if (request.method === "POST") {
    const form = await request.formData();
    const approvalId = form.get("approval");
    const csrf = form.get("csrf");
    if (typeof approvalId !== "string" || typeof csrf !== "string" || cookieValue(request, CSRF_COOKIE) !== csrf) {
      return new Response("Invalid authorization request", { status: 400 });
    }
    const key = `approval:${approvalId}`;
    const stored = await env.OAUTH_KV.get(key);
    await env.OAUTH_KV.delete(key);
    if (!stored) return new Response("Authorization request expired", { status: 400 });
    const oauthRequest = JSON.parse(stored) as AuthRequest;
    const { state, challenge } = await storeAuthorization(env, oauthRequest);
    const response = redirectToAccess(request, env, state, challenge);
    response.headers.append("Set-Cookie", csrfCookie("", 0));
    return response;
  }

  return new Response("Method Not Allowed", { status: 405 });
}

async function callback(request: Request, env: OAuthEnv): Promise<Response> {
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  if (!state || !code) return new Response("Invalid OAuth callback", { status: 400 });

  const stateId = await verifiedStateId(state, env.COOKIE_ENCRYPTION_KEY);
  if (!stateId) return new Response("Invalid OAuth callback", { status: 400 });
  const key = `upstream:${stateId}`;
  const serialized = await env.OAUTH_KV.get(key);
  await env.OAUTH_KV.delete(key);
  if (!serialized) return new Response("OAuth callback expired", { status: 400 });
  const stored = JSON.parse(serialized) as StoredAuthorization;

  const tokenResponse = await fetch(env.ACCESS_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: env.ACCESS_CLIENT_ID,
      client_secret: env.ACCESS_CLIENT_SECRET,
      redirect_uri: new URL("/callback", request.url).href,
      code,
      code_verifier: stored.verifier,
    }),
  });
  if (!tokenResponse.ok) return new Response("Upstream authentication failed", { status: 502 });
  const tokens = (await tokenResponse.json()) as { id_token?: string };
  if (!tokens.id_token) return new Response("Upstream authentication failed", { status: 502 });

  const { payload } = await jwtVerify(tokens.id_token, createRemoteJWKSet(new URL(env.ACCESS_JWKS_URL)), {
    audience: env.ACCESS_CLIENT_ID,
  });
  const email = authenticatedEmail(payload);
  if (typeof payload.sub !== "string" || payload.sub.length === 0) {
    return new Response("Upstream identity is incomplete", { status: 502 });
  }
  const { redirectTo } = await env.OAUTH_PROVIDER.completeAuthorization({
    request: stored.request,
    userId: payload.sub,
    metadata: { label: typeof payload.name === "string" ? payload.name : email },
    scope: stored.request.scope,
    props: { email },
  });
  return Response.redirect(redirectTo, 302);
}

export const oauthHandler: ExportedHandler<OAuthEnv> = {
  async fetch(request, env) {
    const pathname = new URL(request.url).pathname;
    if (pathname === "/authorize") return authorize(request, env);
    if (request.method === "GET" && pathname === "/callback") return callback(request, env);
    return new Response("Not Found", { status: 404 });
  },
};
