import assert from "node:assert/strict";
import test from "node:test";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { clearJwksCache, verifyAccessIdentity } from "../src/identity";
import { testEnv } from "./helpers";

test("request without an Access assertion is rejected", async () => {
  await assert.rejects(
    verifyAccessIdentity(new Request("https://worker.example/mcp"), testEnv()),
    /Missing Cloudflare Access assertion/,
  );
});

test("signed Access token with a mismatched audience is rejected", async () => {
  clearJwksCache();
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const publicJwk = await exportJWK(publicKey);
  publicJwk.kid = "test-key";
  const token = await new SignJWT({ email: "user@example.com" })
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setIssuer("https://example.cloudflareaccess.com")
    .setAudience("wrong-aud")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(privateKey);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ keys: [publicJwk] });
  try {
    const request = new Request("https://worker.example/mcp", {
      headers: { "Cf-Access-Jwt-Assertion": token },
    });
    await assert.rejects(verifyAccessIdentity(request, testEnv()), /Invalid Cloudflare Access assertion/);
  } finally {
    globalThis.fetch = originalFetch;
    clearJwksCache();
  }
});
