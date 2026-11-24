import React, { useRef } from "react";
import { useLoaderData, useRevalidator, redirect } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { Plus } from "lucide-react";
import { 
  getAdminSession, 
  requireRole,
  ADMIN_LEAD_ROLES,
  listLeadsByStage, 
  countLeadsByStage, 
  totalEstimatedValueOpen, 
  formatIDR,
  captureRuntimeEnv
} from "@ekalliptus/core";
import PipelineKanban from "../components/PipelineKanban";

export const loader = async ({ request, context }: LoaderFunctionArgs) => {
  const env = (context as any).cloudflare?.env;
  if (env) captureRuntimeEnv(env);

  const rawSession = await getAdminSession(request.headers.get("Cookie"));
  if (!rawSession) return redirect("/admin/login");
  if (!requireRole(rawSession, ADMIN_LEAD_ROLES)) return redirect("/admin");

  const board = await listLeadsByStage();
  const counts = await countLeadsByStage();
  const totalOpen = await totalEstimatedValueOpen();
  const totalLeads = Object.values(counts).reduce((s, n) => s + n, 0);

  return { board, totalLeads, totalOpen };
};

export default function Pipeline() {
  const { board, totalLeads, totalOpen } = useLoaderData<typeof loader>();
  const revalidator = useRevalidator();
  
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const handleLeadUpdated = () => {
    revalidator.revalidate();
  };

  const handleOpenDialog = () => {
    if (dialogRef.current) dialogRef.current.showModal();
  };

  const handleCloseDialog = () => {
    if (dialogRef.current) dialogRef.current.close();
    if (formRef.current) formRef.current.reset();
  };

  const handleNewLeadSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data = Object.fromEntries(fd);
    
    try {
      const res = await fetch("/api/admin/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      
      if (res.ok) {
        handleCloseDialog();
        handleLeadUpdated();
      } else {
        alert("Gagal membuat lead baru");
      }
    } catch (err) {
      alert("Terjadi kesalahan koneksi");
    }
  };

  return (
    <div className="space-y-4">
      <div className="glass-panel rounded-2xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs">
          <div>
            <span className="text-muted-foreground">Lead aktif</span>
            <span className="font-bold text-foreground ml-1.5">{totalLeads}</span>
          </div>
          <div className="hidden sm:block w-px h-4 bg-border"></div>
          <div className="hidden sm:block">
            <span className="text-muted-foreground">Estimasi nilai</span>
            <span className="font-bold text-primary ml-1.5">{formatIDR(totalOpen)}</span>
          </div>
        </div>
        <button 
          onClick={handleOpenDialog}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition active:scale-[0.98] cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" /> Lead Baru
        </button>
      </div>

      <PipelineKanban board={board} onLeadUpdated={handleLeadUpdated} />

      {/* Modal: New Lead */}
      <dialog ref={dialogRef} className="rounded-2xl p-0 backdrop:bg-black/50 max-w-[90vw]">
        <form ref={formRef} onSubmit={handleNewLeadSubmit} className="glass-panel p-6 w-[400px] max-w-[90vw]">
          <h2 className="text-base font-semibold mb-4">Lead Baru</h2>
          <div className="space-y-2.5">
            <input 
              name="name" 
              required 
              placeholder="Nama" 
              className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" 
            />
            <input 
              name="whatsapp" 
              placeholder="WhatsApp" 
              className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" 
            />
            <input 
              name="email" 
              type="email" 
              placeholder="Email" 
              className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" 
            />
            <input 
              name="company" 
              placeholder="Perusahaan" 
              className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" 
            />
            <select 
              name="service_interest" 
              className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">Pilih layanan...</option>
              <option value="website">Website Development</option>
              <option value="mobile">Mobile App Development</option>
              <option value="service_device">Maintenance</option>
            </select>
            <input 
              name="estimated_value" 
              type="number" 
              placeholder="Estimasi nilai (Rp)" 
              className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" 
            />
            <textarea 
              name="notes" 
              placeholder="Catatan" 
              rows={2} 
              className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button 
              type="button" 
              onClick={handleCloseDialog}
              className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-accent/40 transition cursor-pointer"
            >
              Batal
            </button>
            <button 
              type="submit" 
              className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition cursor-pointer"
            >
              Simpan
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
