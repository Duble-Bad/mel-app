import type { ReactNode } from "react";

/**
 * Layout único das páginas de detalhe de um caso (alerta de pet perdido,
 * encontrado / visto solto, adoção): padrão de página de produto.
 * Desktop: à esquerda só as fotos, fixas durante a rolagem; à direita todo o
 * conteúdo em sequência. Celular: uma coluna, foto em cima, na mesma ordem.
 * Antes, só o alerta tinha as duas colunas e as outras ficavam numa coluna
 * estreita no meio da tela.
 */
export const DETAIL_MAIN_CLASS = "mx-auto w-full max-w-xl flex-1 pb-10 lg:max-w-[1264px] lg:px-8 lg:pt-8";

export function DetailLayout({ media, children, className = "" }: { media: ReactNode; children: ReactNode; className?: string }) {
  return (
    <article className={className}>
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start lg:gap-x-10">
        <div className="lg:sticky lg:top-24">{media}</div>
        <div className="flex min-w-0 flex-col gap-6 px-[var(--mel-page-gutter)] lg:px-0">{children}</div>
      </div>
    </article>
  );
}
