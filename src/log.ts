import type { DomoQueryResponse, Env } from "./types";
import type { RejectionRule } from "./validation";

export interface LogEntry {
  userEmail: string;
  toolName: string;
  sqlText?: string;
  response?: DomoQueryResponse;
  requestedLimit?: number;
  atLimit?: boolean;
  error?: string;
  rejectedBy?: RejectionRule;
}

export async function writeLog(env: Env, entry: LogEntry): Promise<void> {
  await env.QUERY_LOG.prepare(
    `INSERT INTO query_log
      (ts, user_email, tool_name, sql_text, row_count, requested_limit, at_limit,
       duration_ms, from_cache, error, rejected_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      new Date().toISOString(),
      entry.userEmail,
      entry.toolName,
      entry.sqlText ?? null,
      entry.response?.numRows ?? null,
      entry.requestedLimit ?? null,
      entry.atLimit === undefined ? null : Number(entry.atLimit),
      entry.response ? Number(entry.response.duration) : null,
      entry.response?.fromcache ?? null,
      entry.error ?? null,
      entry.rejectedBy ?? null,
    )
    .run();
}

export function scheduleLog(ctx: ExecutionContext, env: Env, entry: LogEntry): void {
  ctx.waitUntil(
    writeLog(env, entry).catch((error: unknown) => {
      console.error("D1 query log write failed", error);
    }),
  );
}
