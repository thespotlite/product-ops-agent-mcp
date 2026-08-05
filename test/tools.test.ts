import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
  createServer,
  getQueryReference,
  mapRunSqlResponse,
  RUN_SQL_DESCRIPTION,
  runSql,
} from "../src/tools";
import type { DomoQueryResponse } from "../src/types";
import { testContext, testEnv } from "./helpers";

function domoResponse(numRows: number): DomoQueryResponse {
  return {
    datasource: "dataset",
    device: "node",
    columns: ["value"],
    metadata: [{ type: "DOUBLE" }],
    fromcache: "false",
    numColumns: 1,
    rows: Array.from({ length: numRows }, (_, index) => [index]),
    numRows,
    duration: "10",
  };
}

test("server lists exactly the four specified tools", async () => {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const ctx = testContext();
  const server = createServer({ env: testEnv(), userEmail: "user@example.com", ctx }, "reference");
  const client = new Client({ name: "test-client", version: "1.0.0" });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  try {
    const { tools } = await client.listTools();
    assert.deepEqual(
      tools.map((tool) => tool.name).sort(),
      ["data_boundary", "describe_schema", "get_query_reference", "run_sql"],
    );
  } finally {
    await client.close();
    await server.close();
  }
});

test("row cap errors before Domo instead of returning a partial result", async () => {
  let queried = false;
  const ctx = testContext();
  const result = await runSql(
    {
      env: testEnv(),
      userEmail: "user@example.com",
      ctx,
      query: async () => {
        queried = true;
        return domoResponse(5000);
      },
    },
    "SELECT * FROM table LIMIT 5001",
  );
  assert.equal("isError" in result && result.isError, true);
  assert.equal(queried, false);
  await Promise.all(ctx.pending);
});

test("at_limit is true only at the requested boundary", () => {
  assert.equal(mapRunSqlResponse(domoResponse(10), 10).at_limit, true);
  assert.equal(mapRunSqlResponse(domoResponse(9), 10).at_limit, false);
});

test("run_sql description carries every model-facing query rule", () => {
  assert.match(RUN_SQL_DESCRIPTION, /table/);
  assert.match(RUN_SQL_DESCRIPTION, /double quotes/);
  assert.match(RUN_SQL_DESCRIPTION, /price \* qty/);
  assert.match(RUN_SQL_DESCRIPTION, /cost \* qty/);
  assert.match(RUN_SQL_DESCRIPTION, /DEL-LAND/);
  assert.match(RUN_SQL_DESCRIPTION, /DEL-SPOR/);
  assert.match(RUN_SQL_DESCRIPTION, /DELIVERY/);
});

test("get_query_reference returns the complete bundled file", async () => {
  const reference = await readFile(new URL("../reference/DOMO_Reference.md", import.meta.url), "utf8");
  const lastLine = reference.trimEnd().split("\n").at(-1);
  assert.ok(lastLine);
  const ctx = testContext();
  const result = getQueryReference(
    { env: testEnv(), userEmail: "user@example.com", ctx },
    reference,
  );
  assert.equal(result.content[0].text, reference);
  assert.ok(result.content[0].text.includes(lastLine));
  await Promise.all(ctx.pending);
});

test("a failed D1 write does not fail a successful query", async () => {
  const ctx = testContext();
  const originalError = console.error;
  const errors: unknown[][] = [];
  console.error = (...args: unknown[]) => errors.push(args);
  try {
    const result = await runSql(
      {
        env: testEnv(async () => Promise.reject(new Error("D1 unavailable"))),
        userEmail: "user@example.com",
        ctx,
        query: async () => domoResponse(1),
      },
      "SELECT 1 FROM table LIMIT 10",
    );
    assert.equal("isError" in result, false);
    await Promise.all(ctx.pending);
    assert.equal(errors.length, 1);
    assert.equal(errors[0][0], "D1 query log write failed");
  } finally {
    console.error = originalError;
  }
});
