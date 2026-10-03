import React from "react";
import { 
  Form, 
  redirect, 
  useActionData, 
  useLoaderData, 
  Link,
  useSubmit
} from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Trash2, ArrowLeft } from "lucide-react";
import { 
  getAdminSession, 
  requireRole,
  getPost, 
  updatePost, 
  deletePost, 
  writeAudit, 
  captureRuntimeEnv 
} from "@ekalliptus/core";
import BlogEditor from "../components/editor/BlogEditor";

export const loader = async ({ params, request, context }: LoaderFunctionArgs) => {
  const env = (context as any).cloudflare?.env;
  if (env) captureRuntimeEnv(env);

  const session = await getAdminSession(request.headers.get("Cookie"));
  if (!session || (session.role !== "owner" && session.role !== "admin" && session.role !== "editor")) {
    return redirect("/admin/login");
  }

  if (!params.id) return redirect("/admin/blog");

  const post = await getPost(params.id);
  if (!post) return redirect("/admin/blog");

  return { post };
};

export const action = async ({ params, request, context }: ActionFunctionArgs) => {
  const env = (context as any).cloudflare?.env;
  if (env) captureRuntimeEnv(env);

  const session = requireRole(await getAdminSession(request.headers.get("Cookie")), ["admin", "editor"]);
  if (!session) return redirect("/admin/login");

  const id = params.id;
  if (!id) return redirect("/admin/blog");

  const form = await request.formData();
  const intent = form.get("intent");

  const ip = request.headers.get("cf-connecting-ip") || "0.0.0.0";
  const ua = request.headers.get("user-agent");

  // Handle delete
  if (intent === "delete") {
    try {
      const existing = await getPost(id);
      const ok = await deletePost(id);
      if (ok) {
        await writeAudit({
          user_id: session.user.id,
          action: "delete",
          table_name: "blog_posts",
          record_id: id,
          old_values: existing,
          ip_address: ip,
          user_agent: ua
        });
      }
      return redirect("/admin/blog");
    } catch (err: any) {
      return { error: err.message || "Gagal menghapus post." };
    }
  }

  // Handle edit / save
  try {
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

    const oldPost = await getPost(id);

    const post = await updatePost(id, {
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
      featured
    });

    if (!post) {
      return { error: "Gagal memperbarui blog post." };
    }

    // Write audit log
    await writeAudit({
      user_id: session.user.id,
      action: "update",
      table_name: "blog_posts",
      record_id: post.id,
      old_values: oldPost,
      new_values: post,
      ip_address: ip,
      user_agent: ua
    });

    return redirect("/admin/blog");
  } catch (err: any) {
    console.error("Update blog error:", err);
    return { error: err.message || "Terjadi kesalahan sistem." };
  }
};

export default function BlogEdit() {
  const { post } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();

  const handleDelete = () => {
    if (confirm("Hapus post ini?")) {
      submit({ intent: "delete" }, { method: "post" });
    }
  };

  const tagsString = post.tags ? post.tags.join(", ") : "";

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
              defaultValue={post.title}
              className="mt-1.5 block w-full rounded-lg border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition" 
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Slug</span>
            <input 
              name="slug" 
              required 
              defaultValue={post.slug}
              className="mt-1.5 block w-full rounded-lg border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition" 
            />
          </label>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="block">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Bahasa</span>
            <select 
              name="locale" 
              required 
              defaultValue={post.locale}
              className="mt-1.5 block w-full rounded-lg border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
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
            <input 
              name="category" 
              defaultValue={post.category || ""}
              className="mt-1.5 block w-full rounded-lg border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition" 
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Tags (pisah koma)</span>
            <input 
              name="tags" 
              defaultValue={tagsString}
              className="mt-1.5 block w-full rounded-lg border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition" 
            />
          </label>
        </div>
        
        <label className="block">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Deskripsi (meta)</span>
          <textarea 
            name="description" 
            defaultValue={post.description || ""}
            rows={2} 
            className="mt-1.5 block w-full rounded-lg border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none transition"
          />
        </label>
        
        <div className="block">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Konten</span>
          <BlogEditor initialContent={post.body_html || ""} />
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="block">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Image URL</span>
            <input 
              name="image" 
              defaultValue={post.image || ""}
              className="mt-1.5 block w-full rounded-lg border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition" 
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Image Alt</span>
            <input 
              name="image_alt" 
              defaultValue={post.image_alt || ""}
              className="mt-1.5 block w-full rounded-lg border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition" 
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Status</span>
            <select 
              name="status" 
              defaultValue={post.status}
              className="mt-1.5 block w-full rounded-lg border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </label>
        </div>
        
        <label className="flex items-center gap-2 text-sm">
          <input 
            type="checkbox" 
            name="featured" 
            defaultChecked={post.featured || false}
            className="rounded border-border" 
          /> Featured
        </label>
        
        <div className="flex justify-between gap-2 pt-2">
          <button 
            type="button" 
            onClick={handleDelete}
            className="inline-flex items-center gap-1 rounded-lg border border-destructive/40 text-destructive px-3 py-1.5 text-sm hover:bg-destructive/10 transition cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" /> Hapus
          </button>
          
          <div className="flex gap-2">
            <Link to="/admin/blog" className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-accent/40 transition">
              Batal
            </Link>
            <button 
              type="submit" 
              className="rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition cursor-pointer"
            >
              Simpan
            </button>
          </div>
        </div>
      </Form>
    </div>
  );
}
