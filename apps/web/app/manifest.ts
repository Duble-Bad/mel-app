import type { MetadataRoute } from "next";
import { themes } from "@mel/ui-tokens";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "MEL — Movimento de Encontro e Localização",
    short_name: "MEL",
    description: "Uma rede inteira procurando com você: pets perdidos, encontrados, avistamentos e adoção.",
    lang: "pt-BR",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: themes.light.background,
    theme_color: themes.light.background,
    categories: ["lifestyle", "social"],
    icons: [
      { src: "/brand/app-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/app-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/brand/app-icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Perdi meu pet", url: "/publicar/perdido", icons: [{ src: "/brand/app-icon-192.png", sizes: "192x192" }] },
      { name: "Mapa da rede", url: "/mapa", icons: [{ src: "/brand/app-icon-192.png", sizes: "192x192" }] },
    ],
  };
}
