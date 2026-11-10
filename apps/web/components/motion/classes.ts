import "./motion.css";

// O projeto passa todo CSS pelo Tailwind como CSS comum (sem CSS Modules): as classes do
// movimento são globais, com o prefixo "mm-" para não colidir com nada.
const NAMES = [
  "root", "steps", "stepList", "step", "stepButton", "circle", "circleRow", "glyph", "check", "halo", "seg", "segFill",
  "label", "name", "status", "rail", "railFill", "bead", "spot", "pop", "compact", "compactSwap", "stage", "layer",
  "card", "badge", "msg", "msgInner", "msgText", "shake", "actionLabel", "sideArrow", "sideTip",
] as const;

export const s = Object.fromEntries(NAMES.map((n) => [n, `mm-${n}`])) as Record<(typeof NAMES)[number], string>;
