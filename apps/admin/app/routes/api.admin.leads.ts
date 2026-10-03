import type { ActionFunctionArgs } from "react-router";
import { 
  getAdminSession, 
  requireRole,
  createLead, 
  writeAudit, 
  captureRuntimeEnv 
} from "@ekalliptus/core";

// Matches the sidebar: the Pipeline (leads) page is visible to every admin
// role, so all known roles may mutate leads; anything else fails closed.
const LEAD_ROLES = ["admin", "finance", "cs", "tech", "editor"];

export const action = async ({ request, context }: ActionFunctionArgs) => {
  const env = (context as any).cloudflare?.env;
  if (env) captureRuntimeEnv(env);

  const session = requireRole(await getAdminSession(request.headers.get("Cookie")), LEAD_ROLES);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
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
    return Response.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
};
