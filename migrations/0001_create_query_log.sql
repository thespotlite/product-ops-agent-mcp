CREATE TABLE query_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL,
  user_email TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  sql_text TEXT,
  row_count INTEGER,
  duration_ms REAL,
  from_cache TEXT,
  error TEXT,
  rejected_by TEXT
);

CREATE INDEX idx_query_log_ts ON query_log (ts);
CREATE INDEX idx_query_log_tool_name ON query_log (tool_name);
