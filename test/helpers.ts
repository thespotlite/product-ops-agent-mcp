import type { Env } from "../src/types";

export interface TestContext extends ExecutionContext {
  pending: Promise<unknown>[];
}

export function testContext(props: Record<string, unknown> = {}): TestContext {
  const pending: Promise<unknown>[] = [];
  return {
    pending,
    props,
    passThroughOnException() {},
    waitUntil(promise: Promise<unknown>) {
      pending.push(promise);
    },
  } as TestContext;
}

export function testEnv(run: () => Promise<unknown> = async () => ({})): Env {
  const statement = {
    bind() {
      return statement;
    },
    run,
  };
  return {
    ACCESS_CLIENT_ID: "access-client",
    ACCESS_CLIENT_SECRET: "access-secret",
    ACCESS_TOKEN_URL: "https://example.cloudflareaccess.com/token",
    ACCESS_AUTHORIZATION_URL: "https://example.cloudflareaccess.com/authorization",
    ACCESS_JWKS_URL: "https://example.cloudflareaccess.com/jwks",
    COOKIE_ENCRYPTION_KEY: "test-cookie-key",
    DOMO_CLIENT_ID: "test-client",
    DOMO_CLIENT_SECRET: "test-secret",
    DOMO_DATASET_ID: "test-dataset",
    QUERY_LOG: {
      prepare: () => statement,
    } as unknown as D1Database,
    OAUTH_KV: {} as KVNamespace,
    OAUTH_PROVIDER: {} as Env["OAUTH_PROVIDER"],
  };
}
