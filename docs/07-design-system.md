# MEL Design System 1.0

Fonte única da verdade visual. **Nenhuma tela nova sem estes tokens e componentes.**
Personalidade: premium, humana, acolhedora, confiável, sem estética infantil, com urgência só onde precisa.

## 1. Onde está cada coisa

| O quê | Arquivo |
|---|---|
| Cores, raios, sombras, movimento, gradientes (TS — cartazes, mapa, Expo) | `packages/ui-tokens/src/tokens.ts` |
| As mesmas variáveis em CSS (`--mel-*`) | `packages/ui-tokens/src/tokens.css` |
| Tokens → classes Tailwind, tipografia, animações | `apps/web/app/globals.css` |
| Componentes base | `apps/web/components/ui/*` |
| Marca (símbolo provisório, ilustração da rede) | `apps/web/components/brand/*` |

`tokens.test.ts` falha se TS e CSS divergirem ou se um par de texto/fundo não atingir **WCAG AA (4,5:1)**; bordas de foco e ícones de status precisam de 3:1.

## 2. Cores

- **Coral `#F45D4C`** (`brand-accent`, `primary-500`): marca, símbolo, ícones de destaque, anel de foco, indicadores, gradiente hero.
- **Ação** (`brand-primary` = `primary-700 #BB382D`, hover `primary-800`): botão principal e links. Motivo: coral 500 com texto branco tem contraste **3,2:1** e reprova AA; o 700 tem **5,6:1**. Para trocar a cor dos botões, mude só este token.
- **Ink** `#18212F`: títulos, navegação, superfícies escuras (toast).
- **Teal** `#2A9D8F`: conexão/positivo, com moderação.
- **Status**: cada um tem três tons. `status-*-accent` é a cor viva do DS, para pinos, pontos, ícones e bordas. `status-*` é a versão AA, para texto e para preenchimento com texto branco. `status-*-soft` é o fundo.
  Perdido = vermelho, encontrado = verde, avistamento = âmbar, adoção = violeta, info = azul.
- Superfícies: `background #FAFAF8`, `surface #FFF`, `surface-muted #F6F5F2`, `surface-warm #FFF8F5`; bordas `border`, `border-strong`, `border-input`.
- Texto: `text-primary` (ink), `text-secondary #667085`, `text-muted #98A2B3`. O muted é **só** para placeholder e decoração: não passa AA para texto.
- Proibido: hex em componentes, preto puro, cores fora dos tokens.

## 3. Tipografia: Plus Jakarta Sans (variável, `next/font`, self-hosted)

| Classe | Uso | Tamanho/linha |
|---|---|---|
| `text-4xl` | Display | 40/46 |
| `text-3xl` | H1 | 32/39 |
| `text-2xl` | H2 | 26/33 |
| `text-xl` | H3 | 21/28 |
| `text-lg` | Title | 18/25 |
| `text-body-lg` | Body large | 17/27 |
| `text-base` | Body (padrão do `body`) | 15,5/24 |
| `text-sm` | Small | 14/20 |
| `text-caption` | Caption | 12/17 |

`font-semibold` = **650**. Títulos com tracking levemente negativo.

## 4. Espaço, raio, sombra, movimento

- Espaço: escala de 4 px do Tailwind (4…80). Margem lateral `--mel-page-gutter`: 20 px, ou 16 px abaixo de 360 px.
- Raio: `rounded-sm` 10 · `rounded-md` 14 (inputs, botões) · `rounded-lg` 18 · `rounded-card` 20 · `rounded-hero` 28 · `rounded-full`.
- Sombra: `shadow-xs` · `shadow-sm` (cartões) · `shadow-md` (flutuantes) · `shadow-lg` (modais/sheets).
- Movimento: 120/200/320 ms, `ease-mel` = `cubic-bezier(.2,.8,.2,1)`. Animações: `animate-enter` (entrada), `animate-sheet-up`, `animate-pop`, `animate-toast`, `animate-shimmer`. Botão pressionado = `scale(.985)`. Tudo desliga com `prefers-reduced-motion`.
- **Movimento em CSS, sem Framer Motion por enquanto.** Cobre tudo que o DS pede hoje sem custo de JavaScript (performance em celular). Reavaliar quando houver gestos, como arrastar o bottom sheet.

