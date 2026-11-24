import React from "react";
import { useLoaderData, Link, redirect } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { Package, MessageSquare, Users, TrendingUp, ArrowUpRight, ShoppingCart } from "lucide-react";
import { 
  getSupabase, 
  getAdminSession, 
  countLeadsByStage, 
  LEAD_STAGE_ORDER, 
  LEAD_STAGE_LABELS, 
  formatIDR,
  captureRuntimeEnv
} from "@ekalliptus/core";
import StatCard from "../components/StatCard";
import RevenueChart from "../components/RevenueChart";
import EmptyState from "../components/EmptyState";
import StatusBadge from "../components/StatusBadge";
import ActivityFeed from "../components/ActivityFeed";

const SERVICE_LABEL: Record<string, string> = { 
  website: "Web", 
  mobile: "Mobile", 
  service_device: "Maintenance", 
  wordpress: "Web", 
  editing: "Other" 
};

export const loader = async ({ request, context }: LoaderFunctionArgs) => {
  const env = (context as any).cloudflare?.env;
  if (env) captureRuntimeEnv(env);

  const session = await getAdminSession(request.headers.get("Cookie"));
  if (!session) {
    return redirect("/admin/login");
  }

  const canViewBusiness = session.role !== "editor";
  const supabase = canViewBusiness ? getSupabase(true) : null;
  
  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const sevenDaysAgo = new Date(now); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6); sevenDaysAgo.setHours(0, 0, 0, 0);

  let stats = { newOrders: "0", activeChats: "0", openLeads: "0", conversionRate: "0%" };
  let series: Array<{ day: string; value: number }> = [];
  let recentOrders: any[] = [];
  let leadCounts: Record<string, number> = {};

  if (supabase) {
    const [newOrdersRes, monthOrdersRes, chatsRes, recentRes, weekly, paidRes] = await Promise.all([
      supabase.from("orders").select("id", { count: "exact", head: true }).gte("created_at", todayStart.toISOString()),
      supabase.from("orders").select("id", { count: "exact", head: true }).gte("created_at", monthStart.toISOString()),
      supabase.from("consultations").select("id", { count: "exact", head: true }).in("status", ["scheduled"]),
      supabase.from("orders").select("id, customer_name, whatsapp, service_type, status, created_at").order("created_at", { ascending: false }).limit(5),
      supabase.from("payments").select("amount, paid_at").eq("status", "paid").gte("paid_at", sevenDaysAgo.toISOString()),
      supabase.from("payments").select("id", { count: "exact", head: true }).eq("status", "paid").gte("created_at", monthStart.toISOString())
    ]);

    const orderCount = monthOrdersRes.count ?? 0;
    const paid = paidRes.count ?? 0;
    stats = {
      newOrders: String(newOrdersRes.count ?? 0),
      activeChats: String(chatsRes.count ?? 0),
      openLeads: "0",
      conversionRate: orderCount > 0 ? `${((paid / orderCount) * 100).toFixed(0)}%` : "0%"
    };

    const buckets = new Map<string, number>();
    for (let i = 0; i < 7; i++) {
      const d = new Date(sevenDaysAgo); d.setDate(d.getDate() + i);
      buckets.set(d.toISOString().slice(0, 10), 0);
    }
    for (const p of weekly.data ?? []) {
      const day = String(p.paid_at).slice(0, 10);
      buckets.set(day, (buckets.get(day) ?? 0) + Number(p.amount ?? 0));
    }
    series = Array.from(buckets.entries()).map(([day, value]) => ({ day, value }));
    recentOrders = recentRes.data ?? [];
    
    // Calculate leads
    leadCounts = await countLeadsByStage();
    const openStages = LEAD_STAGE_ORDER.filter(s => s !== "won" && s !== "lost");
    stats.openLeads = String(openStages.reduce((sum, s) => sum + (leadCounts[s] ?? 0), 0));
  }

  const today = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long" }).format(now);

  return { stats, series, recentOrders, leadCounts, today };
};

export default function Dashboard() {
  const { stats, series, recentOrders, leadCounts, today } = useLoaderData<typeof loader>();

  return (
    <div className="space-y-6">
      {/* Welcome banner (slim) */}
      <div className="glass-panel rounded-2xl p-5 sm:p-6 relative overflow-hidden">
        <div className="bg-primary/10 absolute inset-0"></div>
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{today}</p>
            <h2 className="mt-0.5 text-xl font-bold tracking-tight">Selamat datang kembali 👋</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Ringkasan aktivitas bisnis Anda hari ini.</p>
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard icon={Package} value={stats.newOrders} label="Order Baru Hari Ini" valueId="stat-today-revenue" />
        <StatCard icon={MessageSquare} iconColorClass="text-blue-500" value={stats.activeChats} label="Chat Aktif" valueId="stat-monthly-orders" />
        <StatCard icon={Users} iconColorClass="text-purple-500" value={stats.openLeads} label="Leads Open" valueId="stat-pending-payments" />
        <StatCard icon={TrendingUp} iconColorClass="text-green-500" value={stats.conversionRate} label="Konversi" valueId="stat-conversion" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2 glass-panel rounded-2xl p-5">
          <h2 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wide">Revenue 7 Hari</h2>
          <RevenueChart series={series} />
        </div>
        <div className="flex flex-col gap-4 sm:gap-6">
          <div className="glass-panel rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Pipeline</h2>
              <Link to="/admin/pipeline" className="text-[11px] text-primary hover:underline">Board →</Link>
            </div>
            <div className="space-y-1.5 text-sm">
              {LEAD_STAGE_ORDER.map((stage) => (
                <div key={stage} className="flex items-center justify-between py-1">
                  <span className="text-muted-foreground text-xs">{LEAD_STAGE_LABELS[stage]}</span>
                  <span className="font-semibold text-sm">{leadCounts[stage] ?? 0}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <ActivityFeed />
          </div>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="glass-panel rounded-2xl p-5 cv-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Order Terbaru</h2>
          <Link to="/admin/orders" className="flex items-center gap-1 text-xs text-primary hover:underline">
            Semua <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {recentOrders.length === 0 ? (
          <EmptyState icon={ShoppingCart} title="Belum ada order" description="Order baru akan muncul di sini." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="pb-2 pr-3 font-semibold">Order</th>
                  <th className="pb-2 pr-3 font-semibold">Customer</th>
                  <th className="pb-2 pr-3 font-semibold">Layanan</th>
                  <th className="pb-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((o) => (
                  <tr key={o.id} className="dt-row">
                    <td className="dt-cell font-mono text-xs py-2 pr-3">ORD-{o.id.slice(0, 8)}</td>
                    <td className="dt-cell py-2 pr-3">{o.customer_name}</td>
                    <td className="dt-cell py-2 pr-3">
                      <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        {SERVICE_LABEL[o.service_type] ?? o.service_type}
                      </span>
                    </td>
                    <td className="dt-cell py-2">
                      <StatusBadge status={o.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
