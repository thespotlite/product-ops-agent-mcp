import OAuthProvider from "@cloudflare/workers-oauth-provider";
import queryReference from "../reference/DOMO_Reference.md";
import { createMcpApiHandler } from "./mcp-handler";
import { oauthHandler } from "./oauth";
import type { Env } from "./types";

export default new OAuthProvider<Env>({
  apiRoute: "/mcp",
  apiHandler: createMcpApiHandler(queryReference),
  defaultHandler: oauthHandler,
  authorizeEndpoint: "/authorize",
  tokenEndpoint: "/token",
  clientRegistrationEndpoint: "/register",
  clientIdMetadataDocumentEnabled: true,
});
