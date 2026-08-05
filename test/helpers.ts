import type { Env } from "../src/types";

export interface TestContext extends ExecutionContext {
  pending: Promise<unknown>[];
}

export function testContext(): TestContext {
  const pending: Promise<unknown>[] = [];
  return {
    pending,
    props: {},
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
    ACCESS_AUD: "expected-aud",
    ACCESS_TEAM_DOMAIN: "example.cloudflareaccess.com",
    DOMO_CLIENT_ID: "test-client",
    DOMO_CLIENT_SECRET: "test-secret",
    DOMO_DATASET_ID: "test-dataset",
    QUERY_LOG: {
      prepare: () => statement,
    } as unknown as D1Database,
  };
}
