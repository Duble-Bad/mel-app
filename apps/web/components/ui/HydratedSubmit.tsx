"use client";

import { useSyncExternalStore, type ComponentProps } from "react";

const subscribe = () => () => {};

/** `false` no HTML do servidor e até o React assumir a página; `true` depois. */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}

/**
 * Botão de envio de formulário que depende de JavaScript (`onSubmit`).
 * Antes de a página ficar interativa (celular lento, rede fraca), um toque
 * faria o navegador enviar o formulário "à moda antiga": recarregaria a mesma
 * página e o que a pessoa digitou se perderia, sem nada ser enviado. Por isso
 * ele nasce desabilitado e libera sozinho assim que a página está pronta.
 * Com o botão padrão desabilitado, o Enter num campo também não envia.
 */
export function HydratedSubmit({ disabled, ...props }: ComponentProps<"button">) {
  const hydrated = useHydrated();
  return <button {...props} type="submit" disabled={!hydrated || disabled} data-hydrated={hydrated || undefined} />;
}
