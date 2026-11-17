/**
 * Arquitetura do MEL: quem pode importar quem (Dependency Cruiser).
 * Camadas descobertas no projeto (2026-11-17), de baixo para cima:
 *
 *   packages/core       regras puras (validação, textos, cálculos); só depende de zod
 *   packages/ui-tokens  cores e tokens do tema
 *   packages/data       acesso ao Supabase; depende só do core
 *   apps/web/lib        infra do app (sessão, Supabase, imagens, cartaz, push)
 *   apps/web/components telas por assunto (lost, found, adoption…) e a base visual (ui)
 *   apps/web/app        rotas e páginas do Next
 *
 * Protótipos internos (components/dev e app/(app)/dev) podem usar tudo, mas nada de produção
 * pode depender deles. Rodar: `npm run deps:check` (também roda no `npm run check` e no CI).
 * Ver docs/02-arquitetura.md (Dependências entre camadas).
 */
const TEST = "\\.(unit\\.)?test\\.tsx?$";
const DEV = "^apps/web/(components/dev/|app/\\(app\\)/dev/)";

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "sem-ciclos",
      severity: "error",
      comment: "Dois módulos não podem depender um do outro, nem por um caminho mais longo (A → B → C → A). Import só de tipo não conta: some na compilação.",
      from: {},
      to: { circular: true, viaOnly: { dependencyTypesNot: ["type-only"] } },
    },
    {
      name: "core-puro",
      severity: "error",
      comment: "O core é a base: não conhece banco, telas, React nem Next. Só zod e o próprio core.",
      from: { path: "^packages/core/" },
      to: { path: "^(packages/(data|ui-tokens)/|apps/)|node_modules/(@supabase|react|react-dom|next|lucide-react|motion)/" },
    },
    {
      name: "core-sem-node",
      severity: "error",
      comment: "O core roda no navegador e no servidor: nada de módulos do Node (fs, path, crypto…). Os testes podem usar.",
      from: { path: "^packages/core/", pathNot: TEST },
      to: { dependencyTypes: ["core"] },
    },
    {
      name: "ui-tokens-isolado",
      severity: "error",
      comment: "Os tokens do tema não dependem de nenhuma outra parte do projeto.",
      from: { path: "^packages/ui-tokens/" },
      to: { path: "^(packages/(core|data)/|apps/)" },
    },
    {
      name: "data-nao-depende-do-app",
      severity: "error",
      comment: "O acesso ao banco não conhece o app (telas, rotas, infra do Next). Depende só do core.",
      from: { path: "^packages/data/", pathNot: TEST },
      to: { path: "^apps/" },
    },
    {
      name: "testes-do-data-so-com-a-cripto-do-app",
      severity: "error",
      comment: "Exceção documentada: os testes do data conferem a criptografia de dados pessoais, que fica em apps/web/lib/pii. Nada além disso.",
      from: { path: `^packages/data/.*${TEST}` },
      to: { path: "^apps/", pathNot: "^apps/web/lib/pii/" },
    },
    {
      name: "lib-nao-depende-de-telas",
      severity: "error",
      comment: "A infra do app (lib) é usada pelas telas e rotas, nunca o contrário.",
      from: { path: "^apps/web/lib/" },
      to: { path: "^apps/web/(components|app)/" },
    },
    {
      name: "telas-nao-dependem-de-rotas",
      severity: "error",
      comment:
        "Componentes não importam páginas ou rotas do Next (app/); a página é que monta os componentes. Exceção: folhas de estilo compartilhadas que moram em app/ (ex.: app/map.css, usada pelo mapa, mural e cartões).",
      from: { path: "^apps/web/components/" },
      to: { path: "^apps/web/app/", pathNot: "\\.css$" },
    },
    {
      name: "ui-base-sem-telas",
      severity: "error",
      comment: "A base visual (components/ui) serve todas as telas: não importa telas de assunto. Só ui e brand (o logo).",
      from: { path: "^apps/web/components/ui/" },
      to: { path: "^apps/web/components/", pathNot: "^apps/web/components/(ui|brand)/" },
    },
    {
      name: "producao-sem-prototipos",
      severity: "error",
      comment: "Protótipos internos (só com MEL_DEV_ROUTES=1) não podem entrar no app de produção.",
      from: { path: "^(apps|packages)/", pathNot: DEV },
      to: { path: DEV },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: { path: "(^|/)(\\.next|node_modules|public/vendor)/" },
    // Imports só de tipo também contam para as camadas (o core não pode nem conhecer o tipo do data).
    tsPreCompilationDeps: true,
    // O alias "@/…" do app; os pacotes @mel/* são resolvidos pelo workspace.
    tsConfig: { fileName: "apps/web/tsconfig.json" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default", "types"],
      extensions: [".ts", ".tsx", ".d.ts", ".js", ".mjs", ".cjs", ".json"],
    },
    reporterOptions: { text: { highlightFocused: true } },
  },
};
