"use client";

import { Button } from "@/components/ui/Button";

export function PrintButton() {
  return <Button onClick={() => window.print()}>🖨️ Imprimir ou salvar PDF</Button>;
}
