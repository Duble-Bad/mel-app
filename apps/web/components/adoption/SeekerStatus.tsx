"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BellOff, BellRing, CalendarClock, CircleCheck, Hourglass, Pencil, RefreshCw, Trash2, TriangleAlert } from "lucide-react";
import {
  type AdoptionSeeker,
  radiusLabel,
  SEEKER_DELETE_AFTER_EXPIRY_DAYS,
  SEEKER_HOUSING_LABELS,
  SEEKER_STATUS_LABELS,
  seekerPreferenceLabel,
  userErrorMessage,
} from "@mel/core";
import { renewMyAdoptionSeeker, setMyAdoptionSeekerContact, setMyAdoptionSeekerNotify, withdrawMyAdoptionSeeker } from "@mel/data";
import { getBrowserClient } from "@/lib/supabase/browser";
import { Alert } from "@/components/ui/Alert";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import { SeekerForm } from "./SeekerForm";

const date = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo" });

/** Depois do envio: status (Em análise / Aprovado / Expira em), Renovar, Pausar avisos, Editar e Cancelar. */
export function SeekerStatus({ seeker, firstName }: { seeker: AdoptionSeeker; firstName: string | null }) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [busy, setBusy] = useState<"renew" | "notify" | "contact" | "cancel" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState(false);
  // Momento da montagem: suficiente para "vencido" e "faltam N dias".
  const [now] = useState(() => Date.now());

  const expired = new Date(seeker.expiresAt).getTime() <= now;
  const daysLeft = Math.ceil((new Date(seeker.expiresAt).getTime() - now) / 86_400_000);

  async function run(kind: "renew" | "notify" | "contact" | "cancel", fn: () => Promise<unknown>, done: string) {
    setBusy(kind);
    setError(null);
    try {
      await fn();
      toast({ tone: "success", title: done });
      if (kind === "cancel") setCancelled(true);
      router.refresh();
    } catch (err) {
      setError(userErrorMessage(err, "Não conseguimos aplicar agora. Tente de novo."));
    } finally {
      setBusy(null);
    }
  }

  if (cancelled) {
    return (
      <div className="grid justify-items-center gap-3.5 py-3 text-center">
        <h2 className="text-[28px] font-extrabold">Interesse cancelado</h2>
        <p className="max-w-[46ch] text-text-secondary">Removemos você da fila e apagamos suas preferências. Pode voltar quando quiser.</p>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-2xl font-extrabold">Editar meu interesse</h2>
        <p className="text-text-secondary">Mudanças nas preferências, no bairro ou na rotina passam de novo pela moderação.</p>
        <SeekerForm viewer="ready" firstName={firstName} initial={seeker} onSaved={() => setEditing(false)} onCancel={() => setEditing(false)} />
      </div>
    );
  }

  const tone =
    seeker.status === "REJECTED"
      ? { icon: TriangleAlert, box: "border-status-lost/30 bg-status-lost-soft", iconClass: "text-status-lost" }
      : seeker.status === "APPROVED" && !expired
        ? { icon: CircleCheck, box: "border-status-found/30 bg-status-found-soft", iconClass: "text-status-found" }
        : { icon: Hourglass, box: "border-primary/40 bg-primary-soft/50", iconClass: "text-primary" };
  const Icon = tone.icon;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-[28px] leading-tight font-extrabold">Você está na fila!</h2>
        <p className="mt-1 text-text-secondary">Procurando: {seekerPreferenceLabel(seeker)}.</p>
      </div>

      <div className={`flex gap-3 rounded-[14px] border p-4 ${tone.box}`} role="status">
        <Icon aria-hidden="true" className={`mt-0.5 size-6 shrink-0 ${tone.iconClass}`} strokeWidth={2} />
        <div className="flex flex-col gap-1">
          <p className="font-bold">
            {expired ? "Interesse vencido" : SEEKER_STATUS_LABELS[seeker.status]}
            {seeker.status === "APPROVED" && !expired && " · você recebe avisos de animais compatíveis"}
          </p>
          {seeker.status === "PENDING_REVIEW" && <p className="text-sm">A moderação revisa em breve. Até lá, você não aparece na lista nem recebe avisos.</p>}
          {seeker.status === "REJECTED" && (
            <p className="text-sm">
              {seeker.reviewNote ? `Motivo: ${seeker.reviewNote}` : "A moderação não aprovou."} Edite o perfil para enviar de novo.
            </p>
          )}
          {expired ? (
            <p className="text-sm">
              Venceu em {date(seeker.expiresAt)}. Renove para voltar à fila; sem renovação, apagamos tudo {SEEKER_DELETE_AFTER_EXPIRY_DAYS} dias depois do vencimento.
            </p>
          ) : (
            <p className="flex items-center gap-1.5 text-sm">
              <CalendarClock aria-hidden="true" className="size-4 shrink-0" strokeWidth={2} />
              Expira em {date(seeker.expiresAt)}
              {daysLeft <= 14 && ` (${daysLeft === 1 ? "falta 1 dia" : `faltam ${daysLeft} dias`})`}.
            </p>
          )}
        </div>
      </div>

      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-text-secondary">Bairro</dt>
          <dd className="font-semibold">
            {seeker.areaLabel} · até {radiusLabel(seeker.radiusM as 1000 | 3000 | 5000 | 10000)}
          </dd>
        </div>
        <div>
          <dt className="text-text-secondary">Moradia</dt>
          <dd className="font-semibold">{SEEKER_HOUSING_LABELS[seeker.housing]}</dd>
        </div>
        <div>
          <dt className="text-text-secondary">Lista pública “Querem adotar”</dt>
          <dd className="font-semibold">{seeker.showPublic ? "Aparece (só primeiro nome, bairro e preferências)" : "Não aparece (perfil privado)"}</dd>
        </div>
        <div>
          <dt className="text-text-secondary">WhatsApp</dt>
          <dd className="font-semibold">{seeker.whatsapp ? "Informado (só a moderação vê)" : "Não informado"}</dd>
        </div>
      </dl>

      {/* Consentimento de contato (LGPD: opt-in, desliga quando quiser; não volta para a moderação). */}
      <div className="rounded-[14px] border border-border p-4">
        <Switch
          checked={seeker.contactOk}
          disabled={busy !== null || (!seeker.showPublic && !seeker.contactOk)}
          onChange={(on) =>
            run(
              "contact",
              () => setMyAdoptionSeekerContact(getBrowserClient(), on),
              on ? "Pronto: quem anuncia pode puxar conversa com você." : "Contato desligado.",
            )
          }
          label="Aceito ser contatado por quem anuncia"
          description={
            seeker.showPublic
              ? "ONGs e protetores com animal disponível podem iniciar uma conversa pelo chat da MEL. Eles veem só o que aparece na lista. Você pode bloquear ou denunciar."
              : "Só vale para quem aparece na lista pública “Querem adotar”. Para aparecer, edite seu interesse."
          }
        />
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      <div className="grid gap-2 sm:grid-cols-2">
        {seeker.status !== "REJECTED" && (
          <Button
            size="md"
            onClick={() => run("renew", () => renewMyAdoptionSeeker(getBrowserClient()), "Interesse renovado por mais 90 dias.")}
            loading={busy === "renew"}
            loadingText="Renovando…"
            disabled={busy !== null}
          >
            <RefreshCw aria-hidden="true" className="size-4" strokeWidth={2} /> Renovar por 90 dias
          </Button>
        )}
        <Button
          size="md"
          variant="secondary"
          onClick={() =>
            run(
              "notify",
              () => setMyAdoptionSeekerNotify(getBrowserClient(), !seeker.notify),
              seeker.notify ? "Avisos pausados." : "Avisos retomados.",
            )
          }
          loading={busy === "notify"}
          loadingText="Salvando…"
          disabled={busy !== null}
          aria-pressed={!seeker.notify}
        >
          {seeker.notify ? <BellOff aria-hidden="true" className="size-4" strokeWidth={2} /> : <BellRing aria-hidden="true" className="size-4" strokeWidth={2} />}
          {seeker.notify ? "Pausar avisos" : "Retomar avisos"}
        </Button>
        <Button size="md" variant="secondary" onClick={() => setEditing(true)} disabled={busy !== null}>
          <Pencil aria-hidden="true" className="size-4" strokeWidth={2} /> Editar meu interesse
        </Button>
        <ButtonLink href="/adocao" size="md" variant="ghost">
          Ver animais disponíveis
        </ButtonLink>
      </div>

      <div className="border-t border-border pt-4">
        {confirmCancel ? (
          <div className="flex flex-col gap-3">
            <p className="font-semibold">Cancelar e apagar seu interesse? Isso não pode ser desfeito.</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                size="md"
                variant="danger"
                className="sm:w-auto"
                onClick={() => run("cancel", () => withdrawMyAdoptionSeeker(getBrowserClient()), "Interesse cancelado.")}
                loading={busy === "cancel"}
                loadingText="Apagando…"
                disabled={busy !== null}
              >
                Sim, cancelar e apagar
              </Button>
              <Button size="md" variant="secondary" className="sm:w-auto" onClick={() => setConfirmCancel(false)} disabled={busy !== null}>
                Manter
              </Button>
            </div>
          </div>
        ) : (
          <Button size="md" variant="ghost" className="sm:w-auto" onClick={() => setConfirmCancel(true)} disabled={busy !== null}>
            <Trash2 aria-hidden="true" className="size-4" strokeWidth={2} /> Cancelar meu interesse
          </Button>
        )}
      </div>
    </div>
  );
}
