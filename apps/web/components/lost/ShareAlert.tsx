"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { shareText, whatsappShareUrl, type PublicLostCase } from "@mel/core";

type Network = "whatsapp" | "facebook" | "instagram" | "tiktok";
type ImageNetwork = "instagram" | "tiktok";
type ImageFormat = "story" | "portrait" | "square";

// Instagram e TikTok não aceitam publicação vinda de um site: a MEL prepara o cartaz no
// formato certo e o entrega ao celular (menu de compartilhamento) ou baixa a imagem.
// A escolha do app é do sistema; nada aqui afirma que algo foi publicado.
const IMAGE_FORMATS: Record<ImageNetwork, { app: string; options: { format: ImageFormat; label: string; hint: string }[]; note: string }> = {
  instagram: {
    app: "Instagram",
    options: [
      { format: "story", label: "Stories", hint: "9:16, tela cheia" },
      { format: "portrait", label: "Feed", hint: "4:5, recomendado" },
      { format: "square", label: "Feed quadrado", hint: "1:1" },
    ],
    note: "Depois, cole o link do alerta na legenda ou num adesivo de link.",
  },
  tiktok: {
    app: "TikTok",
    // Publicação de foto no TikTok ocupa a tela toda: vertical 9:16.
    options: [{ format: "story", label: "Foto vertical", hint: "9:16, tela cheia" }],
    note: "No TikTok, publique como foto e cole o link do alerta na legenda.",
  },
};

/**
 * Compartilhar: WhatsApp e Facebook (link do alerta), Instagram e TikTok (cartaz para
 * publicar no app), menu nativo do celular, copiar link e cartaz/QR Code.
 */
export function ShareAlert({ lostCase, path }: { lostCase: Pick<PublicLostCase, "pet" | "areaLabel" | "lostAt" | "status">; path: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guide, setGuide] = useState<ImageNetwork | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [preparing, setPreparing] = useState<ImageFormat | null>(null);
  const url = () => `${window.location.origin}${path}`;
  const title = lostCase.status === "FOUND" ? `Encontrado: ${lostCase.pet.name}` : `Procura-se: ${lostCase.pet.name}`;

  function whatsapp() {
    window.open(whatsappShareUrl(shareText(lostCase, url())), "_blank", "noopener");
  }

  function facebook() {
    // Compartilhamento oficial do Facebook pela web (sem SDK): só o link do alerta.
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url())}`, "_blank", "noopener");
  }

  async function copy() {
    setError(null);
    try {
      await navigator.clipboard.writeText(url());
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
      return true;
    } catch {
      setError("Não conseguimos copiar. Selecione o endereço na barra do navegador.");
      return false;
    }
  }

  async function moreOptions() {
    setError(null);
    // Menu nativo do celular (inclui Instagram, Telegram…). Sem ele, copia o link.
    if (!("share" in navigator)) return copy();
    try {
      await navigator.share({ title, text: shareText(lostCase, url()), url: url() });
    } catch (err) {
      if ((err as Error).name !== "AbortError") setError("Não conseguimos abrir o compartilhamento. Use Copiar link.");
    }
  }

  function openGuide(n: ImageNetwork) {
    setError(null);
    setNotice(null);
    setGuide((g) => (g === n ? null : n));
  }

  /**
   * Gera o cartaz no formato escolhido e o entrega ao celular (só se o navegador
   * confirmar que aceita arquivos); senão baixa a imagem. Um toque, um resultado.
   */
  async function sendPoster(network: ImageNetwork, format: ImageFormat) {
    const app = IMAGE_FORMATS[network].app;
    setError(null);
    setNotice(null);
    setPreparing(format);
    try {
      const res = await fetch(`${path}/cartaz/${format}`);
      if (!res.ok) throw new Error(String(res.status));
      const name = `MEL-${lostCase.pet.name}-${format}.png`.normalize("NFD").replace(/[^\w.-]/g, "");
      const file = new File([await res.blob()], name, { type: "image/png" });
      if (typeof navigator.share === "function" && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title, text: shareText(lostCase, url()) });
        setNotice(`Cartaz entregue ao app escolhido. Se o ${app} não apareceu na lista, salve a imagem e publique pelo app do ${app}.`);
        return;
      }
      // Sem envio de arquivos neste navegador (ex.: computador): baixa o cartaz.
      const href = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = href;
      a.download = name;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 10_000);
      setNotice(`Este navegador não envia imagens direto para o ${app}. Baixamos o cartaz: abra o app do ${app} e publique a partir da galeria.`);
    } catch (err) {
      if ((err as Error).name !== "AbortError") setError("Não conseguimos preparar o cartaz agora. Tente de novo ou use “Cartaz e QR Code”.");
    } finally {
      setPreparing(null);
    }
  }

  const btn =
    "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md border-2 border-border-strong bg-surface px-4 font-semibold hover:bg-surface-muted";
  const tile =
    "flex min-h-[84px] w-full flex-col items-center justify-center gap-1.5 rounded-md border-2 border-border bg-surface px-1 py-2 text-sm font-semibold transition-colors hover:border-border-strong hover:bg-surface-muted aria-expanded:border-primary";

  const networks: { id: Network; name: string; label: string; icon: ReactNode; onClick: () => void; expands?: boolean }[] = [
    { id: "whatsapp", name: "WhatsApp", label: "Compartilhar no WhatsApp", icon: <WhatsAppIcon />, onClick: whatsapp },
    { id: "facebook", name: "Facebook", label: "Compartilhar no Facebook", icon: <FacebookIcon />, onClick: facebook },
    { id: "tiktok", name: "TikTok", label: "Publicar no TikTok", icon: <TikTokIcon />, onClick: () => openGuide("tiktok"), expands: true },
    { id: "instagram", name: "Instagram", label: "Publicar no Instagram", icon: <InstagramIcon />, onClick: () => openGuide("instagram"), expands: true },
  ];

  return (
    <div className="flex flex-col gap-2">
      <ul className="grid grid-cols-4 gap-2" aria-label="Redes sociais" data-testid="share-networks">
        {networks.map((n) => (
          <li key={n.id}>
            <button
              type="button"
              onClick={n.onClick}
              aria-label={n.label}
              aria-expanded={n.expands ? guide === n.id : undefined}
              aria-controls={n.expands ? "compartilhar-imagem" : undefined}
              className={tile}
            >
              {n.icon}
              <span aria-hidden="true">{n.name}</span>
            </button>
          </li>
        ))}
      </ul>

      {guide && (
        <div id="compartilhar-imagem" className="flex flex-col gap-3 rounded-md border border-border bg-surface-muted p-4" data-testid="share-image-guide">
          <p className="font-semibold">
            {guide === "tiktok" ? "Cartaz para publicar no TikTok" : "Qual formato do Instagram?"}
          </p>
          <div className={`grid gap-2 ${IMAGE_FORMATS[guide].options.length > 1 ? "grid-cols-3" : "grid-cols-1"}`}>
            {IMAGE_FORMATS[guide].options.map((o) => (
              <button
                key={o.format}
                type="button"
                onClick={() => sendPoster(guide, o.format)}
                disabled={preparing !== null}
                aria-label={`${o.label} (${o.hint}): preparar o cartaz para o ${IMAGE_FORMATS[guide].app}`}
                className="flex min-h-16 flex-col items-center justify-center rounded-md border-2 border-border-strong bg-surface px-2 py-2 text-center hover:bg-surface-muted disabled:opacity-60"
              >
                <span className="font-semibold">{preparing === o.format ? "Preparando…" : o.label}</span>
                <span className="text-xs text-text-secondary">{o.hint}</span>
              </button>
            ))}
          </div>
          <p className="text-sm text-text-secondary">
            No celular, escolha o {IMAGE_FORMATS[guide].app} na lista que abrir. {IMAGE_FORMATS[guide].note}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={moreOptions} className={btn}>
          <span aria-hidden="true">↗</span> Mais opções
        </button>
        <button type="button" onClick={copy} className={btn}>
          <span aria-hidden="true">🔗</span> {copied ? "Link copiado!" : "Copiar link"}
        </button>
      </div>
      <Link href={`${path}/cartaz`} className={btn}>
        <span aria-hidden="true">🖼️</span> Cartaz e QR Code (baixar ou imprimir)
      </Link>
      <p role="status" className={notice ? "text-sm font-medium text-success" : "sr-only"} data-testid="share-status">
        {notice ?? (copied ? "Link copiado" : "")}
      </p>
      {error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

// Marcas simplificadas (só identificação do destino), desenhadas aqui: sem SDK nem pacote.
const iconBox = "grid size-10 place-items-center rounded-xl";

function WhatsAppIcon() {
  return (
    <span aria-hidden="true" className={`${iconBox} bg-[#25D366]`}>
      <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round">
        <path d="M12 3.5a8.5 8.5 0 0 0-7.3 12.8L3.5 20.5l4.3-1.1A8.5 8.5 0 1 0 12 3.5z" />
        <path
          d="M9.2 8.3c.2-.4.4-.4.7-.4h.5c.2 0 .4 0 .5.4l.7 1.6c.1.2 0 .4-.1.6l-.5.6c-.1.1-.1.3 0 .5.6 1 1.4 1.8 2.5 2.4.2.1.4.1.5-.1l.6-.7c.2-.2.4-.2.6-.1l1.6.8c.2.1.3.3.3.5 0 .5-.2 1.1-.6 1.4-.5.4-1.2.6-1.9.4-2.6-.7-4.6-2.6-5.6-5.1-.3-.8-.2-1.7.3-2.2z"
          fill="#fff"
          stroke="none"
        />
      </svg>
    </span>
  );
}

