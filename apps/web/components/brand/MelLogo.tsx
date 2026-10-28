import beacon from "./beacon.json";

/**
 * Mel Beacon: o símbolo da EMPRESA MEL (Yorkshire + pino de localização).
 * Não é ícone de status (perdido/encontrado/avistamento/adoção têm os seus).
 *
 * Fonte única do símbolo: beacon.json (vetor). Ícones de app, favicon e
 * notificação são gerados dele com `npm run brand:icons`.
 * Até 32 px usa a versão simplificada (silhueta + focinho), legível em tamanho pequeno.
 */
export function MelMark({
  size = 36,
  variant = "tile",
  className,
}: {
  size?: number;
  /** `tile`: ladrilho da marca (cores do tema). `glyph`: só o símbolo, na cor do texto (currentColor). */
  variant?: "tile" | "glyph";
  className?: string;
}) {
  const d = size <= 32 ? beacon.simple : beacon.detailed;
  if (variant === "glyph") {
    return (
      <svg width={size} height={size} viewBox={beacon.viewBox} aria-hidden="true" className={className}>
        <path d={d} fill="currentColor" fillRule="evenodd" />
      </svg>
    );
  }
  const scale = size <= 32 ? 0.84 : 0.78;
  const offset = (512 * (1 - scale)) / 2;
  return (
    <svg width={size} height={size} viewBox={beacon.viewBox} aria-hidden="true" className={className}>
      <rect x="4" y="4" width="504" height="504" rx="116" fill="var(--mel-beacon-tile)" stroke="var(--mel-beacon-ring)" strokeWidth="8" />
      <path d={d} fill="var(--mel-beacon-glyph)" fillRule="evenodd" transform={`translate(${offset} ${offset}) scale(${scale})`} />
    </svg>
  );
}

/** Lockup: [ Mel Beacon ] MEL. Símbolo e palavra também funcionam separados. */
export function MelLogo({ size = 32 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <MelMark size={size} />
      <span className="text-[22px] leading-none font-extrabold tracking-[-0.03em] text-foreground">MEL</span>
    </span>
  );
}
