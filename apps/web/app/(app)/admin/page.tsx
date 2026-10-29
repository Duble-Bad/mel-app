import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, Inbox, ShieldAlert } from "lucide-react";
import { Suspense } from "react";
import { formatDateTimeBr, MODERATION_ACTION_LABELS, REPORT_REASON_LABELS, REPORT_TARGET_LABELS, timeAgo } from "@mel/core";
import { getAdminOverview, getAuditLog, listAdminReports } from "@mel/data";
import { requireOnboardedProfile } from "@/lib/session";
import { createSessionClient } from "@/lib/supabase/server";
import { ModerationActions } from "@/components/admin/ModerationActions";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";

export const metadata: Metadata = { title: "Moderação", robots: { index: false } };

export default function AdminPage({ searchParams }: PageProps<"/admin">) {
  return (
    <main className="mx-auto w-full max-w-[1100px] flex-1 px-[var(--mel-page-gutter)] pt-6 pb-12">
      <Suspense fallback={<LoadingState />}>{searchParams.then((q) => <Content tab={q.aba === "resolvidas" ? "closed" : "open"} />)}</Suspense>
    </main>
  );
}

async function Content({ tab }: { tab: "open" | "closed" }) {
  const profile = await requireOnboardedProfile("/admin");
  // Fora da moderação, a página "não existe" (não revela o painel).
  if (profile.role !== "moderator" && profile.role !== "admin") notFound();
  const client = await createSessionClient();
  let data;
  try {
    const [overview, reports, audit] = await Promise.all([getAdminOverview(client), listAdminReports(client, tab === "open"), getAuditLog(client, 15)]);
    data = { overview, reports, audit };
  } catch (error) {
    console.error("[admin] falha", error);
    return <ErrorState>Não conseguimos carregar o painel agora. Atualize a página.</ErrorState>;
  }
  const o = data.overview;
  const stats: [string, number][] = [
    ["Alertas ativos", o.activeLost],
    ["Reencontros (total)", o.reunited],
    ["Reencontros em 30 dias", o.reunited30d],
    ["Encontrados ativos", o.activeFound],
    ["Avistamentos em 7 dias", o.sightings7d],
    ["Contas", o.users],
    ["Guardiões ativos", o.guardians],
    ["Denúncias abertas", o.openReports],
  ];

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1.5">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <ShieldAlert aria-hidden="true" className="size-6 text-brand" strokeWidth={2} /> Moderação
        </h1>
        <p className="text-text-secondary">Números reais da rede e a fila de denúncias. Toda ação fica registrada.</p>
      </header>

      <section aria-label="Números da rede">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map(([label, value]) => (
            <div key={label} className="rounded-card border border-border/70 bg-surface p-4 shadow-xs">
              <dt className="text-sm text-text-secondary">{label}</dt>
              <dd className="text-2xl font-bold tabular-nums">{value.toLocaleString("pt-BR")}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="fila" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="fila" className="text-xl font-bold">
            Denúncias
          </h2>
          <nav aria-label="Filtro de denúncias" className="flex gap-1 rounded-md bg-surface-muted p-1">
            {(
              [
                ["open", "Abertas", "/admin"],
                ["closed", "Resolvidas", "/admin?aba=resolvidas"],
              ] as const
            ).map(([key, label, href]) => (
              <Link
                key={key}
                href={href}
                aria-current={tab === key ? "page" : undefined}
                className={`inline-flex min-h-10 items-center rounded-[11px] px-4 text-sm font-semibold ${
                  tab === key ? "border border-border bg-surface-elevated shadow-sm" : "text-text-secondary hover:text-text-primary"
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>

        {data.reports.length === 0 ? (
          <EmptyState title={tab === "open" ? "Nenhuma denúncia aberta" : "Nada resolvido ainda"} icon={Inbox}>
            {tab === "open" ? "Quando alguém denunciar um conteúdo, ele aparece aqui." : "As decisões tomadas aparecem aqui."}
          </EmptyState>
        ) : (
          <ul className="flex flex-col gap-3">
            {data.reports.map((r) => (
              <li key={r.id} data-testid="admin-report" className="flex flex-col gap-3 rounded-card border border-border/70 bg-surface p-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="rounded-full bg-surface-muted px-2.5 py-0.5 font-semibold">{REPORT_TARGET_LABELS[r.targetType] ?? r.targetType}</span>
                  <span className="rounded-full bg-status-lost-soft px-2.5 py-0.5 font-semibold text-status-lost">{REPORT_REASON_LABELS[r.reason]}</span>
                  {r.reportsForTarget > 1 && <span className="text-text-secondary">{r.reportsForTarget} denúncias sobre isso</span>}
                  {r.authorSuspended && <span className="font-semibold text-status-lost">Autor suspenso</span>}
                  <span className="ml-auto text-text-secondary" title={formatDateTimeBr(r.createdAt)}>
                    {timeAgo(r.createdAt)}
                  </span>
                </div>
                <p className="font-semibold">
                  {r.target?.title ?? "Conteúdo removido"}
                  {r.target?.state && <span className="ml-2 text-sm font-normal text-text-secondary">({r.target.state})</span>}
                </p>
                {r.details && <p className="rounded-md bg-surface-muted p-3 text-sm whitespace-pre-line">{r.details}</p>}
                {r.target?.href && (
                  <Link href={r.target.href} target="_blank" className="inline-flex items-center gap-1 self-start text-sm font-semibold text-link hover:underline">
                    Ver o conteúdo <ExternalLink aria-hidden="true" className="size-3.5" strokeWidth={2} />
                  </Link>
                )}
                {tab === "open" && <ModerationActions reportId={r.id} targetType={r.targetType} authorSuspended={r.authorSuspended} />}
                {tab === "closed" && <p className="text-sm text-text-secondary">{r.status === "DISMISSED" ? "Descartada" : "Ação aplicada"}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="auditoria" className="flex flex-col gap-3">
        <h2 id="auditoria" className="text-xl font-bold">
          Registro de auditoria
        </h2>
        {data.audit.length === 0 ? (
          <p className="text-text-secondary">Nenhuma ação de moderação ainda.</p>
        ) : (
          <ol className="flex flex-col divide-y divide-border rounded-card border border-border/70 bg-surface">
            {data.audit.map((a) => (
              <li key={a.id} className="flex flex-col gap-0.5 p-3 text-sm">
                <span className="font-semibold">
                  {MODERATION_ACTION_LABELS[a.action]} · {a.target?.title ?? REPORT_TARGET_LABELS[a.targetType]}
                </span>
                <span className="text-text-secondary">
                  {a.moderator} · {formatDateTimeBr(a.createdAt)}
                  {a.reason && ` · “${a.reason}”`}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
