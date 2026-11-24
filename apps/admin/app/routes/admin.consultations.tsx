import React, { useState, useEffect, useRef } from "react";
import { useLoaderData, redirect } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { MessageSquare, RefreshCw, Send } from "lucide-react";
import { 
  getAdminSession, 
  requireRole,
  ADMIN_CONSULTATION_ROLES,
  getSupabase, 
  captureRuntimeEnv 
} from "@ekalliptus/core";

export const loader = async ({ request, context }: LoaderFunctionArgs) => {
  const env = (context as any).cloudflare?.env;
  if (env) captureRuntimeEnv(env);

  const rawSession = await getAdminSession(request.headers.get("Cookie"));
  if (!rawSession) return redirect("/admin/login");
  if (!requireRole(rawSession, ADMIN_CONSULTATION_ROLES)) return redirect("/admin");

  const supabaseUrl = env?.PUBLIC_SUPABASE_URL || "";
  const supabaseAnonKey = env?.PUBLIC_SUPABASE_ANON_KEY || "";

  return { supabaseUrl, supabaseAnonKey };
};

interface ConsultationMessage {
  id: string;
  sender_type: "visitor" | "bot" | "admin";
  sender_name: string | null;
  content: string;
  created_at: string;
}

interface Consultation {
  id: string;
  session_id: string | null;
  visitor_name: string | null;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
  status: string;
  messages: ConsultationMessage[];
}

