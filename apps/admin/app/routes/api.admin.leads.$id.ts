import type { ActionFunctionArgs } from "react-router";
import { 
  getAdminSession, 
  requireRole,
  getLead, 
  updateLead, 
  deleteLead, 
  isValidStageTransition, 
  writeAudit, 
  captureRuntimeEnv 
} from "@ekalliptus/core";

// Matches the sidebar: the Pipeline (leads) page is visible to every admin
// role, so all known roles may mutate leads; anything else fails closed.
const LEAD_ROLES = ["admin", "finance", "cs", "tech", "editor"];

export const action = async ({ params, request, context }: ActionFunctionArgs) => {
  const env = (context as any).cloudflare?.env;
  if (env) captureRuntimeEnv(env);

  const session = requireRole(await getAdminSession(request.headers.get("Cookie")), LEAD_ROLES);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = params.id;
  if (!id) {
    return Response.json({ error: "Lead ID is required" }, { status: 400 });
  }

  const current = await getLead(id);
  if (!current) {
    return Response.json({ error: "Lead not found" }, { status: 404 });
  }

  const ip = request.headers.get("cf-connecting-ip") || "0.0.0.0";
  const ua = request.headers.get("user-agent");

  if (request.method === "PATCH") {
    try {
      const body = await request.json();
      
      if (body.stage) {
        if (!isValidStageTransition(current.stage, body.stage)) {
          return Response.json({ error: "Transition status tidak valid" }, { status: 400 });
        }
      }

      // Convert value to number if present
      if (body.estimated_value !== undefined) {
        body.estimated_value = body.estimated_value ? Number(body.estimated_value) : null;
      }

      const updated = await updateLead(id, body);
      if (!updated) {
        return Response.json({ error: "Failed to update lead" }, { status: 500 });
      }

      await writeAudit({
        user_id: session.user.id,
        action: "update",
        table_name: "leads",
        record_id: updated.id,
        old_values: current,
        new_values: updated,
        ip_address: ip,
        user_agent: ua
      });

      return Response.json({ lead: updated }, { status: 200 });
    } catch (err: any) {
      return Response.json({ error: err.message || "Internal server error" }, { status: 500 });
    }
  }

  if (request.method === "DELETE") {
    try {
      const ok = await deleteLead(id);
      if (ok) {
        await writeAudit({
          user_id: session.user.id,
          action: "delete",
          table_name: "leads",
          record_id: id,
          old_values: current,
          ip_address: ip,
          user_agent: ua
        });
      }
      return Response.json({ success: ok }, { status: ok ? 200 : 500 });
    } catch (err: any) {
      return Response.json({ error: err.message || "Internal server error" }, { status: 500 });
    }
  }

  return Response.json({ error: "Method not allowed" }, { status: 405 });
};
