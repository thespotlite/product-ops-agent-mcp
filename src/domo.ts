import { clearCachedToken, getDomoToken } from "./auth";
import type { DomoQueryResponse, Env } from "./types";

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
  if (!Array.isArray(body.columns) || !Array.isArray(body.metadata) || !Array.isArray(body.rows) || !Number.isInteger(body.numRows)) {
    throw new Error("Domo query returned an unexpected response shape.");
  }
  return body;
}

function execute(env: Env, token: string, sql: string): Promise<Response> {
  return fetch(`https://api.domo.com/v1/datasets/query/execute/${env.DOMO_DATASET_ID}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ sql }),
  });
}
