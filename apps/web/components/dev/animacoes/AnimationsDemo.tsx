"use client";

import { useState, type ReactNode } from "react";
import { RotateCcw } from "lucide-react";
import { CountUp } from "@/components/home/CountUp";
import { Alert } from "@/components/ui/Alert";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { PasswordStrengthMeter } from "@/components/ui/PasswordStrengthMeter";
import { CopyFace } from "@/components/ui/motion/CopyFace";
import { SuccessCheck } from "@/components/ui/motion/SuccessCheck";

/** Vitrine interna das microanimações; cada bloco tem "Repetir". */
export function AnimationsDemo() {
  const [run, setRun] = useState(0);
  const [tab, setTab] = useState<"entrar" | "criar">("entrar");
  const [password, setPassword] = useState("");
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Microanimações</h1>
        <button type="button" onClick={() => setRun((n) => n + 1)} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border-strong px-4 font-semibold">
          <RotateCcw aria-hidden="true" className="size-4" /> Repetir tudo
        </button>
      </header>

      <Block title="1. Sucesso (Check Draw) e reencontro com confete">
        <div key={run} className="flex flex-wrap items-center gap-10 py-6">
          <SuccessCheck tone="found" size={72} confetti />
          <SuccessCheck tone="brand" size={72} />
          <SuccessCheck tone="sighting" size={72} />
        </div>
        <div key={`a${run}`} className="flex flex-col gap-3">
          <Alert tone="success" celebrate="brand">
            <strong>Alerta MEL ativado.</strong> Agora outras pessoas poderão ajudar na busca.
          </Alert>
          <Alert tone="success" celebrate="sighting">
            <strong>Obrigado!</strong> O tutor já foi avisado.
          </Alert>
        </div>
      </Block>

      <Block title="2. Números da rede (Odometer Roll)">
        <p key={run} className="flex flex-wrap gap-8 text-5xl font-extrabold">
          <CountUp value={1284} />
          <CountUp value={78} />
          <CountUp value={20} />
        </p>
      </Block>

      <Block title="4. Abas (Sliding Thumb)">
        <div className="max-w-sm">
          <SegmentedControl label="Demonstração" value={tab} onChange={setTab} options={[{ value: "entrar", label: "Entrar" }, { value: "criar", label: "Criar conta" }]} />
        </div>
      </Block>

      <Block title="7. Força da senha (Flow Fill)">
        <label className="flex max-w-sm flex-col gap-2 font-semibold">
          Senha de teste
          <input value={password} onChange={(e) => setPassword(e.target.value)} className="rounded-md border-2 border-border-strong bg-surface px-3 py-2 font-normal" placeholder="Ex.: Melzinha7!casa" />
        </label>
        <div className="max-w-sm">
          <PasswordStrengthMeter password={password} />
        </div>
      </Block>

      <Block title="8. Copiar link (Select Sweep)">
        <button
          type="button"
          onClick={() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 3000);
          }}
          className="relative inline-flex min-h-12 max-w-xs items-center justify-center overflow-hidden rounded-md border-2 border-border-strong bg-surface px-5 font-semibold"
        >
          <CopyFace copied={copied} idle={<>🔗 Copiar link</>} />
        </button>
      </Block>

      <p className="text-sm text-text-secondary">
        3 (foto que voa), 5 (chat) e 6 (sininho) dependem de navegação, de conversa real e de aviso em tempo real: veja no mural → alerta, numa conversa e no cabeçalho logado.
      </p>
    </div>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-card border border-border bg-surface p-5">
      <h2 className="text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}
