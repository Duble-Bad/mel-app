import { PetCardSkeleton, Skeleton } from "@/components/ui/Surface";
import { SkeletonPhoto } from "@/components/ui/motion/SkeletonPhoto";

/**
 * Esqueletos de página (desempenho, item 01 de 2026-11-17): aparecem na hora, no mesmo formato do
 * conteúdo final, para a tela não parecer travada e o layout não pular quando os dados chegam.
 * Só visual: cada um anuncia "Carregando…" para leitor de tela e não muda a busca de dados.
 */
function Loading({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div role="status" aria-live="polite" aria-label={label} className={className} data-testid="page-skeleton">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** Página de detalhe (alerta, pet, adoção, parceiro, encontrado): foto à esquerda no desktop, em cima no celular. */
export function DetailSkeleton({ label = "Carregando…" }: { label?: string }) {
  return (
    <Loading label={label} className="flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-10">
      {/* Veio de um cartão: a foto dele já ocupa este lugar (voo entre as páginas). */}
      <SkeletonPhoto className="aspect-[4/3] w-full rounded-none lg:rounded-[20px]" />
      <div className="flex flex-col gap-4 px-4 lg:px-0">
        <Skeleton className="h-6 w-24 rounded-full" />
        <Skeleton className="h-9 w-1/2" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="mt-2 h-16 w-full rounded-lg" />
        <div className="grid grid-cols-4 gap-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-md" />
          ))}
        </div>
        <Skeleton className="h-24 w-full rounded-lg" />
      </div>
    </Loading>
  );
}

/** Lista de linhas (conversas, avisos, Radar, moderação): avatar + duas linhas. */
export function ListSkeleton({ label = "Carregando…", rows = 5 }: { label?: string; rows?: number }) {
  return (
    <Loading label={label} className="flex flex-col gap-3">
      <Skeleton className="h-8 w-1/2" />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg border border-border/70 bg-surface p-3">
          <Skeleton className="size-11 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3.5 w-4/5" />
          </div>
        </div>
      ))}
    </Loading>
  );
}

/** Formulário em etapas (publicar, editar, cadastro do pet): título, indicador e campos. */
export function FormSkeleton({ label = "Carregando…", steps = 6 }: { label?: string; steps?: number }) {
  return (
    <Loading label={label} className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-3.5 w-28" />
        <div className="flex items-center justify-between gap-2">
          {Array.from({ length: steps }, (_, i) => (
            <Skeleton key={i} className="size-9 rounded-full" />
          ))}
        </div>
      </div>
      <Skeleton className="h-8 w-3/5" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex flex-col gap-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-12 w-full rounded-md" />
        </div>
      ))}
      <Skeleton className="mt-2 h-13 w-full rounded-md" />
    </Loading>
  );
}

/** Cabeçalho do perfil (foto e nome) com os cartões logo abaixo. */
export function ProfileSkeleton({ label = "Carregando seu perfil…" }: { label?: string }) {
  return (
    <Loading label={label} className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Skeleton className="size-16 rounded-full" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <Skeleton className="h-28 w-full rounded-2xl" />
    </Loading>
  );
}

/** Grade de cartões (pets, parceiros). */
export function CardGridSkeleton({ label = "Carregando…", cards = 4 }: { label?: string; cards?: number }) {
  return (
    <Loading label={label} className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: cards }, (_, i) => (
        <PetCardSkeleton key={i} />
      ))}
    </Loading>
  );
}

/** Mapa: barra de filtros e a área do mapa. */
export function MapSkeleton({ label = "Carregando mapa…" }: { label?: string }) {
  return (
    <Loading label={label} className="flex flex-col gap-4 pt-6">
      <Skeleton className="h-9 w-56" />
      <div className="flex gap-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-10 w-24 rounded-full" />
        ))}
      </div>
      <Skeleton className="h-[60vh] min-h-80 w-full rounded-[20px]" />
    </Loading>
  );
}