## 5. Componentes base (`components/ui`)

| Componente | Notas |
|---|---|
| `Button`, `ButtonLink`, `IconButton` | variantes primary / secondary / ghost / danger / soft; 52 px (lg) ou 48 px (md); loading com spinner; pressed/focus/disabled |
| `TextField`, `PasswordField`, `TextareaField`, `SelectField` | 52 px, rótulo acima, ação ao lado do rótulo, anel de foco coral, erro com ícone abaixo. **O erro só aparece após blur com conteúdo ou envio** |
| `SegmentedControl` | abas ARIA com indicador deslizante; navega com ←/→ |
| `Alert`, `ErrorState`, `EmptyState`, `LoadingState` | ícones Lucide; o estado vazio sempre traz contexto |
| `StatusBadge` | pílula, ícone + texto (`solid` para usar sobre fotos) |
| `Card`, `SectionHeader`, `Divider`, `Skeleton`, `PetCardSkeleton` | |
| `Toast` (`useToast`) | provider no layout raiz, some em 6 s, nunca `alert()` |
| `BottomSheet` | `<dialog>` nativo: sobe do rodapé no celular, cartão central no desktop |
| `MelLogo`, `MelMark`, `NetworkIllustration` | símbolo provisório: pino + ponto (encontro, proteção) |

Ícones: **Lucide** apenas, traço 1,75–2.

## 6. Auditoria da interface (28/10/2026)

**Já resolvido nesta etapa:**
- Paleta marrom trocada pela paleta Coral/Ink em todas as telas, via tokens.
- Fonte Figtree trocada por Plus Jakarta Sans.
- Botões, campos, alertas, estados e selos redesenhados.
- Senha com ícone de olho em vez de checkbox (Field).
- `/entrar` refeito por completo.
- Fundo do diálogo de denúncia corrigido: `bg-black` não existia nos tokens, e o fundo não escurecia.

**Violações que continuam, por tela (refazer uma a uma, com aprovação):**

| Tela/componente | Violações |
|---|---|
| Cabeçalho (`AppHeader`) | emojis 🔔 💬 como ícones; falta navegação inferior (Início, Mapa, Publicar, Adoção, Perfil) e FAB "Publicar" com bottom sheet |
| Home (`HelpActions`) | sem hero "Olá. Como podemos ajudar?", grade 2×2 com ícones, carrossel de alertas, mini mapa, Guardiões |
| Alerta (`/alerta/[code]`) | CTA "EU VI ESTE PET" pesado (caixa alta extrabold) e sem posição fixa; emojis (👁 💬); falta overlay com selo e compartilhar sobre a foto |
| Compartilhar (`ShareAlert`) | emojis 💬 🔗 📷 🖨 🖼 como ícones; deveria ser bottom sheet |
| Linha do tempo, notificações | emojis 🟡 💬; marcadores improvisados |
| Mapa (`maplibre.ts`) | pinos com glifos (! ✓ 👁 ♥ ★) em vez de ícones; falta cartão inferior ao tocar |
| Wizard "Perdi meu pet", avistamento, chat, pet | `<textarea>` com estilo próprio e `border-2` (bordas grossas) em vez de `TextareaField`; chips de escolha com `border-2`; progresso do wizard simples |
| `PetCard`, `PetAvatar` | imagem pequena; falta o padrão "foto dominante + selo flutuante"; placeholders 🐶 🐱 🐾 |
| Denúncia (chat) | modal central; no celular deveria ser `BottomSheet` |
| Avisos flutuantes (`LiveSightings`) | solução própria; migrar para `useToast` |
| Recuperar/nova senha | herdam os novos campos, mas o layout ainda é o antigo |
| Cartazes (`lib/poster`) | herdam a paleta nova; revisar a composição com o DS |
