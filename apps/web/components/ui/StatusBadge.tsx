type Status = "lost" | "found" | "sighting" | "adoption" | "draft";

const styles: Record<Status, { className: string; icon: string }> = {
  lost: { className: "bg-status-lost text-text-inverse", icon: "!" },
  found: { className: "bg-status-found text-text-inverse", icon: "✓" },
  sighting: { className: "bg-status-sighting text-text-inverse", icon: "👁" },
  adoption: { className: "bg-status-adoption text-text-inverse", icon: "♥" },
  draft: { className: "bg-surface-muted text-text-primary border border-border-strong", icon: "…" },
};

/** Selo de status: cor + ícone + texto (nunca só cor). */
export function StatusBadge({ status, children }: { status: Status; children: string }) {
  const s = styles[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-sm font-bold tracking-wide uppercase ${s.className}`}>
      <span aria-hidden="true">{s.icon}</span>
      {children}
    </span>
  );
}
