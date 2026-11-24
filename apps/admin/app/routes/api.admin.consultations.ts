import type { LoaderFunctionArgs } from "react-router";
import { 
  getAdminSession, 
  requireRole,
  ADMIN_CONSULTATION_ROLES,
  getSupabase, 
  captureRuntimeEnv 
} from "@ekalliptus/core";

export const loader = async ({ request, context }: LoaderFunctionArgs) => {
  const env = (context as any).cloudflare?.env;
  if (env) captureRuntimeEnv(env);

  const rawSession = await getAdminSession(request.headers.get("Cookie"));
  if (!rawSession) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!requireRole(rawSession, ADMIN_CONSULTATION_ROLES)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const supabase = getSupabase(true);
    if (!supabase) {
      return Response.json({ consultations: [] }, { status: 200 });
    }

    const { data: consultations, error } = await supabase
      .from("consultations")
      .select("*")
      .order("last_message_at", { ascending: false })
      .limit(50);

    if (error) {
      if (error.code === "42703" || error.code === "42P01") {
        return Response.json({ consultations: [], needsMigration: true }, { status: 200 });
      }
      return Response.json({ error: "Failed to fetch consultations" }, { status: 500 });
    }

    const ids = (consultations || []).map((item) => item.id);
    const { data: messages, error: messagesError } = ids.length > 0
      ? await supabase
          .from("consultation_messages")
          .select("*")
          .in("consultation_id", ids)
          .order("created_at", { ascending: true })
      : { data: [], error: null };

    if (messagesError) {
      console.error("Consultation messages fetch error:", messagesError);
    }

    const messagesByConsultation = new Map<string, any[]>();
    for (const message of messages || []) {
      const existing = messagesByConsultation.get(message.consultation_id) || [];
      existing.push(message);
      messagesByConsultation.set(message.consultation_id, existing);
    }

    const formatted = (consultations || []).map((consultation) => ({
      ...consultation,
      messages: messagesByConsultation.get(consultation.id) || []
    }));

    return Response.json({ consultations: formatted }, { status: 200 });
  } catch (error: any) {
    console.error("Consultations API error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
};
