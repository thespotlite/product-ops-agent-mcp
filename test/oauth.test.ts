import assert from "node:assert/strict";
import test from "node:test";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { oauthHandler } from "../src/oauth";
import type { Env } from "../src/types";
import { testContext, testEnv } from "./helpers";

interface StoredValue {
  value: string;
}

type IncomingRequest = Parameters<NonNullable<typeof oauthHandler.fetch>>[0];

function oauthEnv(): Env {
  const values = new Map<string, StoredValue>();
  const env = testEnv();
  env.OAUTH_KV = {
    async put(key: string, value: string) {
      values.set(key, { value });
    },
    async get(key: string) {
      return values.get(key)?.value ?? null;
    },
    async delete(key: string) {
      values.delete(key);
    },
  } as unknown as KVNamespace;
  env.OAUTH_PROVIDER = {
    async parseAuthRequest() {
      return {
        clientId: "mcp-client",
        redirectUri: "https://client.example/callback",
        responseType: "code",
        scope: [],
        state: "client-state",
        codeChallenge: "client-challenge",
        codeChallengeMethod: "S256",
      };
    },
    async lookupClient() {
      return { clientId: "mcp-client", clientName: "MCP Client", redirectUris: ["https://client.example/callback"] };
    },
    async completeAuthorization() {
      return { redirectTo: "https://client.example/callback?code=provider-code" };
    },
  } as unknown as Env["OAUTH_PROVIDER"];
  return env;
}

async function beginAuthorization(env: Env): Promise<{ approval: string; csrf: string }> {
  const response = await oauthHandler.fetch!(new Request("https://worker.example/authorize") as IncomingRequest, env, testContext());
  const body = await response.text();
  const approval = body.match(/name="approval" value="([^"]+)"/)?.[1];
  const csrf = body.match(/name="csrf" value="([^"]+)"/)?.[1];
  assert.ok(approval);
  assert.ok(csrf);
  return { approval, csrf };
}

async function submitConsent(env: Env, approval: string, csrf: string): Promise<Response> {
  return oauthHandler.fetch!(
    new Request("https://worker.example/authorize", {
      method: "POST",
      headers: {
        Cookie: `__Host-DOMO_MCP_CSRF=${csrf}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ approval, csrf }),
    }) as IncomingRequest,
    env,
    testContext(),
  );
}

test("consent POST returns a redirect with Location and Set-Cookie", async () => {
  const env = oauthEnv();
  const { approval, csrf } = await beginAuthorization(env);
  const response = await submitConsent(env, approval, csrf);

  assert.equal(response.status, 302);
  assert.match(response.headers.get("Location") ?? "", /^https:\/\/example\.cloudflareaccess\.com\/authorization\?/);
  assert.match(response.headers.get("Set-Cookie") ?? "", /Max-Age=0/);
});

test("callback returns a redirect with Location and Set-Cookie", async () => {
  const env = oauthEnv();
  const { approval, csrf } = await beginAuthorization(env);
  const consentResponse = await submitConsent(env, approval, csrf);
  const upstreamLocation = new URL(consentResponse.headers.get("Location")!);
  const state = upstreamLocation.searchParams.get("state");
  assert.ok(state);

  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const publicJwk = await exportJWK(publicKey);
  publicJwk.kid = "access-key";
  const idToken = await new SignJWT({ email: "user@example.com" })
    .setProtectedHeader({ alg: "RS256", kid: "access-key" })
    .setSubject("access-user")
    .setAudience(env.ACCESS_CLIENT_ID)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(privateKey);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = input instanceof Request ? input.url : input.toString();
    if (url === env.ACCESS_TOKEN_URL) return Response.json({ id_token: idToken });
    if (url === env.ACCESS_JWKS_URL) return Response.json({ keys: [publicJwk] });
    throw new Error(`Unexpected fetch: ${url}`);
  };
  try {
    const response = await oauthHandler.fetch!(
      new Request(`https://worker.example/callback?code=access-code&state=${encodeURIComponent(state)}`) as IncomingRequest,
      env,
      testContext(),
    );
    assert.equal(response.status, 302);
    assert.equal(response.headers.get("Location"), "https://client.example/callback?code=provider-code");
    assert.match(response.headers.get("Set-Cookie") ?? "", /Max-Age=0/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
