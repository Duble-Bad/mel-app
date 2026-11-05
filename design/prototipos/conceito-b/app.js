// MEL — Conceito B (protótipo). Sem bibliotecas; dados fictícios.
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

const P = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
const ICONS = {
  paw: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><ellipse cx="5.5" cy="10" rx="2.2" ry="2.8"/><ellipse cx="9.5" cy="5.6" rx="2.2" ry="2.9"/><ellipse cx="14.5" cy="5.6" rx="2.2" ry="2.9"/><ellipse cx="18.5" cy="10" rx="2.2" ry="2.8"/><path d="M12 11.2c-3.3 0-6.4 4.3-6.4 6.9 0 1.9 1.4 2.9 3.2 2.9 1.4 0 2.1-.7 3.2-.7s1.8.7 3.2.7c1.8 0 3.2-1 3.2-2.9 0-2.6-3.1-6.9-6.4-6.9z"/></svg>',
  alert: `<svg viewBox="0 0 24 24" ${P} aria-hidden="true"><path d="M12 7v6"/><path d="M12 17h.01"/><circle cx="12" cy="12" r="0.5" opacity="0"/></svg>`,
  eye: `<svg viewBox="0 0 24 24" ${P} aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>`,
  eyeOff: `<svg viewBox="0 0 24 24" ${P} aria-hidden="true"><path d="M10.7 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-2.2 3.1M6.6 6.6A17 17 0 0 0 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/><path d="m2 2 20 20"/></svg>`,
  binoc: `<svg viewBox="0 0 24 24" ${P} aria-hidden="true"><circle cx="6.5" cy="15.5" r="3.5"/><circle cx="17.5" cy="15.5" r="3.5"/><path d="M10 15.5h4"/><path d="M3.5 13 6 5h2.5l1 6"/><path d="M20.5 13 18 5h-2.5l-1 6"/></svg>`,
  heart: `<svg viewBox="0 0 24 24" ${P} aria-hidden="true"><path d="M19 14c1.5-1.4 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.1 3 5.5l7 7z"/></svg>`,
  chevron: `<svg viewBox="0 0 24 24" ${P} stroke-width="2.6" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>`,
  arrow: `<svg viewBox="0 0 24 24" ${P} aria-hidden="true"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>`,
  back: `<svg viewBox="0 0 24 24" ${P} aria-hidden="true"><path d="M19 12H5"/><path d="m11 18-6-6 6-6"/></svg>`,
  pin: `<svg viewBox="0 0 24 24" ${P} aria-hidden="true"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
  clock: `<svg viewBox="0 0 24 24" ${P} aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`,
  userPlus: `<svg viewBox="0 0 24 24" ${P} aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/></svg>`,
  play: `<svg viewBox="0 0 24 24" ${P} aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m10 8 6 4-6 4z" fill="currentColor"/></svg>`,
  users: `<svg viewBox="0 0 24 24" ${P} aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/></svg>`,
  home: `<svg viewBox="0 0 24 24" ${P} aria-hidden="true"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>`,
  checkCircle: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="12" r="11"/><path d="m7 12.5 3.2 3L17 9" fill="none" stroke="#1c1404" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  check: `<svg viewBox="0 0 24 24" ${P} stroke-width="3.2" aria-hidden="true"><path d="M5 12.5 10 17 19 7"/></svg>`,
  plus: `<svg viewBox="0 0 24 24" ${P} aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>`,
  minus: `<svg viewBox="0 0 24 24" ${P} aria-hidden="true"><path d="M5 12h14"/></svg>`,
  locate: `<svg viewBox="0 0 24 24" ${P} aria-hidden="true"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.5" fill="currentColor"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>`,
  x: `<svg viewBox="0 0 24 24" ${P} aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>`,
  info: `<svg viewBox="0 0 24 24" ${P} aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>`,
  shield: `<svg viewBox="0 0 24 24" ${P} aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>`,
  chat: `<svg viewBox="0 0 24 24" ${P} aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
  store: `<svg viewBox="0 0 24 24" ${P} aria-hidden="true"><path d="M3 9 4.5 4h15L21 9"/><path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/><path d="M5 12v9h14v-9"/><path d="M10 21v-5h4v5"/></svg>`,
  handHeart: `<svg viewBox="0 0 24 24" ${P} aria-hidden="true"><path d="M11 14h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 16"/><path d="m7 20 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a2 2 0 0 0-2.8-2.9l-4.2 3.9"/><path d="m2 15 6 6"/><path d="M19.5 8.5c.7-.7 1.5-1.6 1.5-2.7A2.7 2.7 0 0 0 16 4a2.7 2.7 0 0 0-5 1.8c0 1.2.8 2 1.5 2.8L16 12z"/></svg>`,
  person: `<svg viewBox="0 0 24 24" ${P} aria-hidden="true"><circle cx="12" cy="7" r="4"/><path d="M5.5 21a6.5 6.5 0 0 1 13 0"/><path d="M17 3.5c.9-.9 2.6-.6 2.6.9 0 1-.8 1.6-1.6 2.3"/></svg>`,
  search: `<svg viewBox="0 0 24 24" ${P} aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>`,
  bell: `<svg viewBox="0 0 24 24" ${P} aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/></svg>`,
  megaphone: `<svg viewBox="0 0 24 24" ${P} aria-hidden="true"><path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>`,
  sparkle: `<svg viewBox="0 0 24 24" ${P} aria-hidden="true"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/></svg>`,
  lock: `<svg viewBox="0 0 24 24" ${P} aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>`,
  google: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"/><path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.77.43 3.45 1.18 4.94l3.66-2.84Z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"/></svg>',
};
const icon = (n) => ICONS[n] ?? "";
function hydrateIcons(root = document) {
  root.querySelectorAll("i[data-icon]").forEach((el) => {
    el.outerHTML = icon(el.dataset.icon);
  });
}

/* ---------- Dados fictícios ---------- */
const F = "../assets/fotos/";
const KIND = {
  lost: { label: "Perdido", cls: "lost" },
  found: { label: "Encontrado", cls: "found" },
  seen: { label: "Visto", cls: "seen" },
  adopt: { label: "Adoção", cls: "adopt" },
};
const PETS = [
  { id: 1, name: "Thor", kind: "lost", img: "golden-flor.jpg", alt: "Golden retriever sentado segurando uma flor na boca", place: "Vila Mariana – SP", when: "há 2 dias", hours: 50, species: "Cão", sex: "Macho", size: "Grande", color: "Dourado", x: 38, y: 40, note: "Usa coleira azul. Muito dócil, atende pelo nome." },
  { id: 2, name: "Nina", kind: "found", img: "gato-tigrado-escada.jpg", alt: "Gata tigrada sentada numa escada clara", place: "Pinheiros – SP", when: "há 1 dia", hours: 26, species: "Gato", sex: "Fêmea", size: "Pequeno", color: "Tigrada", x: 22, y: 30, note: "Encontrada assustada perto de uma praça. Está segura com quem achou." },
  { id: 3, name: "Bidu", kind: "adopt", img: "pastor-australiano.jpg", alt: "Cão pastor australiano sorrindo na praia", place: "Saúde – SP", when: "2 anos", hours: 300, species: "Cão", sex: "Macho", size: "Médio", color: "Tricolor", x: 62, y: 66, note: "Castrado, vacinado e muito brincalhão. Se dá bem com crianças." },
  { id: 4, name: "Luna", kind: "seen", img: "beagle-sorrindo.jpg", alt: "Beagle sorrindo ao ar livre", place: "Mooca – SP", when: "há 2 horas", hours: 2, species: "Cão", sex: "Fêmea", size: "Médio", color: "Tricolor", x: 74, y: 34, note: "Vista andando sozinha perto de um mercado, sem coleira." },
  { id: 5, name: "Mimi", kind: "found", img: "gato-frajola.jpg", alt: "Gato frajola preto e branco apoiado num muro", place: "Liberdade – SP", when: "há 1 dia", hours: 30, species: "Gato", sex: "Fêmea", size: "Pequeno", color: "Preto e branco", x: 52, y: 52, note: "Muito mansa, parece acostumada com casa." },
  { id: 6, name: "Rex", kind: "lost", img: "cao-chocolate.jpg", alt: "Cão marrom chocolate lambendo o focinho", place: "Sé – SP", when: "há 3 dias", hours: 75, species: "Cão", sex: "Macho", size: "Grande", color: "Chocolate", x: 46, y: 24, note: "Fugiu durante a queima de fogos. Tem medo de barulho." },
  { id: 7, name: "Pipoca", kind: "adopt", img: "gatinho-pata.jpg", alt: "Gatinho filhote levantando a pata", place: "Tatuapé – SP", when: "3 meses", hours: 300, species: "Gato", sex: "Fêmea", size: "Pequeno", color: "Rajada", x: 84, y: 58, note: "Filhote resgatada, já vermifugada. Adoção com termo e acompanhamento." },
  { id: 8, name: "Fred", kind: "seen", img: "cao-tricolor.jpg", alt: "Cão tricolor de orelhas dobradas olhando para a câmera", place: "Ipiranga – SP", when: "há 5 horas", hours: 5, species: "Cão", sex: "Macho", size: "Pequeno", color: "Tricolor", x: 66, y: 80, note: "Visto atravessando a avenida em direção ao parque." },
  { id: 9, name: "Amora", kind: "adopt", img: "corgi-filhote.jpg", alt: "Filhote de corgi sentado em fundo laranja", place: "Butantã – SP", when: "4 meses", hours: 300, species: "Cão", sex: "Fêmea", size: "Pequeno", color: "Caramelo", x: 14, y: 62, note: "Esperta e carinhosa. Vai crescer até porte médio." },
  { id: 10, name: "Tigrão", kind: "lost", img: "gato-laranja.jpg", alt: "Gato laranja deitado sobre uma mesa de madeira", place: "Perdizes – SP", when: "há 6 dias", hours: 150, species: "Gato", sex: "Macho", size: "Médio", color: "Laranja", x: 28, y: 18, note: "Castrado, tem uma manchinha branca no peito." },
  { id: 11, name: "Sem nome", kind: "found", img: "cao-vira-lata-rua.jpg", alt: "Cão branco com manchas pretas sorrindo numa calçada", place: "Consolação – SP", when: "há 9 horas", hours: 9, species: "Cão", sex: "Macho", size: "Médio", color: "Branco e preto", x: 40, y: 58, note: "Encontrado sem coleira. Está em lar temporário." },
  { id: 12, name: "Theo", kind: "adopt", img: "pug-amarelo.jpg", alt: "Pug preto de blusa de tricô em fundo amarelo", place: "Lapa – SP", when: "1 ano", hours: 300, species: "Cão", sex: "Macho", size: "Pequeno", color: "Preto", x: 10, y: 40, note: "Calmo, ideal para apartamento. Precisa de cuidado com calor." },
];

function petCard(p, { action } = {}) {
  const k = KIND[p.kind];
  const sex = p.sex === "Fêmea" ? '<span aria-label="fêmea" style="color:#f472b6">♀</span>' : '<span aria-label="macho" style="color:#60a5fa">♂</span>';
  const second = p.kind === "adopt" ? `${p.when} · Porte ${p.size.toLowerCase()}` : p.when;
  return `<article class="pet" data-kind="${p.kind}">
    <div class="pet__media"><img src="${F}${p.img}" alt="${p.alt}" loading="lazy" decoding="async" width="600" height="500"><span class="badge badge--${k.cls}">${k.label}</span>
      <button class="fav" type="button" aria-pressed="false" aria-label="Acompanhar ${p.name}">${icon("heart")}</button></div>
    <div class="pet__body"><h3>${p.name} ${p.kind === "adopt" ? sex : ""}</h3>
      <p class="meta">${icon("pin")} ${p.place}</p><p class="meta">${icon("clock")} ${second}</p>
      ${action ? `<button class="btn btn--gold btn--sm btn--block" type="button" data-open="${p.id}">${action}</button>` : `<a class="pet__link" href="#" data-open="${p.id}"><span class="sr-only">Ver detalhes de ${p.name}</span></a>`}
    </div></article>`;
}

/* ---------- Shell: cabeçalho, menu, rodapé ---------- */
function shell() {
  const page = document.body.dataset.page;
  const links = [
    ["index", "index.html", "Início"],
    ["mapa", "mapa.html", "Mapa da Rede"],
    ["mural", "mural.html", "Mural"],
    ["adocao", "adocao.html", "Adoção"],
    ["parceiros", "parceiros.html", "Parceiros"],
  ];
  const nav = links.map(([k, h, t]) => `<a href="${h}"${k === page ? ' aria-current="page"' : ""}>${t}</a>`).join("");
  const header = document.createElement("header");
  header.className = "header";
  header.innerHTML = `<a class="skip" href="#conteudo">Pular para o conteúdo</a>
    <div class="container header__in">
      <a class="logo" href="index.html" aria-label="MEL — página inicial"><img src="../assets/marca/mel-beacon-honey.svg" alt="" width="38" height="38">MEL</a>
      <nav class="nav" aria-label="Principal">${nav}</nav>
      <div class="header__actions"><a class="btn btn--ghost btn--sm" href="entrar.html">Entrar</a><a class="btn btn--gold btn--sm" href="entrar.html#criar">Criar conta</a></div>
      <button class="menu-btn" type="button" aria-expanded="false" aria-controls="menu-movel" aria-label="Abrir menu"><span></span></button>
    </div>
    <nav class="mobile-nav" id="menu-movel" aria-label="Menu">${nav}<div class="row"><a class="btn btn--ghost" href="entrar.html">Entrar</a><a class="btn btn--gold" href="entrar.html#criar">Criar conta</a></div></nav>`;
  document.body.prepend(header);
  const btn = header.querySelector(".menu-btn");
  const menu = header.querySelector(".mobile-nav");
  const setOpen = (o) => {
    btn.setAttribute("aria-expanded", String(o));
    btn.setAttribute("aria-label", o ? "Fechar menu" : "Abrir menu");
    menu.classList.toggle("open", o);
  };
  btn.addEventListener("click", () => setOpen(btn.getAttribute("aria-expanded") !== "true"));
  document.addEventListener("keydown", (e) => e.key === "Escape" && setOpen(false));

  if (!document.body.hasAttribute("data-no-footer")) {
    const footer = document.createElement("footer");
    footer.className = "footer";
    footer.innerHTML = `<div class="container"><div class="footer__in">
      <div><a class="logo" href="index.html"><img src="../assets/marca/mel-beacon-honey.svg" alt="" width="34" height="34">MEL</a>
        <p style="margin-top:12px;max-width:34ch">Rede comunitária e gratuita de apoio a animais perdidos, encontrados e disponíveis para adoção.</p></div>
      <div><h4>Ajudar agora</h4><ul><li><a href="#">Perdi meu pet</a></li><li><a href="#">Encontrei um pet</a></li><li><a href="#">Vi um pet</a></li><li><a href="adocao.html">Quero adotar</a></li></ul></div>
      <div><h4>A rede</h4><ul><li><a href="mapa.html">Mapa da Rede</a></li><li><a href="mural.html">Mural</a></li><li><a href="parceiros.html">Parceiros</a></li><li><a href="#">Nossa origem</a></li></ul></div>
      <div><h4>Confiança</h4><ul><li><a href="#">Privacidade</a></li><li><a href="#">Termos de uso</a></li><li><a href="#">Como protegemos seus dados</a></li></ul></div>
    </div><div class="footer__bottom"><span>© MEL — feita por voluntários. Sem anúncios, sem venda.</span><span>Protótipo com dados fictícios</span></div></div>`;
    document.body.append(footer);
  }

  const pill = document.createElement("a");
  pill.className = "proto";
  pill.href = "../index.html";
  pill.innerHTML = "<i></i> Protótipo — Conceito B (recomendado)";
  document.body.append(pill);
}

/* ---------- Animações ---------- */
function reveals() {
  const els = document.querySelectorAll(".reveal");
  if (reduce || !("IntersectionObserver" in window)) return els.forEach((e) => e.classList.add("in"));
  const io = new IntersectionObserver(
    (entries) => entries.forEach((en) => en.isIntersecting && (en.target.classList.add("in"), io.unobserve(en.target))),
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
  );
  els.forEach((e) => io.observe(e));
}

function countUp() {
  const els = document.querySelectorAll("[data-count]");
  const fmt = (n) => n.toLocaleString("pt-BR");
  const run = (el) => {
    const to = Number(el.dataset.count);
    const pre = el.dataset.prefix ?? "";
    if (reduce) return (el.textContent = pre + fmt(to));
    const t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / 1600);
      el.textContent = pre + fmt(Math.round(to * (1 - Math.pow(1 - k, 4))));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  if (!("IntersectionObserver" in window)) return els.forEach(run);
  const io = new IntersectionObserver((en) => en.forEach((e) => e.isIntersecting && (run(e.target), io.unobserve(e.target))), { threshold: 0.5 });
  els.forEach((e) => io.observe(e));
}

function spotlight() {
  document.querySelectorAll(".action").forEach((a) =>
    a.addEventListener("pointermove", (e) => {
      const r = a.getBoundingClientRect();
      a.style.setProperty("--mx", `${e.clientX - r.left}px`);
      a.style.setProperty("--my", `${e.clientY - r.top}px`);
    }),
  );
}

function favs(root = document) {
  root.addEventListener("click", (e) => {
    const b = e.target.closest(".fav");
    if (!b) return;
    b.setAttribute("aria-pressed", String(b.getAttribute("aria-pressed") !== "true"));
  });
}

/* Filtros em grupo de chips (um selecionado) */
function chipGroup(el, onChange) {
  el.addEventListener("click", (e) => {
    const c = e.target.closest(".chip");
    if (!c) return;
    el.querySelectorAll(".chip").forEach((x) => x.setAttribute("aria-pressed", String(x === c)));
    onChange(c.dataset.value);
  });
}

/* Troca de conteúdo na mesma página: a re-animação fica no CSS (.list-anim, .panel-tab).
   View Transitions ficam só para a navegação entre páginas (@view-transition no CSS). */
function swap(fn) {
  fn();
}

/* ---------- Gaveta de detalhes ---------- */
function drawer() {
  const d = document.createElement("div");
  d.className = "drawer";
  d.innerHTML = `<div class="drawer__scrim" data-close></div><div class="drawer__panel" role="dialog" aria-modal="true" aria-labelledby="dw-title" tabindex="-1"></div>`;
  document.body.append(d);
  const panel = d.querySelector(".drawer__panel");
  let last = null;
  const close = () => {
    d.classList.remove("open");
    document.body.style.overflow = "";
    last?.focus();
  };
  d.addEventListener("click", (e) => e.target.closest("[data-close]") && close());
  document.addEventListener("keydown", (e) => e.key === "Escape" && d.classList.contains("open") && close());
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-open]");
    if (!t) return;
    e.preventDefault();
    const p = PETS.find((x) => x.id === Number(t.dataset.open));
    if (!p) return;
    last = t;
    const k = KIND[p.kind];
    const cta =
      p.kind === "adopt"
        ? `<a class="btn btn--gold btn--block" href="adocao.html#quero">${icon("heart")} Tenho interesse em adotar</a>`
        : p.kind === "lost"
          ? `<button class="btn btn--gold btn--block" type="button">${icon("eye")} Eu vi este pet</button><button class="btn btn--ghost btn--block" type="button">${icon("chat")} Falar com o tutor pela MEL</button>`
          : `<button class="btn btn--gold btn--block" type="button">${icon("chat")} Conversar pela MEL</button>`;
    panel.innerHTML = `<button class="drawer__close" type="button" data-close aria-label="Fechar">${icon("x")}</button>
      <div class="drawer__media"><img src="${F}${p.img}" alt="${p.alt}"></div>
      <div class="drawer__body"><span class="badge badge--${k.cls}" style="width:fit-content">${k.label}</span>
        <h2 id="dw-title" style="font-size:30px">${p.name}</h2>
        <p class="meta">${icon("pin")} ${p.place} · área aproximada</p>
        <div class="facts"><div class="fact"><span>Espécie</span><strong>${p.species}</strong></div><div class="fact"><span>Sexo</span><strong>${p.sex}</strong></div>
          <div class="fact"><span>Porte</span><strong>${p.size}</strong></div><div class="fact"><span>Cor</span><strong>${p.color}</strong></div></div>
        <p style="color:#d6dbe3">${p.note}</p>
        ${cta}
        <div class="alert alert--info">${icon("shield")}<span>Por segurança, telefone e endereço nunca aparecem aqui. O contato acontece pelo chat da MEL e o local é mostrado só como área aproximada (~250 m).</span></div>
      </div>`;
    d.classList.add("open");
    document.body.style.overflow = "hidden";
    panel.scrollTop = 0;
    panel.focus();
  });
}

/* ---------- Mapa SVG (áreas aproximadas) ---------- */
function mapSVG(items) {
  const roads = `<g class="map__roads">
    <path class="map__road map__road--main" stroke-width="9" d="M-20 140 C 200 120, 380 210, 620 170 S 900 120, 1020 160"/>
    <path class="map__road map__road--main" stroke-width="9" d="M300 -20 C 320 200, 260 380, 330 620 S 360 760, 340 820"/>
    <path class="map__road" stroke-width="5" d="M-20 420 C 240 400, 520 470, 1020 420"/>
    <path class="map__road" stroke-width="5" d="M640 -20 C 600 200, 700 420, 660 820"/>
    <path class="map__road" stroke-width="4" d="M-20 300 L 1020 330 M -20 560 L 1020 590 M 140 -20 L 180 820 M 820 -20 L 860 820 M 460 -20 L 500 820"/>
    <path class="map__road" stroke-width="2.5" d="M-20 80 L1020 60 M-20 220 L1020 250 M-20 500 L1020 520 M-20 680 L1020 700 M60 -20 L 80 820 M230 -20 L 250 820 M390 -20 L 400 820 M560 -20 L 580 820 M740 -20 L 760 820 M920 -20 L 940 820"/>
  </g>`;
  const park = `<path class="map__park" d="M700 460 q 90 -30 160 20 q 30 80 -40 120 q -100 10 -130 -50 z"/><path class="map__park" d="M90 600 q 70 -20 120 10 q 10 60 -60 80 q -80 -10 -60 -90z"/><path class="map__water" d="M820 -20 q 60 120 200 160 v -180z"/>`;
  const areas = items
    .map((p) => {
      const cx = p.x * 10, cy = p.y * 8;
      return `<g class="area area--${p.kind}" data-id="${p.id}" tabindex="0" role="button" aria-label="${p.name}, ${KIND[p.kind].label.toLowerCase()}, ${p.place} (área aproximada)">
        <circle class="zone" cx="${cx}" cy="${cy}" r="46"/><circle class="pulse" cx="${cx}" cy="${cy}" r="46"/><circle class="core" cx="${cx}" cy="${cy}" r="9"/></g>`;
    })
    .join("");
  return `<svg class="map__svg" viewBox="0 0 1000 800" preserveAspectRatio="xMidYMid slice" aria-hidden="false" role="group" aria-label="Mapa ilustrativo com áreas aproximadas"><g class="map__inner">${park}${roads}${areas}
    <g class="map__you"><circle cx="500" cy="400" r="7"/><circle cx="500" cy="400" r="16" fill="none" stroke="#f6b928" stroke-width="2" opacity=".5"/></g></g></svg>`;
}

document.addEventListener("DOMContentLoaded", () => {
  shell();
  hydrateIcons();
  reveals();
  countUp();
  spotlight();
  favs();
  drawer();
  window.MEL?.init?.();
});

window.MELB = { PETS, KIND, petCard, icon, hydrateIcons, chipGroup, swap, mapSVG, reduce };
