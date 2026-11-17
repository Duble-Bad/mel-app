"use client";

import { useEffect, useRef, useState } from "react";

const fmt = (n: number) => n.toLocaleString("pt-BR");

/** Voltas extras por coluna, da direita para a esquerda (as unidades giram mais, como num odômetro). */
const SPINS = [2, 1, 0];
const DIGITS = Array.from({ length: 30 }, (_, i) => i % 10);

/**
 * "Odometer Roll" (ui-motion-prompts, Number Counter 1): cada dígito rola pelos
 * números como o hodômetro de um carro, as unidades dando mais voltas, até o
 * total real. O servidor já manda o valor final (sem JS ou com "reduzir
 * movimento", fica parado). Colunas de largura fixa (algarismos tabulares): o
 * número não "dança". Leitor de tela lê só o valor final.
 */
export function CountUp({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  // "final": parado no valor (servidor, sem JS, reduzir movimento);
  // "zero": pronto para rolar (fora da tela); "roll": rolando até o valor.
  const [phase, setPhase] = useState<"final" | "zero" | "roll">("final");
  const text = fmt(value);

  useEffect(() => {
    const el = ref.current;
    if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
    // Já visível na abertura: rola a partir do zero no próximo quadro; senão espera aparecer.
    const start = () => requestAnimationFrame(() => requestAnimationFrame(() => setPhase("roll")));
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        start();
      },
      { threshold: 0.5 },
    );
    setPhase("zero");
    io.observe(el);
    return () => io.disconnect();
  }, [value]);

  // Índice de cada dígito, contando colunas da direita (separadores de milhar ficam parados).
  let column = 0;
  const cells = [...text]
    .reverse()
    .map((ch, i) => {
      if (!/\d/.test(ch)) return { key: `s${i}`, ch, index: -1, col: -1 };
      const col = column++;
      const target = (SPINS[Math.min(col, SPINS.length - 1)] ?? 0) * 10 + Number(ch);
      return { key: `d${i}`, ch, index: phase === "zero" ? 0 : target, col };
    })
    .reverse();

  return (
    <>
      <span ref={ref} aria-hidden="true" className="inline-flex tabular-nums" style={{ height: "1em", lineHeight: 1, overflow: "hidden" }}>
        {cells.map((c) =>
          c.index < 0 ? (
            <span key={c.key}>{c.ch}</span>
          ) : (
            <span key={c.key} className="relative inline-block" style={{ height: "1em" }}>
              <span
                className="flex flex-col"
                style={{
                  transform: `translateY(${-c.index}em)`,
                  transition:
                    phase === "roll"
                      ? `transform ${1500 + c.col * 150}ms cubic-bezier(0.16, 1, 0.3, 1) ${c.col * 60}ms`
                      : "none",
                }}
              >
                {DIGITS.map((d, k) => (
                  <span key={k} style={{ height: "1em" }}>
                    {d}
                  </span>
                ))}
              </span>
            </span>
          ),
        )}
      </span>
      <span className="sr-only">{text}</span>
    </>
  );
}
