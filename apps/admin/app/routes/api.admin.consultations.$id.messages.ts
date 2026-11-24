import type { ActionFunctionArgs } from "react-router";
import { 
  getAdminSession, 
  requireRole,
  ADMIN_CONSULTATION_ROLES,
  getSupabase, 
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
  const session = requireRole(rawSession, ADMIN_CONSULTATION_ROLES);
  if (!session) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const id = params.id;
  if (!id) {
    return Response.json({ error: "Consultation ID is required" }, { status: 400 });
  }

  try {
    const { content, sender_name = "Admin" } = await request.json();

    if (typeof content !== "string" || !content.trim()) {
      return Response.json({ error: "Message content is required" }, { status: 400 });
    }

    const supabase = getSupabase(true);
    if (!supabase) {
      return Response.json({ error: "Database connection failed" }, { status: 500 });
    }

    const { data: consultation, error: consultationError } = await supabase
      .from("consultations")
      .select("id, session_id")
      .eq("id", id)
      .single();

    if (consultationError || !consultation) {
      return Response.json({ error: "Consultation not found" }, { status: 404 });
    }

    const messagePayload = {
      consultation_id: consultation.id,
      session_id: consultation.session_id,
      sender_type: "admin",
      sender_name: session.displayName || sender_name,
      content: content.trim().slice(0, 2000),
      is_read: true
    };

    const { data: insertedMessage, error: insertError } = await supabase
      .from("consultation_messages")
      .insert(messagePayload)
      .select()
      .single();

    if (insertError || !insertedMessage) {
      console.error("Admin reply insert error:", insertError);
      return Response.json({ error: "Failed to send message" }, { status: 500 });
    }

    // Update consultation status and last message details
    await supabase
      .from("consultations")
      .update({
        last_message: messagePayload.content,
        last_message_at: new Date().toISOString(),
        unread_count: 0,
        status: "scheduled",
        updated_at: new Date().toISOString()
      })
      .eq("id", id);

    // Write audit log
    await writeAudit({
      user_id: session.user.id,
      action: "create",
      table_name: "consultation_messages",
      record_id: insertedMessage.id,
      new_values: insertedMessage,
      ip_address: request.headers.get("cf-connecting-ip") || "0.0.0.0",
      user_agent: request.headers.get("user-agent")
    });

    return Response.json({ message: insertedMessage }, { status: 201 });
  } catch (error: any) {
    console.error("Admin consultation reply error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
};
