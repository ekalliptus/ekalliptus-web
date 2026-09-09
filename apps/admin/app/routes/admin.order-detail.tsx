import React from "react";
import { 
  useLoaderData, 
  useActionData,
  Link, 
  Form,
  redirect
} from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { ArrowLeft, Phone } from "lucide-react";
import { 
  getSupabase, 
  getAdminSession, 
  captureRuntimeEnv,
  writeAudit
} from "@ekalliptus/core";
import StatusBadge from "../components/StatusBadge";

const SERVICE_LABEL: Record<string, string> = { 
  website: "Website Development", 
  mobile: "Mobile App Development", 
  service_device: "Maintenance Server & Web", 
  wordpress: "Website", 
  editing: "Other" 
};

export const loader = async ({ params, request, context }: LoaderFunctionArgs) => {
  const env = (context as any).cloudflare?.env;
  if (env) captureRuntimeEnv(env);

  const session = await getAdminSession(request.headers.get("Cookie"));
  if (!session) return redirect("/admin/login");

  const supabase = getSupabase(true);
  if (!supabase || !params.id) return { order: null };

  const { data: order } = await supabase
    .from("orders")
    .select("*")
    .eq("id", params.id)
    .single();

  return { order };
};

export const action = async ({ params, request, context }: ActionFunctionArgs) => {
  const env = (context as any).cloudflare?.env;
  if (env) captureRuntimeEnv(env);

  const session = await getAdminSession(request.headers.get("Cookie"));
  if (!session) return redirect("/admin/login");

  try {
    const form = await request.formData();
    const status = String(form.get("status") ?? "");
    const supabase = getSupabase(true);

    if (!supabase || !params.id || !status) {
      return { error: "Parameter tidak lengkap." };
    }

    // Get old values for audit
    const { data: oldOrder } = await supabase
      .from("orders")
      .select("status, customer_name")
      .eq("id", params.id)
      .single();

    const { error } = await supabase
      .from("orders")
      .update({ status: status as any })
      .eq("id", params.id);

    if (error) {
      return { error: error.message };
    }

    // Write audit log
    try {
      await writeAudit({
        user_id: session.user.id,
        action: "update_status",
        table_name: "orders",
        record_id: params.id,
        old_values: { status: oldOrder?.status },
        new_values: { status, customer_name: oldOrder?.customer_name }
      });
    } catch (auditErr) {
      console.error("Audit log failed:", auditErr);
    }

    return { success: true };
  } catch (err) {
    console.error("Update status error:", err);
    return { error: "Terjadi kesalahan sistem." };
  }
};

export default function OrderDetail() {
  const { order } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  if (!order) {
    return (
      <div>
        <Link to="/admin/orders" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4 transition">
          <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke orders
        </Link>
        <div className="glass-panel rounded-2xl p-5 py-12 text-center text-destructive text-sm">
          Order tidak ditemukan.
        </div>
      </div>
    );
  }

  const waLink = order.whatsapp 
    ? `https://wa.me/${order.whatsapp.replace(/\D/g, "")}` 
    : "#";

  return (
    <div>
      <Link to="/admin/orders" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4 transition">
        <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke orders
      </Link>

      <div className="glass-panel rounded-2xl p-5">
        <div>
          <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
            <div>
              <h2 className="font-mono text-sm text-muted-foreground">ORD-{order.id.slice(0, 8)}</h2>
              <h1 className="text-xl font-bold tracking-tight mt-0.5">{order.customer_name || "N/A"}</h1>
            </div>
            {order.whatsapp && (
              <a 
                href={waLink} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="inline-flex items-center gap-1.5 rounded-lg bg-green-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-600 transition cursor-pointer"
              >
                <Phone className="h-3.5 w-3.5" /> WhatsApp
              </a>
            )}
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-lg border border-border bg-card/40 px-4 py-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Layanan</p>
              <p className="mt-1 text-sm font-medium">{SERVICE_LABEL[order.service_type] || order.service_type || "N/A"}</p>
            </div>
            <div className="rounded-lg border border-border bg-card/40 px-4 py-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Status</p>
              <div className="mt-1">
                <StatusBadge status={order.status} />
              </div>
            </div>
            <div className="rounded-lg border border-border bg-card/40 px-4 py-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">WhatsApp</p>
              <p className="mt-1 text-sm font-medium">{order.whatsapp || "-"}</p>
            </div>
            <div className="rounded-lg border border-border bg-card/40 px-4 py-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Dibuat</p>
              <p className="mt-1 text-sm font-medium">
                {order.created_at ? new Date(order.created_at).toLocaleString("id-ID") : "-"}
              </p>
            </div>
          </div>
          
          <div className="rounded-lg border border-border bg-card/40 px-4 py-3 mt-3">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-1">Deskripsi Project</p>
            <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
              {order.description || order.scope?.description || "Tidak ada deskripsi"}
            </p>
          </div>
        </div>
      </div>

      <div className="glass-panel rounded-2xl p-5 mt-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Update Status</h2>
        <Form method="post" className="flex gap-2 items-center flex-wrap">
          <select 
            name="status" 
            defaultValue={order.status}
            className="rounded-lg border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="new">Baru</option>
            <option value="contacted">Dihubungi</option>
            <option value="in_progress">Dikerjakan</option>
            <option value="done">Selesai</option>
            <option value="cancelled">Dibatalkan</option>
          </select>
          <button 
            type="submit" 
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition active:scale-[0.98] cursor-pointer"
          >
            Update
          </button>
        </Form>
        {actionData?.success && (
          <p className="mt-2 text-xs text-emerald-500 font-medium">✓ Status berhasil diperbarui</p>
        )}
        {actionData?.error && (
          <p className="mt-2 text-xs text-destructive font-medium">✗ Gagal: {actionData.error}</p>
        )}
      </div>
    </div>
  );
}
