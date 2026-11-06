import { CNPJ_CHECK_LABELS, documentStateLabel, formatCnpj, PARTNER_KIND_LABELS, type PublicBusiness } from "@mel/core";
import { CpfReveal } from "@/components/partners/CpfReveal";

/**
 * Moderação de parceiros: tipo, documentos e situação do CNPJ. Do CPF, a
 * moderação vê só o ESTADO (informado / ilegível / pendente). "Ver CPF"
 * aparece só para ADMINISTRADOR; o servidor ainda exige a concessão explícita
 * e registra cada acesso. Nada de "verificado" por CPF válido.
 */
export function PartnerReviewInfo({ b, canRevealCpf = false }: { b: PublicBusiness; canRevealCpf?: boolean }) {
  const p = b.private;
  return (
    <div className="flex flex-col gap-2 rounded-md bg-surface-muted/60 p-3 text-sm" data-testid="admin-partner-info">
      <p className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-primary-soft px-2.5 py-0.5 font-semibold text-primary-soft-foreground">{PARTNER_KIND_LABELS[b.kind]}</span>
        {b.kind !== "company" && <span className="text-text-secondary">{b.addressLabel} (região aproximada)</span>}
        {b.activityArea && <span className="text-text-secondary">· {b.activityArea}</span>}
      </p>
      {b.kind !== "independent" && (
        <p>
          <span className="font-semibold">CNPJ:</span>{" "}
          {p?.cnpj ? (
            <>
              <span className="tabular-nums">{formatCnpj(p.cnpj)}</span>{" "}
              <span className={p.cnpjStatus === "VERIFIED" ? "font-semibold text-status-found" : "text-status-lost"}>
                · {CNPJ_CHECK_LABELS[p.cnpjStatus ?? "PENDING"]}
              </span>
            </>
          ) : (
            <span className="text-status-lost">não informado (cadastro antigo)</span>
          )}
        </p>
      )}
      {p?.legalName && (
        <p>
          <span className="font-semibold">Razão social:</span> {p.legalName}
        </p>
      )}
      {p?.responsibleName && (
        <p>
          <span className="font-semibold">Responsável:</span> {p.responsibleName}
        </p>
      )}
      {b.kind === "independent" && (
        <>
          <p data-testid="admin-cpf-state" className={p?.hasDocument && (p.documentState ?? "ok") === "ok" ? "font-semibold" : "font-semibold text-status-lost"}>
            {documentStateLabel(Boolean(p?.hasDocument), p?.documentState ?? null)}
            {!p?.hasDocument && " — não pode ser aprovado."}
          </p>
          {canRevealCpf && p?.hasDocument && (p.documentState ?? "ok") === "ok" && <CpfReveal code={b.code} audience="admin" />}
        </>
      )}
    </div>
  );
}
