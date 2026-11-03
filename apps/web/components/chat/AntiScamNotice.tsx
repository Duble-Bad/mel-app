import { ANTI_SCAM_NOTICE, ANTI_SCAM_REPORT_TIP, ANTI_SCAM_TIPS } from "@mel/core";

/**
 * Aviso de golpe ("achei, mande PIX"), presente em toda conversa. A linha
 * principal fica sempre visível; o passo a passo do reencontro abre num toque
 * (no celular, uma lista aberta empurraria a conversa para baixo).
 * `canReport`: só onde existe o botão Denunciar.
 */
export function AntiScamNotice({ canReport = false }: { canReport?: boolean }) {
  return (
    <div data-testid="anti-scam" className="flex flex-col gap-1 rounded-md border-l-4 border-warning bg-status-sighting-soft px-3 py-2 text-sm">
      <p className="flex gap-2 font-medium">
        <span aria-hidden="true">⚠️</span>
        <span>{ANTI_SCAM_NOTICE}</span>
      </p>
      <details className="group pl-6">
        <summary className="min-h-10 cursor-pointer py-2 font-semibold text-link underline-offset-4 hover:underline">
          Como se proteger no reencontro
        </summary>
        <ul className="flex list-disc flex-col gap-1 pb-1 pl-4">
          {ANTI_SCAM_TIPS.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
          {canReport && <li>{ANTI_SCAM_REPORT_TIP}</li>}
        </ul>
      </details>
    </div>
  );
}
