// MEL · Conceito C — interações do protótipo (dados fictícios, sem rede)
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");

  /* Toast */
  const toast = $("#toast");
  let toastTimer;
  function say(msg) {
    toast.textContent = msg;
    toast.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("is-on"), 2800);
  }

  /* Brilho de toque nos cartões de ação */
  $$(".action").forEach((b) => {
    b.addEventListener("pointerdown", (e) => {
      const r = b.getBoundingClientRect();
      b.style.setProperty("--px", `${e.clientX - r.left}px`);
      b.style.setProperty("--py", `${e.clientY - r.top}px`);
      b.classList.add("is-pressed");
    });
    ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => b.addEventListener(ev, () => b.classList.remove("is-pressed")));
  });

  /* Folha de ações */
  const sheet = $("#sheet");
  let lastFocus = null;
  function openSheet() {
    lastFocus = document.activeElement;
    sheet.hidden = false;
    sheet.classList.remove("is-closing");
    document.body.style.overflow = "hidden";
    $(".sheet__item", sheet).focus();
  }
  function closeSheet(then) {
    if (sheet.hidden) return then?.();
    const done = () => {
      sheet.hidden = true;
      sheet.classList.remove("is-closing");
      document.body.style.overflow = "";
      if (then) then();
      else lastFocus?.focus();
    };
    if (reduce.matches) return done();
    sheet.classList.add("is-closing");
    setTimeout(done, 240);
  }
  $$("[data-open-sheet]").forEach((b) => b.addEventListener("click", openSheet));
  $$("[data-close-sheet]").forEach((b) => b.addEventListener("click", () => closeSheet()));
  document.addEventListener("keydown", (e) => {
    if (sheet.hidden) return;
    if (e.key === "Escape") closeSheet();
    if (e.key === "Tab") {
      const f = $$("button", sheet);
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  /* Fluxos: cada ação abre a prévia do passo a passo */
  const FLOWS = {
    lost: { label: "Perdi meu pet", color: "var(--lost)" },
    found: { label: "Encontrei um pet", color: "var(--found)" },
    seen: { label: "Vi um pet", color: "#d48a12" },
    adopt: { label: "Quero adotar", color: "var(--adopt)" },
  };
  let flow = "lost";
  function startFlow(key) {
    if (key === "adopt") {
      say("Protótipo: abriria a Adoção (animais disponíveis + fila de interessados).");
      return;
    }
    flow = key;
    step = 0;
    render(false);
    $("#passos").scrollIntoView({ behavior: reduce.matches ? "auto" : "smooth", block: "start" });
    say(`${FLOWS[key].label}: passo 1 de 3 (prévia)`);
  }
  $$("[data-flow]").forEach((b) => b.addEventListener("click", () => {
    const key = b.dataset.flow;
    if (b.closest("#sheet")) closeSheet(() => startFlow(key));
    else startFlow(key);
  }));

  /* Filtro dos alertas */
  $$(".chip").forEach((c) => c.addEventListener("click", () => {
    $$(".chip").forEach((x) => x.setAttribute("aria-pressed", String(x === c)));
    const f = c.dataset.filter;
    $$("#alerts .alert").forEach((a) => a.classList.toggle("is-hidden", f !== "all" && a.dataset.kind !== f));
  }));
  $$("[data-seen]").forEach((b) => b.addEventListener("click", () => say(`Obrigado! Abriria o aviso rápido sobre ${b.dataset.seen} (sem precisar de conta).`)));
  $(".place").addEventListener("click", () => say("Protótipo: escolher bairro ou usar a localização atual."));

  /* Passo a passo */
  const panel = $("#step-panel");
  const next = $("#step-next");
  const back = $("#step-back");
  const tabs = $$(".stepnav [role=tab]");
  let step = 0;

  const views = {
    0: () => `
      <div>
        <p class="p-title">${flow === "lost" ? "Mostre o Thor para a vizinhança" : flow === "found" ? "Foto do pet que você encontrou" : "Tem uma foto? Ajuda muito"}</p>
        <p class="p-sub">Uma foto nítida do rosto basta. Você pode pular.</p>
        <div class="p-photo">
          <img src="../assets/fotos/${flow === "found" ? "gato-frajola" : flow === "seen" ? "cao-vira-lata-rua" : "beagle-sorrindo"}.jpg" alt="Foto escolhida" width="200" height="200">
          <div class="p-add"><svg aria-hidden="true"><use href="#i-camera"/></svg>Adicionar</div>
        </div>
        <div class="p-field"><label>${flow === "lost" ? "Nome do pet" : "Espécie"}</label><div class="p-input">${flow === "lost" ? "Thor" : flow === "found" ? "Gato" : "Cachorro"}</div></div>
      </div>`,
    1: () => `
      <div>
        <p class="p-title">${flow === "seen" ? "Onde e quando você viu?" : flow === "found" ? "Onde você encontrou?" : "Onde e quando sumiu?"}</p>
        <p class="p-sub">No mapa público aparece só a região aproximada.</p>
        <div class="p-field"><label>Local</label><div class="p-input"><svg aria-hidden="true"><use href="#i-pin"/></svg>R. Domingos de Morais, Vila Mariana</div></div>
        <div class="p-mapmini" aria-hidden="true"></div>
        <div class="p-field"><label>Quando</label>
          <div class="p-seg"><span class="on">Agora</span><span>Hoje</span><span>Outro dia</span></div>
        </div>
      </div>`,
    2: () => `
      <div>
        <p class="p-title">Como a rede fala com você?</p>
        <p class="p-sub">Mensagens chegam pela MEL. O telefone fica oculto.</p>
        <div class="p-field"><label>Seu nome</label><div class="p-input">Ana</div></div>
        <div class="p-field"><label>Mostrar WhatsApp no cartaz?</label><div class="p-seg" style="grid-template-columns:1fr 1fr"><span>Sim</span><span class="on">Não, só chat</span></div></div>
        <p class="p-note"><svg aria-hidden="true"><use href="#i-shield"/></svg>Golpe comum: ninguém da MEL pede pagamento ou código por mensagem.</p>
      </div>`,
    3: () => `
      <div class="p-done">
        <div class="p-done__badge"><svg aria-hidden="true"><use href="#i-check"/></svg></div>
        <p class="p-title">${flow === "seen" ? "Avistamento enviado!" : "Alerta publicado!"}</p>
        <p class="p-sub">${flow === "seen" ? "O tutor foi avisado agora." : "Avisamos 1.284 pessoas num raio de 3 km."}</p>
        <ul>
          <li><svg aria-hidden="true"><use href="#i-check"/></svg>Cartaz com QR pronto para imprimir</li>
          <li><svg aria-hidden="true"><use href="#i-share"/></svg>Link para WhatsApp e redes</li>
          <li><svg aria-hidden="true"><use href="#i-check"/></svg>Você recebe cada avistamento</li>
        </ul>
      </div>`,
  };

  function render(backwards) {
    const f = FLOWS[flow];
    $("#flow-label").textContent = f.label;
    $(".phone").style.setProperty("--flow", f.color);
    panel.classList.toggle("back", !!backwards);
    panel.innerHTML = views[step]();
    const done = step === 3;
    $("#step-count").textContent = done ? "Pronto" : `Passo ${step + 1} de 3`;
    $("#progress").style.width = `${done ? 100 : ((step + 1) / 3) * 100}%`;
    back.disabled = step === 0;
    next.innerHTML = done
      ? "Recomeçar"
      : step === 2
        ? (flow === "seen" ? "Enviar avistamento" : "Publicar alerta")
        : 'Próximo <svg aria-hidden="true"><use href="#i-arrow"/></svg>';
    tabs.forEach((t, i) => {
      t.setAttribute("aria-selected", String(i === Math.min(step, 2) && !done));
      t.classList.toggle("is-done", i < step);
    });
  }
  next.addEventListener("click", () => { step = step === 3 ? 0 : step + 1; render(false); });
  back.addEventListener("click", () => { if (step > 0) { step -= 1; render(true); } });
  tabs.forEach((t) => t.addEventListener("click", () => {
    const s = Number(t.dataset.step);
    const backwards = s < step;
    step = s;
    render(backwards);
  }));
  render(false);
})();
