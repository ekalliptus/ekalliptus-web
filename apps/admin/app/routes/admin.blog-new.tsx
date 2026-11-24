import React from "react";
import { Form, redirect, useActionData, Link } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { ArrowLeft } from "lucide-react";
import { 
  getAdminSession, 
  requireRole,
  ADMIN_BLOG_ROLES,
  createPost, 
  writeAudit, 
  captureRuntimeEnv 
} from "@ekalliptus/core";

const BlogEditor = React.lazy(() => import("../components/editor/BlogEditor"));

export const loader = async ({ request, context }: LoaderFunctionArgs) => {
  const env = (context as any).cloudflare?.env;
  if (env) captureRuntimeEnv(env);

  const rawSession = await getAdminSession(request.headers.get("Cookie"));
  if (!rawSession) return redirect("/admin/login");
  if (!requireRole(rawSession, ADMIN_BLOG_ROLES)) return redirect("/admin");
  return null;
};

export const action = async ({ request, context }: ActionFunctionArgs) => {
  const env = (context as any).cloudflare?.env;
  if (env) captureRuntimeEnv(env);

  const rawSession = await getAdminSession(request.headers.get("Cookie"));
  if (!rawSession) return redirect("/admin/login");
  const session = requireRole(rawSession, ADMIN_BLOG_ROLES);
  if (!session) return Response.json({ error: "Forbidden" }, { status: 403 });

  try {
    const form = await request.formData();
    const title = String(form.get("title") ?? "").trim();
    const slug = String(form.get("slug") ?? "").trim();
    const locale = String(form.get("locale") ?? "id");
    const category = String(form.get("category") ?? "").trim();
    const tagsRaw = String(form.get("tags") ?? "");
    const description = String(form.get("description") ?? "").trim();
    const body_html = String(form.get("body_html") ?? "");
    const image = String(form.get("image") ?? "").trim() || null;
    const image_alt = String(form.get("image_alt") ?? "").trim() || null;
    const status = String(form.get("status") ?? "draft");
    const featured = form.get("featured") === "on";

    if (!title || !slug) {
      return { error: "Judul dan Slug wajib diisi." };
    }

    const tags = tagsRaw.split(",").map(t => t.trim()).filter(Boolean);

    const post = await createPost({
      title,
      slug,
      locale,
      category: category || "Uncategorized",
      tags,
      description,
      body_html,
      image,
      image_alt,
      status: status as any,
      featured,
      author: session.displayName || "Admin"
    });

    if (!post) {
      return { error: "Gagal membuat blog post." };
    }

    // Write audit log
    await writeAudit({
      user_id: session.user.id,
      action: "create",
      table_name: "blog_posts",
      record_id: post.id,
      new_values: post,
      ip_address: request.headers.get("cf-connecting-ip") || "0.0.0.0",
      user_agent: request.headers.get("user-agent")
    });

    return redirect("/admin/blog");
  } catch (err: any) {
    console.error("Create blog error:", err);
    return { error: "Terjadi kesalahan sistem." };
  }
};

export default function BlogNew() {
  const actionData = useActionData<typeof action>();

  return (
    <div>
      <Link to="/admin/blog" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4 transition">
        <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke blog
      </Link>

      {actionData?.error && (
        <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive max-w-3xl">
          {actionData.error}
        </div>
      )}

      <Form method="post" className="glass-panel rounded-2xl p-5 sm:p-6 max-w-3xl space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Judul</span>
            <input 
              name="title" 
              required 
              className="mt-1.5 block w-full rounded-lg border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition" 
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Slug</span>
            <input 
              name="slug" 
              required 
              className="mt-1.5 block w-full rounded-lg border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition" 
            />
          </label>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="block">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Bahasa</span>
            <select name="locale" required className="mt-1.5 block w-full rounded-lg border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
              <option value="id">🇮🇩 Indonesia</option>
              <option value="en">🇬🇧 English</option>
              <option value="ja">🇯🇵 日本語</option>
              <option value="ko">🇰🇷 한국어</option>
              <option value="ru">🇷🇺 Русский</option>
              <option value="ar">🇸🇦 العربية</option>
              <option value="tr">🇹🇷 Türkçe</option>
            </select>
          </label>
          <label className="block">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Kategori</span>
            <input name="category" className="mt-1.5 block w-full rounded-lg border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition" />
          </label>
          <label className="block">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Tags (pisah koma)</span>
            <input name="tags" className="mt-1.5 block w-full rounded-lg border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition" />
          </label>
        </div>
        
        <label className="block">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Deskripsi (meta)</span>
          <textarea name="description" rows={2} className="mt-1.5 block w-full rounded-lg border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none transition"></textarea>
        </label>
        
        <div className="block">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Konten</span>
          <React.Suspense
            fallback={
              <div className="h-64 rounded-lg border border-border bg-input/40 p-4 text-xs text-muted-foreground">
                Memuat editor konten...
              </div>
            }
          >
            <BlogEditor />
          </React.Suspense>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="block">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Image URL</span>
            <input name="image" className="mt-1.5 block w-full rounded-lg border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition" />
          </label>
          <label className="block">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Image Alt</span>
            <input name="image_alt" className="mt-1.5 block w-full rounded-lg border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition" />
          </label>
          <label className="block">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Status</span>
            <select name="status" className="mt-1.5 block w-full rounded-lg border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </label>
        </div>
        
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="featured" className="rounded border-border" /> Featured
        </label>
        
        <div className="flex justify-end gap-2 pt-2">
          <Link to="/admin/blog" className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-accent/40 transition">
            Batal
          </Link>
          <button type="submit" className="rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition cursor-pointer">
            Simpan
          </button>
        </div>
      </Form>
    </div>
  );
}
