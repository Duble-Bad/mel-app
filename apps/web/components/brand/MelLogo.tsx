import { useId } from "react";

/**
 * Símbolo provisório da MEL: pino de localização (encontro) com um ponto
 * central (o animal protegido) sobre o gradiente coral da marca.
 * Cores vêm dos tokens; trocar pelo logotipo definitivo quando existir.
 */
export function MelMark({ size = 36, className }: { size?: number; className?: string }) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: "var(--mel-primary-500)" }} />
          <stop offset="0.52" style={{ stopColor: "var(--mel-primary-400)" }} />
          <stop offset="1" style={{ stopColor: "var(--mel-primary-300)" }} />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="12" fill={`url(#${id}-g)`} />
      <path
        d="M20 9.5c-4.7 0-8.5 3.7-8.5 8.4 0 5.9 7.1 12.3 7.9 13a.9.9 0 0 0 1.2 0c.8-.7 7.9-7.1 7.9-13 0-4.7-3.8-8.4-8.5-8.4Z"
        fill="none"
        stroke="var(--mel-surface)"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <circle cx="20" cy="18" r="3.2" fill="var(--mel-surface)" />
    </svg>
  );
}

/** Marca completa: símbolo + "MEL". */
export function MelLogo({ size = 32 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <MelMark size={size} />
      <span className="text-[22px] leading-none font-extrabold tracking-[-0.03em] text-ink-800">MEL</span>
    </span>
  );
}
