import assert from "node:assert/strict";
import test from "node:test";
import { authenticatedEmail } from "../src/identity";
import { handleMcpRequest } from "../src/mcp-handler";
import { createServer, getQueryReference, type ToolDependencies } from "../src/tools";
import { testContext, testEnv } from "./helpers";

test("request with no OAuth props is rejected", async () => {
  const response = await handleMcpRequest(new Request("https://worker.example/mcp", { method: "POST" }), testEnv(), testContext(), "reference");
  assert.equal(response.status, 401);
});

test("OAuth props without an email are rejected", () => {
  assert.throws(() => authenticatedEmail({}), /no email/);
  assert.throws(() => authenticatedEmail({ email: "   " }), /no email/);
});

test("OAuth props email is the email bound into the D1 query log", async () => {
  const boundValues: unknown[][] = [];
  const statement = {
    bind(...values: unknown[]) {
      boundValues.push(values);
      return statement;
    },
    async run() {},
  };
  const env = testEnv();
  env.QUERY_LOG = { prepare: () => statement } as unknown as D1Database;
  const ctx = testContext({ email: "real.user@example.com" });
  let handlerDependencies: ToolDependencies | undefined;

  const serverFactory = (deps: ToolDependencies, referenceText: string) => {
    handlerDependencies = deps;
    return createServer(deps, referenceText);
  };

  const fakeHandler = (() => async () => {
    assert.ok(handlerDependencies);
    getQueryReference(handlerDependencies, "reference");
    return new Response("ok");
  }) as Parameters<typeof handleMcpRequest>[4];

  const response = await handleMcpRequest(
    new Request("https://worker.example/mcp", { method: "POST" }),
    env,
    ctx,
    "reference",
    fakeHandler,
    serverFactory,
  );
  await Promise.all(ctx.pending);
  assert.equal(response.status, 200);
  assert.equal(boundValues.length, 1);
  assert.equal(boundValues[0][1], "real.user@example.com");
});
