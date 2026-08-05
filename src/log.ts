import type { DomoQueryResponse, Env } from "./types";
import type { RejectionRule } from "./validation";

export interface LogEntry {
  userEmail: string;
  toolName: string;
  sqlText?: string;
  response?: DomoQueryResponse;
  error?: string;
  rejectedBy?: RejectionRule;
}

export async function writeLog(env: Env, entry: LogEntry): Promise<void> {
  await env.QUERY_LOG.prepare(
    `INSERT INTO query_log
      (ts, user_email, tool_name, sql_text, row_count, duration_ms, from_cache, error, rejected_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      new Date().toISOString(),
      entry.userEmail,
      entry.toolName,
      entry.sqlText ?? null,
      entry.response?.numRows ?? null,
      entry.response ? Number(entry.response.duration) : null,
      entry.response?.fromcache ?? null,
      entry.error ?? null,
      entry.rejectedBy ?? null,
    )
    .run();
}
