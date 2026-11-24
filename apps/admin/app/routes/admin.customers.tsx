import React from "react";
import { useLoaderData, Link, redirect } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { Users, Eye } from "lucide-react";
import { 
  getAdminSession, 
  requireRole,
  ADMIN_CUSTOMER_ROLES,
  listCustomers, 
  formatIDR, 
  captureRuntimeEnv 
} from "@ekalliptus/core";
import SearchFilter from "../components/SearchFilter";
import DataTable from "../components/DataTable";
import Pagination from "../components/Pagination";
import EmptyState from "../components/EmptyState";

export const loader = async ({ request, context }: LoaderFunctionArgs) => {
  const env = (context as any).cloudflare?.env;
  if (env) captureRuntimeEnv(env);

  const rawSession = await getAdminSession(request.headers.get("Cookie"));
  if (!rawSession) return redirect("/admin/login");
  if (!requireRole(rawSession, ADMIN_CUSTOMER_ROLES)) return redirect("/admin");

  const url = new URL(request.url);
  const search = url.searchParams.get("search") ?? "";
  const service = url.searchParams.get("service") ?? "";
  const sort = (url.searchParams.get("sort") ?? "recent") as "recent" | "spend" | "orders";
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));

  const { customers, total, totalPages } = await listCustomers({ search, service, sort, page });

  return { customers, total, totalPages, page, search, service, sort, requestUrl: request.url };
};

export default function Customers() {
  const { customers, total, totalPages, page, search, service, sort, requestUrl } = useLoaderData<typeof loader>();

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
      name: "sort",
      label: "Urutkan",
      selected: sort,
      options: [
        { value: "recent", label: "Terbaru" },
        { value: "spend", label: "Total Spend" },
        { value: "orders", label: "Total Order" }
      ]
    }
  ];

  return (
    <div>
      <SearchFilter
        placeholder="Cari nama, email, WhatsApp..."
        value={search}
        name="search"
        action="/admin/customers"
        filters={filters}
      />

      <div className="glass-panel rounded-2xl p-5">
        <div className="mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <span className="text-primary">{total}</span> pelanggan
          </h2>
        </div>

        {customers.length === 0 ? (
          <EmptyState icon={Users} title="Belum ada pelanggan" description="Pelanggan muncul setelah order pertama masuk." />
        ) : (
          <>
            <DataTable
              headers={
                <>
                  <th>Nama</th>
                  <th>Kontak</th>
                  <th>Layanan</th>
                  <th className="text-right">Order</th>
                  <th className="text-right">Spend</th>
                  <th></th>
                </>
              }
            >
              {customers.map((c) => (
                <tr key={c.id} className="dt-row">
                  <td className="dt-cell">
                    <div className="font-medium text-sm">{c.customer_name}</div>
                    {c.company && <div className="text-xs text-muted-foreground">{c.company}</div>}
                  </td>
                  <td className="dt-cell text-xs text-muted-foreground">
                    {c.email && <div>{c.email}</div>}
                    <div>{c.whatsapp}</div>
                  </td>
                  <td className="dt-cell">
                    <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      {c.primary_service}
                    </span>
                  </td>
                  <td className="dt-cell text-right font-medium text-sm">{c.total_orders}</td>
                  <td className="dt-cell text-right font-semibold text-sm">{formatIDR(c.total_spent)}</td>
                  <td className="dt-cell text-right">
                    <Link to={`/admin/customers/${c.id}`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
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
