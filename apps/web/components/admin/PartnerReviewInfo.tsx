import { CNPJ_CHECK_LABELS, formatCnpj, PARTNER_KIND_LABELS, type PublicBusiness } from "@mel/core";
import { CpfReveal } from "@/components/partners/CpfReveal";

/**
 * Moderação de parceiros: tipo, documentos e situação do CNPJ. O CPF nunca vem
 * na página — "Ver CPF" pede ao servidor, que exige concessão explícita e
 * registra cada acesso. Nada de "verificado" por CPF válido.
 */
export function PartnerReviewInfo({ b }: { b: PublicBusiness }) {
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
      {b.kind === "independent" &&
        (p?.hasDocument ? (
          <CpfReveal code={b.code} audience="moderator" />
        ) : (
          <p className="font-semibold text-status-lost">Sem CPF guardado: não pode ser aprovado.</p>
        ))}
    </div>
  );
}
