import React from "react";
import { useLoaderData, Form, redirect } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { History } from "lucide-react";
import { 
  getAdminSession, 
  listAudit, 
  captureRuntimeEnv 
} from "@ekalliptus/core";
import Pagination from "../components/Pagination";
import EmptyState from "../components/EmptyState";

const actionVariant: Record<string, string> = {
  create: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  update: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  delete: "bg-destructive/15 text-destructive",
};

export const loader = async ({ request, context }: LoaderFunctionArgs) => {
  const env = (context as any).cloudflare?.env;
  if (env) captureRuntimeEnv(env);

  const session = await getAdminSession(request.headers.get("Cookie"));
  if (!session || (session.role !== "owner" && session.role !== "admin")) {
    return redirect("/admin/login");
  }

  const url = new URL(request.url);
  const table = url.searchParams.get("table") ?? "";
  const action = url.searchParams.get("action") ?? "";
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));

  const { rows, total, totalPages } = await listAudit({ 
    table: table || undefined, 
    action: action || undefined, 
    page 
  });
  
  return { rows, total, totalPages, page, table, action, requestUrl: request.url };
};

export default function AuditLogs() {
  const { rows, total, totalPages, page, table, action, requestUrl } = useLoaderData<typeof loader>();

  return (
    <div>
      <Form method="get" action="/admin/audit-logs" className="glass-panel rounded-2xl p-4 mb-6 flex gap-3 flex-wrap items-center">
        <select 
          name="table" 
          defaultValue={table}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">Semua tabel</option>
          <option value="orders">orders</option>
          <option value="payments">payments</option>
          <option value="leads">leads</option>
          <option value="activities">activities</option>
          <option value="blog_posts">blog_posts</option>
          <option value="vouchers">vouchers</option>
        </select>
        
        <select 
          name="action" 
          defaultValue={action}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">Semua aksi</option>
          <option value="create">create</option>
          <option value="update">update</option>
          <option value="delete">delete</option>
        </select>
        
        <button 
          type="submit" 
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition shadow-sm cursor-pointer"
        >
          Filter
        </button>
      </Form>

      <div className="glass-panel rounded-2xl p-6">
        {rows.length === 0 ? (
          <EmptyState icon={History} title="Belum ada audit log" />
        ) : (
          <ul className="divide-y divide-border/40">
            {rows.map((r) => (
              <li key={r.id} className="py-3 text-sm">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 font-medium">
                    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${actionVariant[r.action] || "bg-muted text-muted-foreground"}`}>
                      {r.action}
                    </span>
                    <span className="text-muted-foreground">{r.table_name}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {r.created_at ? new Date(r.created_at).toLocaleString("id-ID") : "-"}
                  </span>
                </div>
                {r.record_id && <div className="text-xs text-muted-foreground font-mono">id: {r.record_id}</div>}
                {r.new_values && (
                  <details className="mt-1 group">
                    <summary className="text-xs cursor-pointer text-primary list-none select-none hover:underline">
                      Lihat perubahan
                    </summary>
                    <pre className="text-xs bg-muted/30 border border-border/30 rounded-md p-2 mt-1 overflow-x-auto font-mono">
                      {JSON.stringify({ old: r.old_values, new: r.new_values }, null, 2)}
                    </pre>
                  </details>
                )}
              </li>
            ))}
          </ul>
        )}
        <Pagination page={page} totalPages={totalPages} baseUrl={requestUrl} />
      </div>
    </div>
  );
}
