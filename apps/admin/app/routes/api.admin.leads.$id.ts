import type { ActionFunctionArgs } from "react-router";
import { 
  getAdminSession, 
  requireRole,
  ADMIN_LEAD_ROLES,
  ADMIN_LEAD_DELETE_ROLES,
  LEAD_STAGE_ORDER,
  getLead, 
  updateLead, 
  deleteLead, 
  isValidStageTransition, 
  writeAudit, 
  captureRuntimeEnv 
} from "@ekalliptus/core";

export const action = async ({ params, request, context }: ActionFunctionArgs) => {
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
      const body = await request.json().catch(() => null);
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        return Response.json({ error: "Invalid request body" }, { status: 400 });
      }

      const updatePayload: Record<string, unknown> = {};
      if (typeof body.name === "string" && body.name.trim()) updatePayload.name = body.name.trim().slice(0, 120);
      if (body.whatsapp === null || typeof body.whatsapp === "string") updatePayload.whatsapp = body.whatsapp;
      if (body.email === null || typeof body.email === "string") updatePayload.email = body.email;
      if (body.company === null || typeof body.company === "string") updatePayload.company = body.company;
      if (body.service_interest === null || typeof body.service_interest === "string") {
        updatePayload.service_interest = body.service_interest;
      }
      if (body.notes === null || typeof body.notes === "string") updatePayload.notes = body.notes;
      if (body.stage !== undefined) {
        if (!LEAD_STAGE_ORDER.includes(body.stage) || !isValidStageTransition(current.stage, body.stage)) {
          return Response.json({ error: "Transition status tidak valid" }, { status: 400 });
        }
        updatePayload.stage = body.stage;
      }
      if (body.estimated_value !== undefined) {
        if (body.estimated_value === null || body.estimated_value === "") {
          updatePayload.estimated_value = null;
        } else {
          const parsedVal = Number(body.estimated_value);
          if (!Number.isFinite(parsedVal) || parsedVal < 0) {
            return Response.json({ error: "Estimasi nilai tidak valid" }, { status: 400 });
          }
          updatePayload.estimated_value = parsedVal;
        }
      }

      if (Object.keys(updatePayload).length === 0) {
        return Response.json({ error: "Tidak ada field valid untuk diperbarui" }, { status: 400 });
      }

      const updated = await updateLead(id, updatePayload as any);
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
      console.error("Update lead API error:", err);
      return Response.json({ error: "Internal server error" }, { status: 500 });
    }
  }

  if (request.method === "DELETE") {
    if (!requireRole(rawSession, ADMIN_LEAD_DELETE_ROLES)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
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
      console.error("Delete lead API error:", err);
      return Response.json({ error: "Internal server error" }, { status: 500 });
    }
  }

  return Response.json({ error: "Method not allowed" }, { status: 405 });
};
