import assert from "node:assert/strict";
import test from "node:test";
import { clearCachedToken, queryDomo } from "../src/domo";
import { testEnv } from "./helpers";

test("Domo token uses documented GET data scope and is cached across queries", async () => {
  clearCachedToken();
  let tokenRequests = 0;
  let queryRequests = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.includes("/oauth/token")) {
      tokenRequests += 1;
      assert.equal(init?.method, "GET");
      assert.match(url, /grant_type=client_credentials/);
      assert.match(url, /scope=data/);
      return Response.json({ access_token: "token", expires_in: 3599 });
    }
    queryRequests += 1;
    assert.equal(init?.method, "POST");
    return Response.json({
      datasource: "dataset",
      device: "node",
      columns: ["value"],
      metadata: [{ type: "DOUBLE" }],
      fromcache: "false",
      numColumns: 1,
      rows: [[1]],
      numRows: 1,
      duration: "5",
    });
  };
  try {
    await queryDomo(testEnv(), "SELECT 1 FROM table LIMIT 1");
    await queryDomo(testEnv(), "SELECT 2 FROM table LIMIT 1");
    assert.equal(tokenRequests, 1);
    assert.equal(queryRequests, 2);
  } finally {
    globalThis.fetch = originalFetch;
    clearCachedToken();
  }
});
