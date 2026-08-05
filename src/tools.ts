import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { queryDomo } from "./domo";
import { scheduleLog } from "./log";
import type { DomoQueryResponse, Env } from "./types";
import { validateSql } from "./validation";

export const RUN_SQL_DESCRIPTION = `Run a read-only SQL query against Product Sales History.
The dataset is always aliased as table. Columns containing a space or slash require double quotes.
Extended price and extended cost are not stored columns; compute them as price * qty and cost * qty.
Delivery lines (class IN ('DEL-LAND','DEL-SPOR','DELIVERY')) must be excluded from product revenue and are the sole population for freight analysis.
Call get_query_reference before composing any query involving columns or filters not covered above.
Every query must end with an explicit LIMIT of 5000 or fewer.`;

const DATA_BOUNDARY_SQL = "SELECT MIN(invdate) AS min_invdate, MAX(invdate) AS max_invdate, MIN(date) AS min_date, MAX(date) AS max_date, COUNT(*) AS total_row_count, SUM(CASE WHEN invdate IS NULL THEN 1 ELSE 0 END) AS null_invdate_count FROM table LIMIT 1";

const DESCRIBE_SCHEMA_SQL = "SELECT * FROM table LIMIT 1";

export interface ToolDependencies {
  env: Env;
  userEmail: string;
  ctx: ExecutionContext;
  query?: (env: Env, sql: string) => Promise<DomoQueryResponse>;
}

export interface RunSqlResult {
  columns: string[];
  rows: unknown[][];
  row_count: number;
  at_limit: boolean;
  column_types: string[];
}

function jsonResult(value: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value) }],
    structuredContent: value,
  };
}

function errorResult(message: string) {
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function queryFor(deps: ToolDependencies) {
  return deps.query ?? queryDomo;
}

export function mapRunSqlResponse(response: DomoQueryResponse, requestedLimit: number): RunSqlResult {
  return {
    columns: response.columns,
    rows: response.rows,
    row_count: response.numRows,
    at_limit: response.numRows === requestedLimit,
    column_types: response.metadata.map((column) => column.type),
  };
}

export async function runSql(deps: ToolDependencies, sql: string) {
  const validation = validateSql(sql);
  if (!validation.ok) {
    scheduleLog(deps.ctx, deps.env, {
      userEmail: deps.userEmail,
      toolName: "run_sql",
      sqlText: sql,
      error: validation.message,
      rejectedBy: validation.rejectedBy,
    });
    return errorResult(validation.message);
  }

  try {
    const response = await queryFor(deps)(deps.env, validation.sql);
    const result = mapRunSqlResponse(response, validation.limit);
    scheduleLog(deps.ctx, deps.env, {
      userEmail: deps.userEmail,
      toolName: "run_sql",
      sqlText: sql,
      response,
      requestedLimit: validation.limit,
      atLimit: result.at_limit,
    });
    return jsonResult(result as unknown as Record<string, unknown>);
  } catch (error) {
    const message = errorMessage(error);
    scheduleLog(deps.ctx, deps.env, {
      userEmail: deps.userEmail,
      toolName: "run_sql",
      sqlText: sql,
      requestedLimit: validation.limit,
      error: message,
    });
    return errorResult(message);
  }
}

export async function dataBoundary(deps: ToolDependencies) {
  try {
    const response = await queryFor(deps)(deps.env, DATA_BOUNDARY_SQL);
    const row = Object.fromEntries(response.columns.map((column, index) => [column, response.rows[0]?.[index] ?? null]));
    scheduleLog(deps.ctx, deps.env, {
      userEmail: deps.userEmail,
      toolName: "data_boundary",
      sqlText: DATA_BOUNDARY_SQL,
      response,
      requestedLimit: 1,
      atLimit: response.numRows === 1,
    });
    return jsonResult(row);
  } catch (error) {
    const message = errorMessage(error);
    scheduleLog(deps.ctx, deps.env, {
      userEmail: deps.userEmail,
      toolName: "data_boundary",
      sqlText: DATA_BOUNDARY_SQL,
      requestedLimit: 1,
      error: message,
    });
    return errorResult(message);
  }
}

export async function describeSchema(deps: ToolDependencies) {
  try {
    const response = await queryFor(deps)(deps.env, DESCRIBE_SCHEMA_SQL);
    const columns = response.columns.map((name, index) => ({
      name,
      type: response.metadata[index]?.type ?? "UNKNOWN",
    }));
    scheduleLog(deps.ctx, deps.env, {
      userEmail: deps.userEmail,
      toolName: "describe_schema",
      sqlText: DESCRIBE_SCHEMA_SQL,
      response,
      requestedLimit: 1,
      atLimit: response.numRows === 1,
    });
    return jsonResult({ columns });
  } catch (error) {
    const message = errorMessage(error);
    scheduleLog(deps.ctx, deps.env, {
      userEmail: deps.userEmail,
      toolName: "describe_schema",
      sqlText: DESCRIBE_SCHEMA_SQL,
      requestedLimit: 1,
      error: message,
    });
    return errorResult(message);
  }
}

export function getQueryReference(deps: ToolDependencies, referenceText: string) {
  scheduleLog(deps.ctx, deps.env, {
    userEmail: deps.userEmail,
    toolName: "get_query_reference",
  });
  return { content: [{ type: "text" as const, text: referenceText }] };
}

export function createServer(deps: ToolDependencies, referenceText: string): McpServer {
  const server = new McpServer({ name: "domo-mcp", version: "1.0.0" });

  server.registerTool(
    "run_sql",
    {
      description: RUN_SQL_DESCRIPTION,
      inputSchema: { sql: z.string().describe("Read-only Domo SQL ending in LIMIT 5000 or fewer") },
    },
    ({ sql }) => runSql(deps, sql),
  );
  server.registerTool(
    "data_boundary",
    { description: "Return the live date boundaries, total row count, and null invoice-date count in one query." },
    () => dataBoundary(deps),
  );
  server.registerTool(
    "describe_schema",
    { description: "Return the live Domo column names paired with their metadata types to detect schema drift." },
    () => describeSchema(deps),
  );
  server.registerTool(
    "get_query_reference",
    { description: "Return the complete version-controlled Product Sales History query reference." },
    () => getQueryReference(deps, referenceText),
  );

  return server;
}
