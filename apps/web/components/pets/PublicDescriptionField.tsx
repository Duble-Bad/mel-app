"use client";

import { FileImage, Globe } from "lucide-react";
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
 * Divide o texto pelo que cabe nos cartazes: a descrição do pet (`prefix`) vem antes e usa o
 * mesmo espaço; o corte é numa palavra, como no gerador. Estimativa (o A4 costuma caber mais).
 */
export function splitForPoster(text: string, prefix: string | null, fits = POSTER_TEXT_FITS): { poster: string; online: string } {
  const t = text.trim();
  const room = fits - (prefix?.trim() ? prefix.trim().length + 1 : 0);
  if (t.length <= room) return { poster: t, online: "" };
  if (room <= 0) return { poster: "", online: t };
  const cut = t.slice(0, room + 1).lastIndexOf(" ");
  const at = cut > room * 0.6 ? cut : room;
  return { poster: t.slice(0, at).trimEnd(), online: t.slice(at).trimStart() };
}

function PosterSplit({ text, prefix }: { text: string; prefix: string | null }) {
  const { poster, online } = splitForPoster(text, prefix);
  const box = "flex flex-col gap-1.5 rounded-md border-2 p-3";
  return (
    <div className="grid gap-2 sm:grid-cols-2" data-testid="divisao-cartaz">
      <div className={`${box} border-status-lost-solid/60 bg-status-lost-soft`}>
        <p className="flex items-center gap-1.5 text-sm font-bold text-status-lost">
          <FileImage aria-hidden="true" className="size-4" /> Aparece no cartaz
        </p>
        <p className="text-sm break-words" data-testid="vai-no-cartaz">
          {prefix?.trim() && <span className="text-text-secondary">{prefix.trim()} </span>}
          {poster || <span className="text-text-secondary">{text.trim() ? "Nada deste texto: a descrição do pet já ocupa o espaço." : "O que você escrever aqui aparece neste trecho."}</span>}
          {online && "…"}
        </p>
        <p className="text-xs text-text-secondary">Cerca de {POSTER_TEXT_FITS} caracteres{prefix?.trim() ? ", junto com a descrição do pet (em cinza)" : ""}. No A4 pode caber um pouco mais.</p>
      </div>
      <div className={`${box} ${online ? "border-border-strong bg-surface" : "border-dashed border-border bg-surface"}`}>
        <p className="flex items-center gap-1.5 text-sm font-bold">
          <Globe aria-hidden="true" className="size-4" /> Só na página online do alerta
        </p>
        <p className="text-sm break-words" data-testid="so-online">
          {online || <span className="text-text-secondary">Nada fica de fora: o texto inteiro cabe no cartaz.</span>}
        </p>
        <p className="text-xs text-text-secondary">A página do alerta (QR Code do cartaz) sempre mostra o texto completo.</p>
      </div>
    </div>
  );
}

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
  posterSplit,
}: {
  /**
   * Mostra, ao vivo, o trecho que vai no cartaz e o que fica só na página online. `prefix`:
   * texto que vem antes deste no cartaz (a descrição do pet, no caso das observações do alerta).
   */
  posterSplit?: { prefix?: string | null };
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
      {posterSplit && <PosterSplit text={value} prefix={posterSplit.prefix ?? null} />}
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
