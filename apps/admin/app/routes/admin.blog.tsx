import React from "react";
import { useLoaderData, Link, redirect } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { FileText, Plus } from "lucide-react";
import { 
  getAdminSession, 
  listPosts, 
  captureRuntimeEnv 
} from "@ekalliptus/core";
import SearchFilter from "../components/SearchFilter";
import Pagination from "../components/Pagination";
import EmptyState from "../components/EmptyState";
import StatusBadge from "../components/StatusBadge";

const LOCALE_FLAG: Record<string, string> = { 
  id: "🇮🇩", 
  en: "🇬🇧", 
  ja: "🇯🇵", 
  ko: "🇰🇷", 
  ru: "🇷🇺", 
  ar: "🇸🇦", 
  tr: "🇹🇷" 
};

export const loader = async ({ request, context }: LoaderFunctionArgs) => {
  const env = (context as any).cloudflare?.env;
  if (env) captureRuntimeEnv(env);

  const session = await getAdminSession(request.headers.get("Cookie"));
  if (!session) return redirect("/admin/login");

  const url = new URL(request.url);
  const search = url.searchParams.get("search") ?? "";
  const status = url.searchParams.get("status") ?? "";
  const locale = url.searchParams.get("locale") ?? "";
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));

  const { posts, total, totalPages } = await listPosts({
    search: search || undefined,
    status: (status || undefined) as any,
    locale: locale || undefined,
    page
  });

  return { posts, total, totalPages, page, search, status, locale, requestUrl: request.url };
};

export default function BlogList() {
  const { posts, total, totalPages, page, search, status, locale, requestUrl } = useLoaderData<typeof loader>();

  const filters = [
    { 
      name: "status", 
      label: "Status", 
      selected: status, 
      options: [
        { value: "", label: "Semua Status" },
        { value: "draft", label: "Draft" },
        { value: "published", label: "Published" },
        { value: "archived", label: "Archived" }
      ]
    },
    { 
      name: "locale", 
      label: "Bahasa", 
      selected: locale, 
      options: [
        { value: "", label: "Semua Bahasa" },
        { value: "id", label: "🇮🇩 Indonesia" },
        { value: "en", label: "🇬🇧 English" },
        { value: "ja", label: "🇯🇵 日本語" },
        { value: "ko", label: "🇰🇷 Korea" },
        { value: "ru", label: "🇷🇺 Rusia" },
        { value: "ar", label: "🇸🇦 Arab" },
        { value: "tr", label: "🇹🇷 Turki" }
      ]
    }
  ];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <span className="text-primary">{total}</span> post
        </h2>
        <Link 
          to="/admin/blog/new" 
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition active:scale-[0.98] cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" /> Tulis Post Baru
        </Link>
      </div>

      <SearchFilter
        placeholder="Cari judul..."
        value={search}
        name="search"
        action="/admin/blog"
        filters={filters}
      />

      <div className="glass-panel rounded-2xl p-5">
        {posts.length === 0 ? (
          <EmptyState icon={FileText} title="Belum ada post" ctaLabel="Tulis Post Pertama" ctaHref="/admin/blog/new" />
        ) : (
          <ul className="divide-y divide-border/40">
            {posts.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-3 group">
                <div className="min-w-0">
                  <Link to={`/admin/blog/${p.id}`} className="text-sm font-medium hover:text-primary transition">
                    {p.title}
                  </Link>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {LOCALE_FLAG[p.locale] ?? "🌐"} {p.category ?? "Uncategorized"} · {p.updated_at ? new Date(p.updated_at).toLocaleDateString("id-ID") : "-"}
                  </div>
                </div>
                <StatusBadge status={p.status} />
              </li>
            ))}
          </ul>
        )}
        <Pagination page={page} totalPages={totalPages} baseUrl={requestUrl} />
      </div>
    </div>
  );
}
