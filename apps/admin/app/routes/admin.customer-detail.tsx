import React, { useState } from "react";
import { useLoaderData, Link, redirect } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { Mail, Phone, Building2, Calendar, ArrowLeft } from "lucide-react";
import { 
  getAdminSession, 
  requireRole,
  ADMIN_CUSTOMER_ROLES,
  getCustomerDetail, 
  formatIDR, 
  captureRuntimeEnv 
} from "@ekalliptus/core";

export const loader = async ({ params, request, context }: LoaderFunctionArgs) => {
  const env = (context as any).cloudflare?.env;
  if (env) captureRuntimeEnv(env);

  const rawSession = await getAdminSession(request.headers.get("Cookie"));
  if (!rawSession) return redirect("/admin/login");
  if (!requireRole(rawSession, ADMIN_CUSTOMER_ROLES)) return redirect("/admin");

  if (!params.id) return redirect("/admin/customers");
  
  const customer = await getCustomerDetail(params.id);
  if (!customer) {
    return redirect("/admin/customers");
  }

  return { customer };
};

export default function CustomerDetail() {
  const { customer } = useLoaderData<typeof loader>();
  const [activeTab, setActiveTab] = useState<"orders" | "payments" | "consultations">("orders");

  const initials = customer.customer_name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const formatDate = (s: string | null) => 
    s ? new Date(s).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "-";

  return (
    <div>
      <Link to="/admin/customers" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4 transition">
        <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke pelanggan
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        {/* Profile */}
        <div className="space-y-4">
          <div className="glass-panel rounded-2xl p-6 text-center">
            <div className="mx-auto mb-3 h-16 w-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold">
              {initials}
            </div>
            <h2 className="font-bold text-lg">{customer.customer_name}</h2>
            {customer.company && <p className="text-sm text-muted-foreground">{customer.company}</p>}
            <div className="mt-4 space-y-2 text-left text-sm">
              {customer.email && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-4 w-4" /> {customer.email}
                </div>
              )}
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-4 w-4" /> {customer.whatsapp}
              </div>
              {customer.company && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Building2 className="h-4 w-4" /> {customer.company}
                </div>
              )}
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" /> Sejak {formatDate(customer.last_order_at)}
              </div>
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Ringkasan</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Total Order</dt>
                <dd className="font-bold">{customer.total_orders}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Total Spend</dt>
                <dd className="font-bold text-green-600">{formatIDR(customer.total_spent)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Konsultasi</dt>
                <dd className="font-bold">{customer.consultations.length}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Layanan Utama</dt>
                <dd className="font-medium">{customer.primary_service}</dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Tabs and Panels */}
        <div className="glass-panel rounded-2xl p-6">
          <div className="flex gap-2 border-b border-border mb-4 overflow-x-auto" role="tablist">
            <button 
              className={`px-3 py-2 text-sm font-medium border-b-2 transition ${
                activeTab === "orders" ? "border-primary text-primary" : "border-transparent text-muted-foreground"
              }`}
              onClick={() => setActiveTab("orders")}
            >
              Orders ({customer.orders.length})
            </button>
            <button 
              className={`px-3 py-2 text-sm font-medium border-b-2 transition ${
                activeTab === "payments" ? "border-primary text-primary" : "border-transparent text-muted-foreground"
              }`}
              onClick={() => setActiveTab("payments")}
            >
              Payments ({customer.payments.length})
            </button>
            <button 
              className={`px-3 py-2 text-sm font-medium border-b-2 transition ${
                activeTab === "consultations" ? "border-primary text-primary" : "border-transparent text-muted-foreground"
              }`}
              onClick={() => setActiveTab("consultations")}
            >
              Consultations ({customer.consultations.length})
            </button>
          </div>

          {activeTab === "orders" && (
            <div className="space-y-1">
              {customer.orders.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">Belum ada order.</p>
              ) : (
                customer.orders.map((o: any) => (
                  <div key={o.id} className="flex items-center justify-between py-3 border-b border-border/40 text-sm">
                    <div>
                      <div className="font-mono text-xs text-muted-foreground">ORD-{o.id.slice(0, 8)}</div>
                      <div className="font-medium">{o.service_type}</div>
                      <div className="text-xs text-muted-foreground">{formatDate(o.created_at)}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">{formatIDR(Number((o.pricing as any)?.grand_total ?? 0))}</div>
                      <div className="text-xs text-muted-foreground">{o.status}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === "payments" && (
            <div className="space-y-1">
              {customer.payments.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">Belum ada pembayaran.</p>
              ) : (
                customer.payments.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between py-3 border-b border-border/40 text-sm">
                    <div>
                      <div className="font-medium">{p.gateway}</div>
                      <div className="text-xs text-muted-foreground">{formatDate(p.created_at)}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">{formatIDR(Number(p.amount))}</div>
                      <div className="text-xs">{p.status}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === "consultations" && (
            <div className="space-y-1">
              {customer.consultations.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">Belum ada konsultasi.</p>
              ) : (
                customer.consultations.map((c: any) => (
                  <div key={c.id} className="py-3 border-b border-border/40 text-sm">
                    <div className="font-medium">{c.visitor_name ?? "Konsultasi"}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(c.created_at)} · status {c.status}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
