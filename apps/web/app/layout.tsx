import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { themes } from "@mel/ui-tokens";
import { THEME_INIT_SCRIPT } from "@/lib/theme/theme";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { ToastProvider } from "@/components/ui/Toast";
import "./globals.css";

// Fonte variável (200–800): pesos intermediários como 650 do Design System.
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "MEL — Uma rede inteira procurando com você",
    template: "%s · MEL",
  },
  description:
    "Plataforma de proteção animal que conecta tutores, vizinhos e protetores para reencontrar animais perdidos.",
  applicationName: "MEL",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: themes.light.background },
    { media: "(prefers-color-scheme: dark)", color: themes.dark.background },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // data-theme é aplicado pelo script antes da hidratação (por isso o suppressHydrationWarning).
    <html lang="pt-BR" className={`${jakarta.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        {/* Antes da 1ª pintura: evita piscar claro antes do tema escuro. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col bg-background text-text-primary">
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
