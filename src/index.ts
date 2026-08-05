import { createMcpHandler } from "agents/mcp";
import queryReference from "../reference/DOMO_Reference.md";
import { AccessIdentityError, verifyAccessIdentity } from "./identity";
import { createServer } from "./tools";
import type { Env } from "./types";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== "/mcp" || request.method !== "POST") {
      return new Response("Not Found", { status: 404 });
    }

    let userEmail: string;
    try {
      userEmail = (await verifyAccessIdentity(request, env)).email;
    } catch (error) {
      if (error instanceof AccessIdentityError) {
        return new Response("Unauthorized", { status: 401 });
      }
      throw error;
    }

    const server = createServer({ env, userEmail, ctx }, queryReference);
    return createMcpHandler(server, { route: "/mcp" })(request, env, ctx);
  },
};
