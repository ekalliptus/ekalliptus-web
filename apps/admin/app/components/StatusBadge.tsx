import React from "react";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const statusMap: Record<string, { token: string; label: string }> = {
  // orders
  new: { token: "new", label: "Baru" },
  contacted: { token: "contacted", label: "Dihubungi" },
  in_progress: { token: "processing", label: "Dikerjakan" },
  done: { token: "won", label: "Selesai" },
  cancelled: { token: "lost", label: "Dibatalkan" },
  // payments
  pending: { token: "pending", label: "Pending" },
  processing: { token: "processing", label: "Diproses" },
  paid: { token: "paid", label: "Lunas" },
  failed: { token: "failed", label: "Gagal" },
  expired: { token: "lost", label: "Kedaluwarsa" },
  refunded: { token: "new", label: "Refund" },
  // leads / pipeline
  qualified: { token: "qualified", label: "Qualified" },
  proposal: { token: "proposal", label: "Proposal" },
  negotiation: { token: "negotiation", label: "Negosiasi" },
  won: { token: "won", label: "Won" },
  lost: { token: "lost", label: "Lost" },
  // blog
  published: { token: "paid", label: "Published" },
  draft: { token: "new", label: "Draft" },
  archived: { token: "proposal", label: "Archived" },
};

export default function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const key = String(status ?? "").toLowerCase().trim();
  const entry = statusMap[key] ?? { token: "info", label: status || "-" };
  const token = entry.token;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}
      style={{
        backgroundColor: `hsl(var(--status-${token}) / 0.14)`,
        color: `hsl(var(--status-${token}))`,
      }}
    >
      <span 
        className="h-1.5 w-1.5 rounded-full" 
        style={{ backgroundColor: `hsl(var(--status-${token}))` }}
      />
      {entry.label}
    </span>
  );
}
