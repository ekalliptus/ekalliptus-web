import type { LoaderFunctionArgs } from "react-router";
import { getAdminSession, requireRole, ADMIN_AUDIT_ROLES, listAudit, captureRuntimeEnv } from "@ekalliptus/core";

export const loader = async ({ request, context }: LoaderFunctionArgs) => {
  const env = (context as any).cloudflare?.env;
  if (env) captureRuntimeEnv(env);

  const rawSession = await getAdminSession(request.headers.get("Cookie"));
  if (!rawSession) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const session = requireRole(rawSession, ADMIN_AUDIT_ROLES);
  if (!session) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const result = await listAudit({
    table: url.searchParams.get("table") ?? undefined,
    action: url.searchParams.get("action") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    page: Number(url.searchParams.get("page") ?? "1") || 1
  });

  return Response.json({ 
    logs: result.rows, 
    total: result.total, 
    totalPages: result.totalPages, 
    page: result.page 
  });
};