function FacebookIcon() {
  return (
    <span aria-hidden="true" className={`${iconBox} bg-[#1877F2]`}>
      <svg viewBox="0 0 24 24" className="size-6" fill="#fff">
        <path d="M13.4 21v-7.6h2.6l.4-3h-3V8.5c0-.9.3-1.5 1.5-1.5h1.6V4.3c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.2H7.7v3h2.6V21z" />
      </svg>
    </span>
  );
}

function InstagramIcon() {
  return (
    <span aria-hidden="true" className={`${iconBox} bg-[linear-gradient(45deg,#f9a825,#e1306c_45%,#833ab4)]`}>
      <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="#fff" strokeWidth="1.9">
        <rect x="4" y="4" width="16" height="16" rx="4.5" />
        <circle cx="12" cy="12" r="3.6" />
        <circle cx="16.9" cy="7.1" r="1" fill="#fff" stroke="none" />
      </svg>
    </span>
  );
}

function TikTokIcon() {
  const note = "M13.6 3.8h2.6c.2 1.8 1.5 3.1 3.3 3.3v2.6a6 6 0 0 1-3.3-1v5.9a4.8 4.8 0 1 1-4.8-4.8l.7.1v2.7a2.1 2.1 0 1 0 1.5 2z";
  return (
    // Borda clara: o quadrado preto não some no tema escuro.
    <span aria-hidden="true" className={`${iconBox} bg-black ring-1 ring-white/25`}>
      <svg viewBox="0 0 24 24" className="size-6">
        <path d={note} fill="#25F4EE" transform="translate(-0.9 -0.6)" />
        <path d={note} fill="#FE2C55" transform="translate(0.9 0.6)" />
        <path d={note} fill="#fff" />
      </svg>
    </span>
  );
}
