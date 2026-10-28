import type { Metadata, Viewport } from "next";
import { Figtree } from "next/font/google";
import { colors } from "@mel/ui-tokens";
import { AppHeader } from "@/components/layout/AppHeader";
import "./globals.css";

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin", "latin-ext"],
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
  themeColor: colors.background,
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${figtree.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-background text-text-primary">
        <AppHeader />
        {children}
      </body>
    </html>
  );
}
