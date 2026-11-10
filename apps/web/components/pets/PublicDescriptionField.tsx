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
 * Quanto da descrição aparece INTEIRO nos cartazes com várias fotos (a maioria dos modelos e
 * formatos; no A4, cerca de 250). Cálculo em docs/propostas/editor-e-bonificacao.md (item 7f).
 */
export const POSTER_TEXT_FITS = 150;

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
  max = 500,
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
  /** Limite do cadastro (o mesmo da validação). */
  max?: number;
}) {
  const guidanceId = useId();
  const noticeId = useId();
  const counterId = useId();
  const n = value.trim().length;
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
        aria-describedby={`${guidanceId} ${counterId} ${noticeId}`}
      />
      {/* Só orienta: não bloqueia nem corta (o limite do cadastro é validado ao salvar). */}
      <p id={counterId} className="flex flex-wrap justify-between gap-x-3 text-sm" data-testid={`contador-${id}`}>
        <span className={n > max ? "font-semibold text-danger" : n > POSTER_TEXT_FITS ? "font-medium text-text-primary" : "text-text-secondary"}>
          {n > POSTER_TEXT_FITS
            ? `Nos cartazes, os primeiros ${POSTER_TEXT_FITS} caracteres costumam aparecer inteiros; o resto pode ser cortado com “…”. O texto completo fica na página do alerta.`
            : `Até ${POSTER_TEXT_FITS} caracteres aparecem inteiros nos cartazes.`}
        </span>
        <span className={`tabular-nums ${n > max ? "font-semibold text-danger" : "text-text-secondary"}`}>
          {n}/{max}
        </span>
      </p>
      <p id={noticeId} className="text-sm leading-relaxed text-text-secondary">
        <span aria-hidden="true">🌐 </span>
        {notice}
      </p>
      {error && <p className="text-sm font-medium text-danger">{error}</p>}
    </div>
  );
}
