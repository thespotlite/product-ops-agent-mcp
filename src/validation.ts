export const LIMIT_ERROR =
  "Query must end with an explicit LIMIT of 5000 or fewer. For a total across more rows than that, aggregate server side with SUM and GROUP BY rather than returning rows.";

export type RejectionRule =
  | "statement_type"
  | "semicolon"
  | "forbidden_keyword"
  | "length"
  | "comment"
  | "limit";

export type ValidationResult =
  | { ok: true; sql: string; limit: number }
  | { ok: false; message: string; rejectedBy: RejectionRule };

export function validateSql(input: string): ValidationResult {
  const normalized = input.trim().replace(/\s+/g, " ");

  if (normalized.length > 8000) {
    return { ok: false, message: "Query must be 8000 characters or fewer.", rejectedBy: "length" };
  }
  if (input.includes(";")) {
    return { ok: false, message: "Semicolons are not allowed. Submit one SELECT query without a trailing semicolon.", rejectedBy: "semicolon" };
  }
  if (input.includes("--") || input.includes("/*")) {
    return { ok: false, message: "SQL comments are not allowed.", rejectedBy: "comment" };
  }
  if (!/^(SELECT|WITH)\b/i.test(normalized)) {
    return { ok: false, message: "Query must begin with SELECT or WITH.", rejectedBy: "statement_type" };
  }
  const withoutStringLiterals = normalized.replace(/'(?:''|[^'])*'/g, "''");
  const forbidden = withoutStringLiterals.match(
    /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE|MERGE|INTO)\b/i,
  );
  if (forbidden) {
    return { ok: false, message: `Read-only queries cannot contain ${forbidden[1].toUpperCase()}.`, rejectedBy: "forbidden_keyword" };
  }
  const limitMatch = normalized.match(/\bLIMIT\s+(\d+)\s*$/i);
  if (!limitMatch) {
    return { ok: false, message: LIMIT_ERROR, rejectedBy: "limit" };
  }
  const limit = Number(limitMatch[1]);
  if (!Number.isSafeInteger(limit) || limit > 5000) {
    return { ok: false, message: LIMIT_ERROR, rejectedBy: "limit" };
  }

  return { ok: true, sql: input, limit };
}
