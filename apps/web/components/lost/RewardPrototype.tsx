"use client";

import { useEffect, useId, useState } from "react";
import { maskRewardInput, parseRewardBRL, REWARD_DISCLAIMER, rewardLine } from "@mel/core";

/**
 * PROTÓTIPO (DEV) da bonificação: formulário, bloco no alerta e cartazes com um caso FICTÍCIO.
 * Sem coluna no banco, sem pagamento, sem carteira: só mostra o valor que o tutor informar.
 */

type Status = "ACTIVE" | "FOUND" | "CLOSED";
const FORMATS = [
  ["impressao", "A4"],
  ["square", "Quadrado"],
  ["portrait", "4:5"],
  ["story", "Stories"],
  ["landscape", "Horizontal"],
] as const;

export function RewardPrototype() {
  const [offers, setOffers] = useState(false);
  const [value, setValue] = useState("");
  const [touched, setTouched] = useState(false);
  const [status, setStatus] = useState<Status>("ACTIVE");
  const valueId = useId();
  const helpId = useId();

  const parsed = offers ? parseRewardBRL(value) : null;
  const cents = parsed?.ok ? parsed.cents : null;
  const line = rewardLine(status, cents);

  // Os cartazes só são pedidos de novo quando o valor para de mudar.
  const [posterCents, setPosterCents] = useState<number | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setPosterCents(cents), 400);
    return () => clearTimeout(t);
  }, [cents]);
  const posterUrl = (f: string) => `/dev/bonificacao/cartaz/${f}?status=${status}${posterCents ? `&centavos=${posterCents}` : ""}`;

  return (
    <div className="flex flex-col gap-8" data-testid="bonificacao-prototipo">
      {/* Formulário (iria no cadastro/edição do alerta) */}
      <section className="flex max-w-xl flex-col gap-3 rounded-lg bg-surface p-4 shadow-card">
        <h2 className="text-lg font-bold">1. No formulário do alerta</h2>
        <fieldset className="flex flex-col gap-2">
          <legend className="font-semibold">Você oferece bonificação para quem encontrar seu pet?</legend>
          <label className="flex items-center gap-2">
            <input type="radio" name="oferece" checked={!offers} onChange={() => setOffers(false)} /> Não
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="oferece" checked={offers} onChange={() => setOffers(true)} /> Sim
          </label>
        </fieldset>
        {offers && (
          <div className="flex flex-col gap-1">
            <label htmlFor={valueId} className="font-semibold">
              Valor da bonificação (R$)
            </label>
            <div className="flex items-center gap-2">
              <span className="font-semibold">R$</span>
              <input
                id={valueId}
                inputMode="numeric"
                autoComplete="off"
                className="w-40 rounded-md border border-border-strong px-3 py-2"
                placeholder="0,00"
                value={value}
                onChange={(e) => setValue(maskRewardInput(e.target.value))}
                onBlur={() => setTouched(true)}
                aria-describedby={helpId}
                aria-invalid={touched && parsed?.ok === false}
              />
            </div>
            {touched && parsed && !parsed.ok && <p className="text-sm font-medium text-danger">{parsed.error}</p>}
          </div>
        )}
        <p id={helpId} className="text-sm text-text-secondary">
          Opcional e pode ser alterada ou retirada a qualquer momento. A MEL não intermedeia pagamentos nem garante a bonificação; não é preciso informar telefone
          nem endereço.
        </p>
      </section>

      {/* Situação do alerta */}
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">2. Situação do alerta (simulação)</h2>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Situação do alerta">
          {(
            [
              ["ACTIVE", "Ativo"],
              ["FOUND", "Reencontrado"],
              ["CLOSED", "Encerrado"],
            ] as const
          ).map(([s, l]) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={status === s}
              onClick={() => setStatus(s)}
              className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${status === s ? "border-transparent bg-[#e5484d] text-white" : "border-border-strong"}`}
            >
              {l}
            </button>
          ))}
        </div>
      </section>

      {/* Página do alerta */}
      <section className="flex max-w-xl flex-col gap-3">
        <h2 className="text-lg font-bold">3. Na página do alerta</h2>
        <div className="flex flex-col gap-2 rounded-lg bg-surface p-4 shadow-card" data-testid="alerta-previa">
          <p className="text-sm font-bold text-[#e5484d]">{status === "ACTIVE" ? "PROCURA-SE" : status === "FOUND" ? "ENCONTRADO!" : "ALERTA ENCERRADO"}</p>
          <p className="text-2xl font-bold">Pet de exemplo</p>
          <p className="text-text-secondary">Cachorro · SRD · Porte médio · Jardim de Exemplo (DEMONSTRAÇÃO)</p>
          {line && (
            <div className="flex flex-col gap-1 rounded-md bg-[#f6b928] p-3 text-[#0a111d]" data-testid="bonificacao-bloco">
              <p className="font-extrabold">{line}</p>
              <p className="text-sm">{REWARD_DISCLAIMER}</p>
            </div>
          )}
        </div>
        <p className="text-sm text-text-secondary">
          Sem bonificação, com valor inválido ou com o alerta reencontrado/encerrado, o bloco não aparece (nem vazio).
        </p>
      </section>

      {/* Cartazes */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">4. Nos cartazes</h2>
        {status === "CLOSED" ? (
          <p className="text-text-secondary">Alerta encerrado: os cartazes deixam de existir (como hoje), então não há oferta ativa em lugar nenhum.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {FORMATS.map(([f, label]) => (
              <figure key={f} className="flex flex-col gap-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={posterUrl(f)} alt={`Cartaz ${label} de exemplo`} className="w-full rounded-md border border-border" />
                <figcaption className="text-sm font-semibold">{label}</figcaption>
              </figure>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
