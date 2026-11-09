"use client";

import { useId } from "react";

/** Textos do proprietário (2026-11-09) para a descrição pública do pet. */
export const PET_DESCRIPTION_COPY = {
  label: "Descrição e características do pet",
  guidance:
    "Descreva seu pet para ajudar outras pessoas a reconhecê-lo. Você pode informar cor e tipo de pelagem, porte, manchas ou marcas características, coleira e acessórios, comportamento, condições especiais e referências de onde foi visto ou desapareceu.",
  placeholder:
    "Ex.: Yorkshire pequeno, pelagem marrom e cinza, usa laço amarelo, é dócil, mas pode ficar assustado. Foi visto pela última vez próximo à praça do bairro.",
  publicNotice:
    "Esta descrição será pública. Você decide quais informações deseja compartilhar, incluindo nomes de ruas, endereços e referências de localização. Informe o que considerar útil para encontrar seu pet.",
} as const;

/**
 * Campo de texto LIVRE e público (descrição do pet, observações do alerta): orienta o
 * que escrever, mas não bloqueia, não corta e não altera nada do que o tutor digita —
 * inclusive ruas e endereços, que são decisão dele. Opcional.
 */
export function PublicDescriptionField({
  id,
  label,
  guidance,
  placeholder,
  notice = PET_DESCRIPTION_COPY.publicNotice,
  value,
  onChange,
  error,
  rows = 4,
  className,
}: {
  id: string;
  label: string;
  guidance: string;
  placeholder: string;
  notice?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  rows?: number;
  className: string;
}) {
  const guidanceId = useId();
  const noticeId = useId();
  return (
    <div className="flex flex-col gap-1.5" data-testid={`descricao-${id}`}>
      <label htmlFor={id} className="font-semibold">
        {label} <span className="font-normal text-text-secondary">(opcional)</span>
      </label>
      <p id={guidanceId} className="text-sm leading-relaxed text-text-secondary">
        {guidance}
      </p>
      <textarea
        id={id}
        rows={rows}
        className={className}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={`${guidanceId} ${noticeId}`}
      />
      <p id={noticeId} className="text-sm leading-relaxed text-text-secondary">
        <span aria-hidden="true">🌐 </span>
        {notice}
      </p>
      {error && <p className="text-sm font-medium text-danger">{error}</p>}
    </div>
  );
}
