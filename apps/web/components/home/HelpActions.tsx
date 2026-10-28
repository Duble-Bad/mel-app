import Link from "next/link";

type Tone = "lost" | "found" | "sighting" | "adoption";

interface HelpAction {
  label: string;
  hint: string;
  icon: string;
  tone: Tone;
  /** Sem href = fluxo ainda não liberado (aparece desabilitado, nunca link falso). */
  href?: string;
}

// Os fluxos são liberados milestone a milestone (docs/06-milestones.md).
const ACTIONS: HelpAction[] = [
  { label: "Perdi meu pet", hint: "Ative um alerta em 2 minutos", icon: "🔴", tone: "lost", href: "/publicar/perdido" },
  { label: "Encontrei um pet", hint: "Ajude a achar o tutor", icon: "🟢", tone: "found", href: "/publicar/encontrado" },
  { label: "Vi um pet", hint: "Viu um animal solto? Avise", icon: "🟡", tone: "sighting", href: "/publicar/encontrado?vi=1" },
  { label: "Quero adotar", hint: "Conheça quem procura um lar", icon: "❤️", tone: "adoption" },
];

const toneClasses: Record<Tone, string> = {
  lost: "border-status-lost bg-status-lost-soft text-status-lost",
  found: "border-status-found bg-status-found-soft text-status-found",
  sighting: "border-status-sighting bg-status-sighting-soft text-status-sighting",
  adoption: "border-status-adoption bg-status-adoption-soft text-status-adoption",
};

const base = "flex min-h-32 w-full flex-col items-start justify-between rounded-lg border-2 p-4 text-left";

function Content({ action }: { action: HelpAction }) {
  return (
    <>
      <span aria-hidden="true" className="text-2xl">
        {action.icon}
      </span>
      <span>
        <span className="block text-lg leading-tight font-bold uppercase">{action.label}</span>
        <span className="mt-1 block text-sm text-text-secondary">{action.hint}</span>
      </span>
    </>
  );
}

export function HelpActions() {
  const pending = ACTIONS.some((a) => !a.href);
  return (
    <ul className="grid grid-cols-2 gap-3">
      {ACTIONS.map((action) => (
        <li key={action.label}>
          {action.href ? (
            <Link href={action.href} className={`${base} shadow-card ${toneClasses[action.tone]}`}>
              <Content action={action} />
            </Link>
          ) : (
            <button
              type="button"
              disabled
              aria-describedby="acoes-em-breve"
              className={`${base} opacity-70 ${toneClasses[action.tone]}`}
            >
              <Content action={action} />
            </button>
          )}
        </li>
      ))}
      {pending && (
        <li id="acoes-em-breve" className="col-span-2 text-sm text-text-secondary">
          Os outros caminhos chegam em breve.
        </li>
      )}
    </ul>
  );
}
