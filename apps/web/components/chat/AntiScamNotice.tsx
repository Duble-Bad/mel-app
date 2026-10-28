import { ANTI_SCAM_NOTICE } from "@mel/core";

/** Aviso fixo de golpe ("achei, mande PIX"), presente em toda conversa. */
export function AntiScamNotice() {
  return (
    <p
      data-testid="anti-scam"
      className="flex gap-2 rounded-md border-l-4 border-warning bg-status-sighting-soft px-3 py-2 text-sm font-medium"
    >
      <span aria-hidden="true">⚠️</span>
      <span>{ANTI_SCAM_NOTICE}</span>
    </p>
  );
}
