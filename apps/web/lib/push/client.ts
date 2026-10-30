"use client";

import { UserFacingError } from "@mel/core";
import { removePushSubscription, savePushSubscription } from "@mel/data";
import { getBrowserClient } from "@/lib/supabase/browser";

export type PushState = "unsupported" | "denied" | "off" | "on";

export const pushSupported = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

async function registration() {
  return navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

/** Estado deste aparelho (permissão + inscrição). */
export async function getPushState(): Promise<PushState> {
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  return sub ? "on" : "off";
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Pede permissão, inscreve o aparelho e grava no banco. Mensagens humanas em caso de erro. */
export async function enablePush(): Promise<void> {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!pushSupported()) throw new UserFacingError("Este navegador não recebe notificações. No iPhone, adicione a MEL à tela de início primeiro.");
  if (!publicKey) throw new UserFacingError("Notificações no celular ainda não estão configuradas.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new UserFacingError("Você não permitiu notificações. Dá para mudar nas configurações do navegador.");
  }
  const reg = await registration();
  await navigator.serviceWorker.ready;
  let sub: PushSubscription;
  try {
    sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }));
  } catch (err) {
    // O serviço de push do navegador recusou (modo anônimo, navegador sem push, rede…).
    console.error("[push] inscrição recusada pelo navegador", err);
    throw new UserFacingError("Este navegador não conseguiu ativar os avisos agora. Tente de novo mais tarde ou use o Chrome, Edge ou Firefox. Os avisos continuam no sininho do app.");
  }
  const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  await savePushSubscription(getBrowserClient(), json, navigator.userAgent);
}

export async function disablePush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await removePushSubscription(getBrowserClient(), sub.endpoint);
  await sub.unsubscribe();
}

/** Pede ao servidor para enviar os avisos que acabaram de ser criados (não bloqueia a tela). */
export function kickPushDispatch() {
  void fetch("/api/push/dispatch", { method: "POST" }).catch((err) => console.error("[push] despacho não iniciado", err));
}
