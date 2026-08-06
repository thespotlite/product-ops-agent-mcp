import type { OAuthHelpers } from "@cloudflare/workers-oauth-provider";

export interface Env {
  DOMO_CLIENT_ID: string;
  DOMO_CLIENT_SECRET: string;
  DOMO_DATASET_ID: string;
  ACCESS_CLIENT_ID: string;
  ACCESS_CLIENT_SECRET: string;
  ACCESS_TOKEN_URL: string;
  ACCESS_AUTHORIZATION_URL: string;
  ACCESS_JWKS_URL: string;
  COOKIE_ENCRYPTION_KEY: string;
  OAUTH_KV: KVNamespace;
  OAUTH_PROVIDER: OAuthHelpers;
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
