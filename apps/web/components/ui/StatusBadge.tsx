import { CircleCheck, Eye, FilePen, Heart, TriangleAlert, type LucideIcon } from "lucide-react";

type Status = "lost" | "found" | "sighting" | "adoption" | "draft";

const styles: Record<Status, { className: string; accent: string; icon: LucideIcon }> = {
  lost: { className: "bg-status-lost-soft text-status-lost", accent: "text-status-lost-accent", icon: TriangleAlert },
  found: { className: "bg-status-found-soft text-status-found", accent: "text-status-found-accent", icon: CircleCheck },
  sighting: { className: "bg-status-sighting-soft text-status-sighting", accent: "text-status-sighting-accent", icon: Eye },
  adoption: { className: "bg-status-adoption-soft text-status-adoption", accent: "text-status-adoption-accent", icon: Heart },
  draft: { className: "bg-surface-muted text-text-secondary", accent: "text-text-secondary", icon: FilePen },
};

/** Selo de status em pílula: ícone + texto (nunca só cor). `solid` para usar sobre fotos. */
export function StatusBadge({ status, children, solid = false }: { status: Status; children: string; solid?: boolean }) {
  const s = styles[status];
  const Icon = s.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-caption font-bold tracking-[.06em] uppercase ${
        solid ? "bg-surface/95 text-text-primary shadow-sm backdrop-blur-sm" : s.className
      }`}
    >
      <Icon aria-hidden="true" className={`size-3.5 ${solid ? s.accent : ""}`} strokeWidth={2.25} />
      {children}
    </span>
  );
}
