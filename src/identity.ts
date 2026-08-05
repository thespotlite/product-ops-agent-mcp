import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import type { Env } from "./types";

const JWKS_TTL_MS = 5 * 60 * 1000;
const jwksByUrl = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

export class AccessIdentityError extends Error {}

export interface AccessIdentity {
  email: string;
  claims: JWTPayload;
}

export async function verifyAccessIdentity(request: Request, env: Env): Promise<AccessIdentity> {
  const assertion = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!assertion) throw new AccessIdentityError("Missing Cloudflare Access assertion.");

  const issuer = `https://${env.ACCESS_TEAM_DOMAIN}`;
  const jwksUrl = new URL("/cdn-cgi/access/certs", issuer);
  let jwks = jwksByUrl.get(jwksUrl.href);
  if (!jwks) {
    jwks = createRemoteJWKSet(jwksUrl, { cacheMaxAge: JWKS_TTL_MS });
    jwksByUrl.set(jwksUrl.href, jwks);
  }

  try {
    const { payload } = await jwtVerify(assertion, jwks, {
      audience: env.ACCESS_AUD,
      issuer,
    });
    if (typeof payload.email !== "string" || payload.email.length === 0) {
      throw new AccessIdentityError("Cloudflare Access assertion has no email claim.");
    }
    return { email: payload.email, claims: payload };
  } catch (error) {
    if (error instanceof AccessIdentityError) throw error;
    throw new AccessIdentityError("Invalid Cloudflare Access assertion.");
  }
}

export function clearJwksCache(): void {
  jwksByUrl.clear();
}
