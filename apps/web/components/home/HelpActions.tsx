type Tone = "lost" | "found" | "sighting" | "adoption";

interface HelpAction {
  label: string;
  hint: string;
  icon: string;
  tone: Tone;
}

// Os fluxos são liberados milestone a milestone (docs/06-milestones.md).
// Enquanto um fluxo não existe, o botão aparece desabilitado e diz isso —
// nunca um link que leva a lugar nenhum.
const ACTIONS: HelpAction[] = [
  { label: "Perdi meu pet", hint: "Ative um alerta em 2 minutos", icon: "🔴", tone: "lost" },
  { label: "Encontrei um pet", hint: "Ajude a achar o tutor", icon: "🟢", tone: "found" },
  { label: "Vi um pet", hint: "Envie uma pista", icon: "🟡", tone: "sighting" },
  { label: "Quero adotar", hint: "Conheça quem procura um lar", icon: "❤️", tone: "adoption" },
];

const toneClasses: Record<Tone, string> = {
  lost: "border-status-lost bg-status-lost-soft text-status-lost",
  found: "border-status-found bg-status-found-soft text-status-found",
  sighting: "border-status-sighting bg-status-sighting-soft text-status-sighting",
  adoption: "border-status-adoption bg-status-adoption-soft text-status-adoption",
};

export function HelpActions() {
  return (
    <ul className="grid grid-cols-2 gap-3">
      {ACTIONS.map((action) => (
        <li key={action.label}>
          <button
            type="button"
            disabled
            aria-describedby="acoes-em-breve"
            className={`flex min-h-32 w-full flex-col items-start justify-between rounded-lg border-2 p-4 text-left opacity-80 ${toneClasses[action.tone]}`}
          >
            <span aria-hidden="true" className="text-2xl">
              {action.icon}
            </span>
            <span>
              <span className="block text-lg leading-tight font-bold uppercase">{action.label}</span>
              <span className="mt-1 block text-sm text-text-secondary">{action.hint}</span>
            </span>
          </button>
        </li>
      ))}
      <li id="acoes-em-breve" className="col-span-2 text-sm text-text-secondary">
        Estamos preparando estes caminhos. Em breve você poderá usá-los por aqui.
      </li>
    </ul>
  );
}
