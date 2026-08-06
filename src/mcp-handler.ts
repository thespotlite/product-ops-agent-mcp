import { authenticatedEmail, OAuthIdentityError } from "./identity";
import { createServer } from "./tools";
import type { ToolDependencies } from "./tools";
import type { Env } from "./types";

type McpHandlerFactory = (
  server: ReturnType<typeof createServer>,
  options: { route: string },
) => (request: Request, env: Env, ctx: ExecutionContext) => Promise<Response>;
type ServerFactory = (deps: ToolDependencies, referenceText: string) => ReturnType<typeof createServer>;

export async function handleMcpRequest(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  referenceText: string,
  handlerFactory?: McpHandlerFactory,
  serverFactory: ServerFactory = createServer,
): Promise<Response> {
  let userEmail: string;
  try {
    userEmail = authenticatedEmail(ctx.props);
  } catch (error) {
    if (error instanceof OAuthIdentityError) return new Response("Unauthorized", { status: 401 });
    throw error;
  }

  const server = serverFactory({ env, userEmail, ctx }, referenceText);
  const factory = handlerFactory ?? (await import("agents/mcp")).createMcpHandler;
  return factory(server, { route: "/mcp" })(request, env, ctx);
}

export function createMcpApiHandler(referenceText: string) {
  return {
    fetch(request: Request, env: Env, ctx: ExecutionContext) {
      return handleMcpRequest(request, env, ctx, referenceText);
    },
  };
}
