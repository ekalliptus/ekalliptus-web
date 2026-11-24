import React from "react";
import { useLoaderData, useLocation, Link, redirect } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { ShoppingCart, Eye } from "lucide-react";
import { 
  getSupabase, 
  getAdminSession, 
  requireRole,
  ADMIN_ORDER_ROLES,
  sanitizePostgrestSearch,
  captureRuntimeEnv 
} from "@ekalliptus/core";
import SearchFilter from "../components/SearchFilter";
import DataTable from "../components/DataTable";
import Pagination from "../components/Pagination";
import EmptyState from "../components/EmptyState";
import StatusBadge from "../components/StatusBadge";

const SERVICE_LABEL: Record<string, string> = { 
  website: "Website", 
  mobile: "Mobile App", 
  service_device: "Maintenance", 
  wordpress: "Web", 
  editing: "Other" 
};

export const loader = async ({ request, context }: LoaderFunctionArgs) => {
  const env = (context as any).cloudflare?.env;
  if (env) captureRuntimeEnv(env);

  const rawSession = await getAdminSession(request.headers.get("Cookie"));
  if (!rawSession) {
    return redirect("/admin/login");
  }
  if (!requireRole(rawSession, ADMIN_ORDER_ROLES)) {
    return redirect("/admin");
  }

  const url = new URL(request.url);
  const search = url.searchParams.get("search") ?? "";
  const safeSearch = sanitizePostgrestSearch(search);
  const service = url.searchParams.get("service") ?? "";
  const status = url.searchParams.get("status") ?? "";
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
  const pageSize = 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const supabase = getSupabase(true);
  let orders: any[] = [];
  let total = 0;

  if (supabase) {
    let q = supabase.from("orders").select("*", { count: "exact" }).order("created_at", { ascending: false }).range(from, to);
    if (safeSearch) q = q.or(`customer_name.ilike.%${safeSearch}%,whatsapp.ilike.%${safeSearch}%`);
    if (service) q = q.eq("service_type", service);
    if (status) q = q.eq("status", status);
    
    const { data, count } = await q;
    orders = data ?? [];
    total = count ?? 0;
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return { orders, total, page, totalPages, search, service, status, requestUrl: request.url };
};

export default function Orders() {
  const { orders, total, page, totalPages, search, service, status, requestUrl } = useLoaderData<typeof loader>();

  const filters = [
    { 
      name: "service", 
      label: "Layanan", 
      selected: service, 
      options: [
        { value: "", label: "Semua Layanan" },
        { value: "website", label: "Website" },
        { value: "mobile", label: "Mobile App" },
        { value: "service_device", label: "Maintenance" }
      ]
    },
    { 
      name: "status", 
      label: "Status", 
      selected: status, 
      options: [
        { value: "", label: "Semua Status" },
        { value: "new", label: "Baru" },
        { value: "contacted", label: "Dihubungi" },
        { value: "in_progress", label: "Dikerjakan" },
        { value: "done", label: "Selesai" },
        { value: "cancelled", label: "Dibatalkan" }
      ]
    }
  ];

  return (
    <div>
      <SearchFilter
        placeholder="Cari nama, WA..."
        value={search}
        name="search"
        action="/admin/orders"
        filters={filters}
      />

      <div className="glass-panel rounded-2xl p-5">
        <div className="mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <span className="text-primary">{total}</span> order
          </h2>
        </div>
        
        {orders.length === 0 ? (
          <EmptyState icon={ShoppingCart} title="Belum ada order" description="Order yang masuk akan muncul di sini." />
        ) : (
          <>
            <DataTable
              headers={
                <>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Layanan</th>
                  <th>Status</th>
                  <th>Tanggal</th>
                  <th></th>
                </>
              }
            >
              {orders.map((o) => (
                <tr key={o.id} className="dt-row">
                  <td className="dt-cell font-mono text-xs">ORD-{o.id.slice(0, 8)}</td>
                  <td className="dt-cell">
                    <div className="font-medium text-sm">{o.customer_name}</div>
                    <div className="text-xs text-muted-foreground">{o.whatsapp}</div>
                  </td>
                  <td className="dt-cell">
                    <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      {SERVICE_LABEL[o.service_type] ?? o.service_type}
                    </span>
                  </td>
                  <td className="dt-cell">
                    <StatusBadge status={o.status} />
                  </td>
                  <td className="dt-cell text-xs text-muted-foreground">
                    {o.created_at ? new Date(o.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short" }) : "-"}
                  </td>
                  <td className="dt-cell text-right">
                    <Link to={`/admin/orders/${o.id}`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                      <Eye className="h-3.5 w-3.5" /> Detail
                    </Link>
                  </td>
                </tr>
              ))}
            </DataTable>
            <Pagination page={page} totalPages={totalPages} baseUrl={requestUrl} />
          </>
        )}
      </div>
    </div>
  );
}
