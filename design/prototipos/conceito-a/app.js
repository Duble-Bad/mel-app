// MEL — Conceito A: interações do protótipo (sem bibliotecas).
(() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Cabeçalho ganha borda ao rolar.
  const header = document.querySelector(".header");
  const onScroll = () => header.classList.toggle("scrolled", scrollY > 8);
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // Menu móvel.
  const btn = document.querySelector(".menu-btn");
  const menu = document.getElementById("menu-movel");
  const setMenu = (open) => {
    btn.setAttribute("aria-expanded", String(open));
    btn.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
    menu.classList.toggle("open", open);
  };
  btn.addEventListener("click", () => setMenu(btn.getAttribute("aria-expanded") !== "true"));
  menu.addEventListener("click", (e) => { if (e.target.closest("a")) setMenu(false); });
  addEventListener("keydown", (e) => { if (e.key === "Escape" && menu.classList.contains("open")) { setMenu(false); btn.focus(); } });

  // Revelação ao rolar.
  const reveals = document.querySelectorAll(".reveal");
  if (reduce || !("IntersectionObserver" in window)) {
    reveals.forEach((el) => el.classList.add("in"));
  } else {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
    reveals.forEach((el) => io.observe(el));
  }

  // Contadores.
  const fmt = new Intl.NumberFormat("pt-BR");
  const counters = document.querySelectorAll("[data-count]");
  const show = (el, n) => { el.textContent = (el.dataset.prefix ?? "") + fmt.format(n); };
  const run = (el) => {
    const target = Number(el.dataset.count);
    if (reduce) return show(el, target);
    const t0 = performance.now(), dur = 1600;
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      show(el, Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  if ("IntersectionObserver" in window) {
    const co = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { run(e.target); co.unobserve(e.target); }
    }, { threshold: 0.6 });
    counters.forEach((el) => co.observe(el));
  } else counters.forEach((el) => show(el, Number(el.dataset.count)));

  // Filtros do mural: "Todos" mostra os 4 primeiros; os demais filtram por tipo.
  const chips = document.querySelectorAll(".chip");
  const pets = [...document.querySelectorAll(".pet")];
  chips.forEach((chip) => chip.addEventListener("click", () => {
    chips.forEach((c) => c.setAttribute("aria-pressed", String(c === chip)));
    const f = chip.dataset.filter;
    pets.forEach((p, i) => {
      const visible = f === "todos" ? i < 4 : p.dataset.kind === f;
      p.classList.toggle("hidden", !visible);
      if (visible) p.classList.add("in");
    });
  }));
})();
