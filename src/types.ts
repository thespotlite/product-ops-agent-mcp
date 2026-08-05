export interface Env {
  DOMO_CLIENT_ID: string;
  DOMO_CLIENT_SECRET: string;
  DOMO_DATASET_ID: string;
  ACCESS_TEAM_DOMAIN: string;
  ACCESS_AUD: string;
  QUERY_LOG: D1Database;
}

export interface DomoMetadata {
  type: string;
  [key: string]: unknown;
}

export interface DomoQueryResponse {
  datasource: string;
  device: string;
  columns: string[];
  metadata: DomoMetadata[];
  fromcache: string;
  numColumns: number;
  rows: unknown[][];
  numRows: number;
  duration: string;
}
