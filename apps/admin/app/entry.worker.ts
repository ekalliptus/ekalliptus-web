import { createRequestHandler, RouterContextProvider } from "react-router";
// @ts-ignore
import * as build from "virtual:react-router/server-build";
import { applyAdminSecurityHeaders } from "./lib/security-headers";

let handler: any = null;

export default {
  async fetch(request: Request, env: any, ctx: any) {
    if (handler === null) {
      handler = createRequestHandler(build, import.meta.env.MODE);
    }

    const context = new RouterContextProvider();
    (context as any).cloudflare = { env, ctx };

    const response = await handler(request, context);
    return applyAdminSecurityHeaders(response);
  }
} satisfies ExportedHandler;
