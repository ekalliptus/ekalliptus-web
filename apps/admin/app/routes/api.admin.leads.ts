import type { ActionFunctionArgs } from "react-router";
import { 
  getAdminSession, 
  requireRole,
  ADMIN_LEAD_ROLES,
  createLead, 
  writeAudit, 
  captureRuntimeEnv 
} from "@ekalliptus/core";

export const action = async ({ request, context }: ActionFunctionArgs) => {
  const env = (context as any).cloudflare?.env;
  if (env) captureRuntimeEnv(env);

  const rawSession = await getAdminSession(request.headers.get("Cookie"));
  if (!rawSession) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const session = requireRole(rawSession, ADMIN_LEAD_ROLES);
  if (!session) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const body = await request.json();
    if (!body.name || typeof body.name !== "string") {
      return Response.json({ error: "name is required" }, { status: 400 });
    }

    const lead = await createLead({
      name: body.name,
      whatsapp: body.whatsapp ?? null,
      email: body.email ?? null,
      company: body.company ?? null,
      service_interest: body.service_interest ?? null,
      stage: body.stage ?? "new",
      source: body.source ?? "manual",
      notes: body.notes ?? null,
      estimated_value: body.estimated_value ? Number(body.estimated_value) : null
    });

    if (!lead) {
      return Response.json({ error: "Failed to create lead" }, { status: 500 });
    }

    // Write audit log
    await writeAudit({
      user_id: session.user.id,
      action: "create",
      table_name: "leads",
      record_id: lead.id,
      new_values: lead,
      ip_address: request.headers.get("cf-connecting-ip") || "0.0.0.0",
      user_agent: request.headers.get("user-agent")
    });

    return Response.json({ lead }, { status: 201 });
  } catch (err: any) {
    console.error("Create lead API error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
};