export default function Consultations() {
  const { supabaseUrl, supabaseAnonKey } = useLoaderData<typeof loader>();
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [replyText, setReplyText] = useState("");
  const [loading, setLoading] = useState(true);
  const messageListRef = useRef<HTMLDivElement>(null);

  const fetchConsultations = async () => {
    try {
      const res = await fetch("/api/admin/consultations");
      if (res.ok) {
        const data = await res.json();
        const list: Consultation[] = data.consultations || [];
        setConsultations(list);
        if (list.length > 0 && !selectedId) {
          setSelectedId(list[0].id);
        }
      }
    } catch (err) {
      console.error("Gagal memuat konsultasi:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConsultations();
    // Polling every 8 seconds as fallback
    const interval = setInterval(fetchConsultations, 8000);
    return () => clearInterval(interval);
  }, [selectedId]);

  useEffect(() => {
    if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  }, [selectedId, consultations]);

  // Handle Supabase Realtime Client-side
  useEffect(() => {
    if (!supabaseUrl || !supabaseAnonKey) return;
    
    // Load supabase-js UMD
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js";
    script.async = true;
    script.onload = () => {
      try {
        const supabaseLib = (window as any).supabase;
        if (supabaseLib) {
          const client = supabaseLib.createClient(supabaseUrl, supabaseAnonKey);
          const channel = client
            .channel("admin-realtime-consultations")
            .on(
              "postgres_changes",
              { event: "INSERT", schema: "public", table: "consultation_messages" },
              (payload: any) => {
                if (payload.new && payload.new.sender_type === "visitor") {
                  fetchConsultations();
                }
              }
            )
            .on(
              "postgres_changes",
              { event: "UPDATE", schema: "public", table: "consultations" },
              () => fetchConsultations()
            )
            .subscribe();

          return () => {
            client.removeChannel(channel);
          };
        }
      } catch (err) {
        console.error("Supabase realtime registration failed:", err);
      }
    };
    document.head.appendChild(script);
    return () => {
      script.remove();
    };
  }, [supabaseUrl, supabaseAnonKey]);

  const handleReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId || !replyText.trim()) return;

    const content = replyText.trim();
    setReplyText("");

    try {
      const res = await fetch(`/api/admin/consultations/${selectedId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content })
      });

      if (res.ok) {
        fetchConsultations();
      } else {
        alert("Gagal mengirim balasan.");
      }
    } catch (err) {
      alert("Koneksi gagal.");
    }
  };

  const selectedThread = consultations.find((c) => c.id === selectedId);

  const formatDate = (date: string | null) => {
    if (!date) return "Tidak ada pesan";
    return new Date(date).toLocaleString("id-ID", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[360px,1fr] gap-6">
      {/* Consultation list panel */}
      <section className="glass-panel rounded-2xl p-5 min-h-[520px] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Percakapan</h2>
            <p className="text-xs text-muted-foreground/70">Handoff dari Pengunjung</p>
          </div>
          <button
            onClick={fetchConsultations}
            className="h-8 w-8 rounded-lg glass-panel inline-flex items-center justify-center hover:bg-accent cursor-pointer"
            aria-label="Refresh consultations"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
        
        <div className="space-y-3 flex-1 overflow-y-auto max-h-[500px] pr-1 custom-scrollbar">
          {loading && consultations.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">Memuat chat...</div>
          ) : consultations.length === 0 ? (
            <div className="py-16 text-center">
              <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-accent/10 flex items-center justify-center">
                <MessageSquare className="h-7 w-7 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">Belum ada percakapan</p>
              <p className="text-xs text-muted-foreground">Pesan konsultasi pengunjung akan muncul di sini.</p>
            </div>
          ) : (
            consultations.map((c) => {
              const isActive = c.id === selectedId;
              const isUnread = c.unread_count > 0;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedId(c.id)}
                  className={`w-full rounded-xl border p-3 text-left transition hover:bg-accent/40 cursor-pointer block ${
                    isActive ? "border-primary bg-primary/10" : "border-border bg-card/50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold truncate text-foreground">{c.visitor_name || "Pengunjung"}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      isUnread ? "bg-red-500 text-white font-semibold" : "bg-primary/10 text-primary"
                    }`}>
                      {isUnread ? String(c.unread_count) : c.status}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{c.last_message || "Belum ada pesan"}</p>
                  <p className="mt-2 text-[11px] text-muted-foreground/70">{formatDate(c.last_message_at)}</p>
                </button>
              );
            })
          )}
        </div>
      </section>

      {/* Message thread panel */}
      <section className="glass-panel rounded-2xl p-5 min-h-[520px] flex flex-col">
        {!selectedThread ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <div className="mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <MessageSquare className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Pilih percakapan</h2>
            <p className="text-sm text-muted-foreground">Baca riwayat pesan dan kirim balasan di panel ini.</p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="border-b border-border pb-3 mb-3">
              <h2 className="text-base font-semibold text-foreground">{selectedThread.visitor_name || "Pengunjung"}</h2>
              <p className="text-xs text-muted-foreground">
                {selectedThread.session_id || "No session"} • {formatDate(selectedThread.last_message_at)}
              </p>
            </div>

            <div 
              ref={messageListRef}
              className="flex-1 min-h-[300px] max-h-[380px] overflow-y-auto space-y-3 pr-1 custom-scrollbar"
            >
              {selectedThread.messages?.map((m) => {
                const isAdmin = m.sender_type === "admin";
                return (
                  <div key={m.id} className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                      isAdmin 
                        ? "rounded-tr-md bg-primary text-primary-foreground" 
                        : "rounded-tl-md border border-border bg-card text-foreground"
                    }`}>
                      <p className={`mb-1 text-[11px] ${isAdmin ? "opacity-80" : "text-muted-foreground"}`}>
                        {m.sender_name || m.sender_type}
                      </p>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.content}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <form onSubmit={handleReplySubmit} className="mt-4 flex gap-2 border-t border-border pt-3">
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                rows={2}
                className="glass-input flex-1 resize-none rounded-lg px-3 py-2 text-sm outline-none bg-input border border-border focus:ring-2 focus:ring-primary/30"
                placeholder="Tulis balasan..."
              />
              <button
                type="submit"
                className="h-11 w-11 rounded-lg bg-primary text-primary-foreground inline-flex items-center justify-center hover:bg-primary/90 transition cursor-pointer flex-shrink-0"
                aria-label="Send reply"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        )}
      </section>
    </div>
  );
}
