import type { ClipboardEvent, FocusEvent } from "react";

/**
 * Texto livre com limite (decisão do proprietário, 2026-11-10): não começa com espaço, nunca passa
 * de `max` caracteres (nem colando) e perde o espaço do fim ao sair do campo. Durante a digitação o
 * espaço final continua possível (é com ele que se começa a próxima palavra). Os esquemas de
 * `@mel/core` fazem o mesmo `trim` e a mesma conferência ao salvar.
 */
export const limitText = (value: string, max: number) => value.replace(/^\s+/, "").slice(0, max);

/** Props de um <textarea> com essa regra. `onCut`: avisado quando um texto colado foi cortado no limite. */
export function limitedTextarea(value: string, onChange: (value: string) => void, max: number, onCut?: (max: number) => void) {
  // Sem o atributo maxLength: o navegador cortaria antes de tirar os espaços do começo
  // (perdendo letras). O campo é controlado: o que passar de `max` simplesmente não entra.
  return {
    value,
    onChange: (e: { target: { value: string } }) => onChange(limitText(e.target.value, max)),
    onBlur: (e: FocusEvent<HTMLTextAreaElement>) => {
      const trimmed = e.target.value.trim();
      if (trimmed !== e.target.value) onChange(trimmed);
    },
    onPaste: (e: ClipboardEvent<HTMLTextAreaElement>) => {
      const el = e.currentTarget;
      const pasted = e.clipboardData.getData("text").length;
      const room = max - (el.value.length - (el.selectionEnd - el.selectionStart));
      if (pasted > room) onCut?.(max);
    },
  };
}
