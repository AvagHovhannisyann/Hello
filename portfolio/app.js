/* ISD «Պորտֆոլիո» — CV, case logbook and CARE-structured case cards, exported to PowerPoint or PDF. */
{
  const { db, esc, $, $$, icon, toast } = ISD;
  const P = ISDPhoto;
  const app = $("#app");
  $("#mark").innerHTML = ISD.mark(false);
  $$(".nav .ic").forEach(s => s.outerHTML = icon(s.dataset.i));
  ISD.registerSW();
  ISD.persist();

  const DISC = ["Թերապևտիկ ստոմատոլոգիա", "Էնդոդոնտիա", "Պերիօդոնտոլոգիա", "Վիրաբուժություն", "Իմպլանտոլոգիա", "Օրթոպեդիկ ստոմատոլոգիա", "Օրթոդոնտիա", "Մանկական ստոմատոլոգիա", "Էսթետիկ ստոմատոլոգիա", "Հիգիենա և կանխարգելում", "Համալիր վերականգնում"];
  const ROLES = { operator: "Կատարող", assistant: "Օգնական", observer: "Դիտորդ" };
  const STATUS = { active: "Ընթացքում", done: "Ավարտված", fu: "Հետևման փուլ" };
  const now = () => Date.now();

  function normalize(c) {
    return Object.assign({
      code: "", title: "", subtitle: "", date: ISD.today(), discipline: "", role: "operator", status: "active", keywords: "", intro: "",
      age: "", sex: "", complaint: "", medical: "", dental: "", habits: "",
      findingsExtra: "", findingsIntra: "", radioFindings: "", xrays: [],
      diagnosis: "", problems: "", options: [], choiceWhy: "", plan: [], steps: [],
      outcome: "", followup: [], discussion: "", differently: "", literature: "", conclusions: "", references: "",
      consent: { doc: false, edu: false, pub: false, social: false, date: "" }, seriesIds: [], compareView: "frontal",
      created: now(), updated: now()
    }, c || {});
  }
  const has = v => Array.isArray(v) ? v.length > 0 : !!(v && String(v).trim());
  /* CARE completeness: 12 checks */
  function care(c) {
    const consentAny = c.consent && (c.consent.doc || c.consent.edu || c.consent.pub);
    return [
      ["Վերնագիր", has(c.title)], ["Բողոք", has(c.complaint)], ["Անամնեզ", has(c.medical) || has(c.dental)],
      ["Հետազոտություն", has(c.findingsIntra) || has(c.findingsExtra) || has(c.seriesIds)], ["Լուսանկարներ", has(c.seriesIds)],
      ["Ախտորոշում", has(c.diagnosis)], ["Պլան", has(c.plan) || has(c.options)], ["Փուլեր", has(c.steps)],
      ["Արդյունք", has(c.outcome)], ["Հետևում", has(c.followup)], ["Քննարկում", has(c.discussion) || has(c.conclusions)], ["Համաձայնություն", !!consentAny]
    ];
  }
  const pct = c => { const k = care(c); return Math.round(k.filter(x => x[1]).length / k.length * 100); };
  function ring(p) {
    const r = 23, L = 2 * Math.PI * r;
    return '<svg class="ring" viewBox="0 0 56 56" aria-label="Ամբողջականություն ' + p + '%"><circle cx="28" cy="28" r="' + r + '" fill="none" stroke="var(--line)" stroke-width="5"/><circle cx="28" cy="28" r="' + r + '" fill="none" stroke="' + (p >= 80 ? "var(--ok)" : p >= 40 ? "var(--ink)" : "var(--accent)") + '" stroke-width="5" stroke-linecap="round" stroke-dasharray="' + (L * p / 100).toFixed(1) + " " + L.toFixed(1) + '" transform="rotate(-90 28 28)"/><text x="28" y="33" text-anchor="middle">' + p + "</text></svg>";
  }

  /* ---------- routing ---------- */
  let tab = "cases", filter = "", disc = "";
  async function route() {
    const h = location.hash.slice(1) || "cases";
    if (h.startsWith("case-")) {
      const c = await db.get("cases", h.slice(5));
      if (c) { setNav("cases"); return caseEditor(normalize(c)); }
    }
    tab = ["cases", "log", "cv", "more"].includes(h) ? h : "cases";
    setNav(tab);
    ({ cases: casesView, log: logView, cv: cvView, more: moreView })[tab]();
  }
  function setNav(t) { $$(".nav button").forEach(b => b.setAttribute("aria-current", b.dataset.tab === t ? "true" : "false")); }
  $$(".nav button").forEach(b => b.onclick = () => { location.hash = b.dataset.tab; });
  addEventListener("hashchange", route);
  scrollTo(0, 0);

  /* ---------- cases list ---------- */
  async function casesView() {
    const all = (await db.all("cases")).map(normalize).sort((a, b) => (b.date || "").localeCompare(a.date || "") || b.updated - a.updated);
    const year = new Date().getFullYear() + "";
    const done = all.filter(c => pct(c) >= 80).length;
    const prof = await db.meta("profile", {});
    app.innerHTML =
      '<section class="lead"><div><h1>' + (prof && prof.name ? "Բարև, " + esc(prof.name.split(" ")[0]) : "Ձեր կլինիկական պատմությունը") + "</h1><p>Յուրաքանչյուր դեպք՝ CARE կառուցվածքով և լուսանկարներով։ Մեկ կոճակով արտահանեք՝ PowerPoint կամ PDF։ Դեպքերից ինքնաշխատ կազմվում են գրանցամատյանն ու CV-ի թվերը։</p></div>" +
      '<div class="kpis"><div class="kpi"><b>' + all.length + '</b><span>դեպք</span></div><div class="kpi"><b>' + all.filter(c => (c.date || "").startsWith(year)).length + "</b><span>" + year + '-ին</span></div><div class="kpi"><b>' + done + "</b><span>պատրաստ ներկայացման</span></div></div></section>" +
      '<div class="toolbar"><input type="text" id="q" placeholder="Որոնել՝ կոդ, վերնագիր, ախտորոշում" value="' + esc(filter) + '"><button class="btn primary" id="new">' + icon("plus") + "Նոր դեպք</button></div>" +
      '<div class="filters"><button class="chip" data-d="" aria-pressed="' + (!disc) + '">Բոլորը</button>' + DISC.filter(d => all.some(c => c.discipline === d)).map(d => '<button class="chip" data-d="' + esc(d) + '" aria-pressed="' + (disc === d) + '">' + esc(d) + "</button>").join("") + "</div>" +
      '<div id="list"></div>';
    const draw = () => {
      const q = filter.toLowerCase();
      const list = all.filter(c => (!disc || c.discipline === disc) && (!q || [c.code, c.title, c.diagnosis, c.keywords].join(" ").toLowerCase().includes(q)));
      $("#list").innerHTML = list.length ? '<div class="cases">' + list.map(c => '<button class="case" data-id="' + esc(c.id) + '">' + ring(pct(c)) + "<span><b>" + esc(c.title || "Անվերնագիր դեպք") + '</b><span class="muted">' + esc([c.code, c.discipline, ISD.fmtShort(c.date)].filter(Boolean).join(" · ")) + "</span></span></button>").join("") + "</div>"
        : '<div class="empty card">' + (all.length ? "Ոչինչ չի գտնվել" : "Դեռ դեպք չկա։ Սկսեք «Նոր դեպք» կոճակով կամ «Ֆոտո» հավելվածից կցեք լուսանկարների շարքը։") + "</div>";
      $$(".case").forEach(b => b.onclick = () => location.hash = "case-" + b.dataset.id);
    };
    draw();
    $("#q").oninput = e => { filter = e.target.value; draw(); };
    $$("[data-d]").forEach(b => b.onclick = () => { disc = b.dataset.d; casesView(); });
    $("#new").onclick = async () => { const c = normalize({ id: ISD.uid() }); await db.put("cases", c); location.hash = "case-" + c.id; };
    setTimeout(() => ISDSurvey.maybeAsk("portfolio"), 1200);
    pingStats(all);
  }
  async function pingStats(all) {
    const by = {}; all.forEach(c => { if (c.discipline) by[c.discipline] = (by[c.discipline] || 0) + 1; });
    const ser = await db.all("series");
    const prof = await db.meta("profile", {});
    ISDSurvey.ping("portfolio", { cases: all.length, casesReady: all.filter(c => pct(c) >= 80).length, casesWithPhotos: all.filter(c => has(c.seriesIds)).length, series: ser.length, disciplines: JSON.stringify(by), cvFilled: !!(prof && prof.name) });
  }

  /* ---------- case editor ---------- */
  let C = null;
  const saveCase = ISD.debounce(async () => { if (!C) return; C.updated = now(); await db.put("cases", C); updateCare(); }, 400);
  function updateCare() {
    const k = care(C), bar = $("#care");
    if (bar) bar.innerHTML = k.map(x => '<i class="' + (x[1] ? "on" : "") + '" title="' + esc(x[0]) + '"></i>').join("");
    const p = $("#pct"); if (p) p.textContent = pct(C) + "% պատրաստ";
    $$("details.sec").forEach(d => { const dot = d.querySelector(".dot"), f = SEC_DONE[d.dataset.s]; if (dot && f) dot.classList.toggle("on", !!f(C)); });
  }
  const SEC_DONE = {
    a: c => has(c.title) && has(c.discipline), b: c => has(c.complaint), cx: c => has(c.seriesIds) || has(c.findingsIntra), d: c => has(c.diagnosis),
    e: c => has(c.plan) || has(c.options), f: c => has(c.steps), g: c => has(c.outcome), h: c => has(c.discussion) || has(c.conclusions), i: c => c.consent && (c.consent.doc || c.consent.edu || c.consent.pub)
  };
  const f = (name, label, o) => {
    o = o || {};
    const v = C[name] == null ? "" : C[name];
    const ctl = o.area ? '<textarea data-f="' + name + '" rows="' + (o.rows || 3) + '" placeholder="' + esc(o.ph || "") + '">' + esc(v) + "</textarea>"
      : o.select ? '<select data-f="' + name + '">' + o.select.map(x => '<option value="' + esc(x[0]) + '"' + (x[0] === v ? " selected" : "") + ">" + esc(x[1]) + "</option>").join("") + "</select>"
      : '<input type="' + (o.type || "text") + '" data-f="' + name + '" value="' + esc(v) + '" placeholder="' + esc(o.ph || "") + '"' + (o.type === "number" ? ' inputmode="numeric"' : "") + ">";
    return '<label class="f"><span>' + label + "</span>" + ctl + (o.hint ? "<small>" + o.hint + "</small>" : "") + "</label>";
  };
  const sec = (id, title, body, open) => '<details class="sec" data-s="' + id + '"' + (open ? " open" : "") + '><summary><span class="dot"></span><h3>' + title + '</h3><span class="chev">' + icon("back", ' style="width:18px;height:18px;transform:scaleX(-1)"') + '</span></summary><div class="body">' + body + "</div></details>";

  async function caseEditor(c) {
    C = c;
    const openSet = new Set(JSON.parse(sessionStorage.getItem("open-" + c.id) || '["a"]'));
    app.innerHTML =
      '<div class="ce-head"><a class="iconbtn" href="#cases" aria-label="Բոլոր դեպքերը">' + icon("back") + '</a><div class="t"><b id="ttl">' + esc(c.title || "Անվերնագիր դեպք") + '</b><span class="muted small" id="pct"></span><div class="care" id="care"></div></div><button class="btn" id="del" aria-label="Ջնջել դեպքը">' + icon("trash") + "</button></div>" +
      sec("a", "Դեպքը մեկ հայացքով", '<p class="hint">Վերնագիրը՝ <b>ախտորոշում կամ միջամտություն + «կլինիկական դեպք»</b>։ Օրինակ՝ «Պսակի կլինիկական երկարացում և մետաղակերամիկական պսակներ առջևի հատվածում. կլինիկական դեպք»։</p>' +
        f("title", "Վերնագիր", { ph: "Ախտորոշում կամ միջամտություն" }) + f("subtitle", "Մեկ նախադասություն՝ ինչով է դեպքը հետաքրքիր") +
        '<div class="grid3">' + f("code", "Բուժառուի կոդ", { ph: "P-2026-014", hint: "Ոչ անուն" }) + f("date", "Սկիզբ", { type: "date" }) + f("status", "Կարգավիճակ", { select: Object.entries(STATUS) }) + "</div>" +
        '<div class="grid2">' + f("discipline", "Ոլորտ", { select: [["", "— ընտրել —"]].concat(DISC.map(d => [d, d])) }) + f("role", "Ձեր դերը", { select: Object.entries(ROLES) }) + "</div>" +
        f("keywords", "Բանալի բառեր", { ph: "2–5 բառ, ստորակետով" }) + f("intro", "Ինչու է այս դեպքը կարևոր", { area: true, ph: "Ի՞նչ է ավելացնում այս դեպքը։ Ո՞րն է «նորությունը» գործընկերների համար։" }), openSet.has("a")) +
      sec("b", "Բուժառու", '<div class="grid2">' + f("age", "Տարիք", { type: "number" }) + f("sex", "Սեռ", { select: [["", "—"], ["Արական", "Արական"], ["Իգական", "Իգական"]] }) + "</div>" +
        f("complaint", "Բողոքը՝ բուժառուի բառերով", { area: true, rows: 2, ph: "«Լնդերս արյունահոսում են, ատամները շարժվում են»" }) +
        f("medical", "Բժշկական անամնեզ", { area: true, rows: 2, ph: "Հիվանդություններ, դեղեր, ալերգիաներ" }) + f("dental", "Ստոմատոլոգիական անամնեզ", { area: true, rows: 2, ph: "Նախկին բուժում, հիգիենա" }) + f("habits", "Սովորություններ և ակնկալիքներ", { area: true, rows: 2, ph: "Ծխել, բրուքսիզմ, էսթետիկ ակնկալիքներ" }), openSet.has("b")) +
      sec("cx", "Հետազոտություն և լուսանկարներ", '<p class="hint">Լուսանկարների ստանդարտ շարքը պատրաստեք <b>«Ֆոտո»</b> հավելվածում և կցեք այստեղ։ «Նախքան» շարքը կօգտագործվի հետազոտության սլայդներում, «Հետո» շարքը՝ արդյունքի։</p><div id="series"></div>' +
        '<div class="row" style="margin-bottom:16px"><a class="btn" href="../photo/#n-' + esc(c.id) + '">' + icon("camera") + 'Նոր շարք «Ֆոտո»-ում</a><button class="btn ghost" id="link-series">' + icon("link") + "Կցել առկա շարք</button></div>" +
        f("findingsExtra", "Արտաբերանային գտածոներ", { area: true, rows: 2 }) + f("findingsIntra", "Ներբերանային գտածոներ", { area: true, rows: 3, ph: "Պերիօդոնտալ վիճակ, ատամներ, կծվածք" }) +
        '<label class="f"><span>Ռենտգեն / ԿԿՏ</span></label><div class="thumbs" id="xrays"></div><button class="btn small" id="add-x" style="margin:8px 0 14px">' + icon("plus") + "Ավելացնել պատկեր</button>" +
        f("radioFindings", "Ռենտգենաբանական գտածոներ", { area: true, rows: 2, ph: "Մեկ կետ՝ մեկ տող" }), openSet.has("cx")) +
      sec("d", "Ախտորոշում", f("diagnosis", "Ախտորոշում", { area: true, rows: 2, ph: "Ընդունված դասակարգմամբ (օր.՝ 2017 AAP/EFP)" }) + f("problems", "Խնդիրների ցուցակ", { area: true, rows: 3, ph: "Մեկ խնդիր՝ մեկ տող, ըստ առաջնահերթության" }), openSet.has("d")) +
      sec("e", "Բուժման տարբերակներ և պլան", '<h3 style="margin:4px 0 10px">Տարբերակներ</h3><div id="options"></div><button class="btn small" id="add-opt">' + icon("plus") + "Տարբերակ</button>" +
        '<div style="margin-top:14px">' + f("choiceWhy", "Ինչու ընտրվեց այս տարբերակը", { area: true, rows: 2 }) + '</div><h3 style="margin:8px 0 10px">Փուլային պլան</h3><div id="plan"></div><div class="row"><button class="btn small" id="add-ph">' + icon("plus") + 'Փուլ</button><button class="btn small ghost" id="preset-ph">Պերիօդոնտալ-օրթոպեդիկ 4 փուլ</button></div>', openSet.has("e")) +
      sec("f", "Բուժման փուլեր", '<p class="hint">Մեկ փուլ՝ մեկ սլայդ։ Ամսաթիվ, ինչ արվեց, ինչ նյութերով, ինչու։ Մինչև 4 լուսանկար յուրաքանչյուր փուլում։</p><div id="steps"></div><button class="btn small" id="add-step">' + icon("plus") + "Փուլ</button>", openSet.has("f")) +
      sec("g", "Արդյունք և հետևում", f("outcome", "Արդյունք", { area: true, ph: "Կլինիկական, ռենտգենաբանական, բուժառուի գնահատական, բարդություններ" }) +
        f("compareView", "«Նախքան / հետո» սլայդի տեսքը", { select: [["frontal", "Առջևից՝ ետքաշիչներով"], ["smile", "Ժպիտ"], ["face", "Դեմք"], ["occU", "Վերին ծնոտ"], ["occL", "Ստորին ծնոտ"]] }) +
        '<h3 style="margin:8px 0 10px">Հետևման այցեր</h3><div id="fu"></div><button class="btn small" id="add-fu">' + icon("plus") + "Այց</button>", openSet.has("g")) +
      sec("h", "Քննարկում և եզրակացություն", f("discussion", "Ինչ ստացվեց", { area: true }) + f("differently", "Ինչ կանեի այլ կերպ", { area: true, rows: 2 }) + f("literature", "Ինչ է ասում գրականությունը", { area: true, rows: 2 }) +
        f("conclusions", "Եզրակացություններ (3 տող)", { area: true, rows: 3, ph: "Մեկ միտք՝ մեկ տող" }) + f("references", "Գրականություն", { area: true, rows: 3, ph: "Մեկ աղբյուր՝ մեկ տող (Վանկուվերյան ոճ)" }), openSet.has("h")) +
      sec("i", "Բուժառուի համաձայնություն", '<p class="hint">Գրավոր համաձայնությունը պահեք կլինիկայում։ Այստեղ նշեք, թե ինչի համար է այն տրված։ Դեմքով լուսանկարներ՝ միայն համաձայնությամբ։</p>' +
        [["doc", "Փաստաթղթավորում"], ["edu", "Ուսուցում, դասախոսություններ"], ["pub", "Հրապարակում (ամսագիր, կոնֆերանս)"], ["social", "Սոցիալական ցանցեր"]].map(x => '<label class="switch"><input type="checkbox" data-consent="' + x[0] + '"' + (c.consent[x[0]] ? " checked" : "") + "><span>" + x[1] + "</span></label>").join("") +
        '<label class="f" style="max-width:240px"><span>Համաձայնության ամսաթիվ</span><input type="date" data-consent="date" value="' + esc(c.consent.date || "") + '"></label>', openSet.has("i")) +
      '<div class="sticky-act"><button class="btn" id="exp">' + icon("download") + 'Արտահանել</button><button class="btn primary" id="savec">' + icon("check") + "Պահել</button></div>";

    updateCare();
    $$("[data-f]").forEach(el => el.addEventListener(el.tagName === "SELECT" ? "change" : "input", () => {
      C[el.dataset.f] = el.value;
      if (el.dataset.f === "title") $("#ttl").textContent = el.value || "Անվերնագիր դեպք";
      saveCase();
    }));
    $$("[data-consent]").forEach(el => el.addEventListener("change", () => { C.consent[el.dataset.consent] = el.type === "checkbox" ? el.checked : el.value; saveCase(); }));
    $$("details.sec").forEach(d => d.addEventListener("toggle", () => {
      const s = new Set(JSON.parse(sessionStorage.getItem("open-" + c.id) || "[]"));
      d.open ? s.add(d.dataset.s) : s.delete(d.dataset.s);
      sessionStorage.setItem("open-" + c.id, JSON.stringify([...s]));
    }));
    $("#del").onclick = async () => { if (await ISD.confirmBox("Ջնջե՞լ այս դեպքը։ Լուսանկարների շարքերը կմնան «Ֆոտո» հավելվածում։", "Ջնջել")) { await db.del("cases", c.id); C = null; location.hash = "cases"; } };
    $("#exp").onclick = () => exportChooser(C);
    $("#savec").onclick = async () => {
      if (!C) return;
      C.updated = now(); await db.put("cases", C);
      toast("Դեպքը պահված է · " + pct(C) + "% լրացված");
      location.hash = "cases";
    };
    $("#link-series").onclick = linkSeries;
    $("#add-x").onclick = () => pickPhotos(async recs => { recs.forEach(r => C.xrays.push({ photoId: r.id, label: "" })); saveCase(); drawXrays(); });
    $("#add-opt").onclick = () => { C.options.push({ name: "", pros: "", cons: "", chosen: !C.options.length }); saveCase(); drawOptions(); };
    $("#add-ph").onclick = () => { C.plan.push({ phase: "", text: "" }); saveCase(); drawPlan(); };
    $("#preset-ph").onclick = () => {
      C.plan = [{ phase: "Նախնական փուլ", text: "" }, { phase: "Վիրաբուժական փուլ", text: "" }, { phase: "Վերականգնողական փուլ", text: "" }, { phase: "Պահպանողական թերապիա", text: "" }];
      saveCase(); drawPlan();
    };
    $("#add-step").onclick = () => { C.steps.push({ date: ISD.today(), title: "", text: "", photos: [] }); saveCase(); drawSteps(); };
    $("#add-fu").onclick = () => { C.followup.push({ date: "", text: "" }); saveCase(); drawFU(); };
    drawSeries(); drawXrays(); drawOptions(); drawPlan(); drawSteps(); drawFU();
  }

  /* repeatable rows */
  function listRows(host, key, fields, onDraw) {
    const el = $(host); if (!el) return;
    el.innerHTML = C[key].map((it, i) => '<div class="item"><div class="row top"><span class="badge">' + (i + 1) + '</span><span class="row" style="gap:6px">' + (i ? '<button class="iconbtn" data-up="' + i + '" aria-label="Վեր" style="width:36px;height:36px">' + icon("back", ' style="transform:rotate(90deg)"') + "</button>" : "") + '<button class="iconbtn" data-rm="' + i + '" aria-label="Ջնջել" style="width:36px;height:36px">' + icon("trash") + "</button></span></div>" +
      fields.map(fl => fl.kind === "check" ? '<label class="switch"><input type="checkbox" data-i="' + i + '" data-k="' + fl.k + '"' + (it[fl.k] ? " checked" : "") + "><span>" + fl.label + "</span></label>"
        : '<label class="f"><span>' + fl.label + "</span>" + (fl.area ? '<textarea rows="' + (fl.rows || 2) + '" data-i="' + i + '" data-k="' + fl.k + '" placeholder="' + esc(fl.ph || "") + '">' + esc(it[fl.k] || "") + "</textarea>" : '<input type="' + (fl.type || "text") + '" data-i="' + i + '" data-k="' + fl.k + '" value="' + esc(it[fl.k] || "") + '" placeholder="' + esc(fl.ph || "") + '">') + "</label>").join("") +
      (onDraw ? '<div data-extra="' + i + '"></div>' : "") + "</div>").join("");
    $$("[data-k]", el).forEach(inp => inp.addEventListener(inp.type === "checkbox" ? "change" : "input", () => {
      const it = C[key][+inp.dataset.i];
      if (inp.type === "checkbox") { if (key === "options" && inp.checked) C.options.forEach(o => o.chosen = false); it[inp.dataset.k] = inp.checked; if (key === "options") drawOptions(); }
      else it[inp.dataset.k] = inp.value;
      saveCase();
    }));
    $$("[data-rm]", el).forEach(b => b.onclick = async () => { if (await ISD.confirmBox("Ջնջե՞լ։", "Ջնջել")) { C[key].splice(+b.dataset.rm, 1); saveCase(); listRows(host, key, fields, onDraw); } });
    $$("[data-up]", el).forEach(b => b.onclick = () => { const i = +b.dataset.up; [C[key][i - 1], C[key][i]] = [C[key][i], C[key][i - 1]]; saveCase(); listRows(host, key, fields, onDraw); });
    if (onDraw) $$("[data-extra]", el).forEach(x => onDraw(x, +x.dataset.extra));
  }
  const drawOptions = () => listRows("#options", "options", [{ k: "name", label: "Տարբերակ", ph: "օր.՝ Իմպլանտ + պսակ" }, { k: "pros", label: "Առավելություններ", area: true }, { k: "cons", label: "Թերություններ", area: true }, { k: "chosen", label: "Ընտրված տարբերակ", kind: "check" }]);
  const drawPlan = () => listRows("#plan", "plan", [{ k: "phase", label: "Փուլ" }, { k: "text", label: "Ինչ է ներառում", area: true }]);
  const drawFU = () => listRows("#fu", "followup", [{ k: "date", label: "Ժամկետ կամ ամսաթիվ", ph: "օր.՝ 6 ամիս" }, { k: "text", label: "Ինչ գտանք", area: true }]);
  const drawSteps = () => listRows("#steps", "steps", [{ k: "date", label: "Ամսաթիվ", type: "date" }, { k: "title", label: "Փուլի անվանումը", ph: "օր.՝ Հղկում և ժամանակավոր պսակներ" }, { k: "text", label: "Ինչ արվեց, ինչ նյութերով, ինչու", area: true, rows: 3 }], (host, i) => {
    const st = C.steps[i]; st.photos = st.photos || [];
    host.innerHTML = '<div class="thumbs">' + st.photos.map((p, k) => '<div class="th"><canvas></canvas><button class="rm" data-prm="' + k + '" aria-label="Հեռացնել">' + icon("close") + '</button><input type="text" data-pl="' + k + '" value="' + esc(p.label || "") + '" placeholder="Մակագրություն"></div>').join("") + "</div>" +
      (st.photos.length < 4 ? '<button class="btn small" data-padd style="margin-top:8px">' + icon("image") + "Լուսանկար</button>" : "");
    $$("canvas", host).forEach((cv, k) => paintThumb(cv, st.photos[k].photoId));
    $$("[data-prm]", host).forEach(b => b.onclick = () => { st.photos.splice(+b.dataset.prm, 1); saveCase(); drawSteps(); });
    $$("[data-pl]", host).forEach(inp => inp.oninput = () => { st.photos[+inp.dataset.pl].label = inp.value; saveCase(); });
    const add = host.querySelector("[data-padd]");
    if (add) add.onclick = () => pickPhotos(recs => { recs.slice(0, 4 - st.photos.length).forEach(r => st.photos.push({ photoId: r.id, label: "" })); saveCase(); drawSteps(); });
  });
  function drawXrays() {
    const el = $("#xrays"); if (!el) return;
    el.innerHTML = C.xrays.map((p, k) => '<div class="th"><canvas></canvas><button class="rm" data-xrm="' + k + '" aria-label="Հեռացնել">' + icon("close") + '</button><input type="text" data-xl="' + k + '" value="' + esc(p.label || "") + '" placeholder="ՕՊՏԳ, ԿԿՏ…"></div>').join("");
    $$("canvas", el).forEach((cv, k) => paintThumb(cv, C.xrays[k].photoId));
    $$("[data-xrm]", el).forEach(b => b.onclick = () => { C.xrays.splice(+b.dataset.xrm, 1); saveCase(); drawXrays(); });
    $$("[data-xl]", el).forEach(inp => inp.oninput = () => { C.xrays[+inp.dataset.xl].label = inp.value; saveCase(); });
  }
  async function paintThumb(cv, id) {
    const img = await ISD.bitmap(id, "thumb"); if (!img) return;
    cv.width = 216; cv.height = 144; ISD.drawPhoto(cv.getContext("2d"), img, 0, 0, 216, 144, {}, "cover", "#e6e8e5");
  }
  let pickCb = null;
  function pickPhotos(cb) { pickCb = cb; $("#pick").click(); }
  $("#pick").onchange = async e => {
    const files = Array.from(e.target.files || []); e.target.value = "";
    if (!files.length || !pickCb) return;
    const out = [];
    for (const fl of files) { try { out.push(await ISD.importPhoto(fl)); } catch (er) { toast("Չհաջողվեց կարդալ ֆայլը"); } }
    out.sort((a, b) => a.takenAt - b.takenAt);
    const cb = pickCb; pickCb = null; cb(out);
  };

  /* photo series from «Ֆոտո» */
  async function drawSeries() {
    const el = $("#series"); if (!el) return;
    const list = (await Promise.all((C.seriesIds || []).map(id => db.get("series", id)))).filter(Boolean);
    if (list.length !== (C.seriesIds || []).length) { C.seriesIds = list.map(s => s.id); saveCase(); }
    el.innerHTML = list.length ? '<div class="series">' + list.map(s => '<div class="s" data-sid="' + esc(s.id) + '"><img alt=""><div><span>' + esc(P.stageName(s.stage)) + " · " + esc(ISD.fmtShort(s.date)) + '</span><span><a href="../photo/#s-' + esc(s.id) + '">Բացել</a> · <a href="#" data-unlink="' + esc(s.id) + '">Անջատել</a></span></div></div>').join("") + "</div>" : "";
    $$("[data-unlink]", el).forEach(a => a.onclick = e => { e.preventDefault(); C.seriesIds = C.seriesIds.filter(x => x !== a.dataset.unlink); saveCase(); drawSeries(); });
    for (const s of list) {
      try {
        const cv = await P.renderCollage(s, { width: 900, labels: false, getImage: id => ISD.bitmap(id, "thumb") });
        const img = $('[data-sid="' + CSS.escape(s.id) + '"] img', el); if (img) img.src = URL.createObjectURL(await ISD.canvasToBlob(cv, "image/jpeg", 0.8));
      } catch (e) {}
    }
  }
  async function linkSeries() {
    const all = (await db.all("series")).filter(s => !(C.seriesIds || []).includes(s.id)).sort((a, b) => b.updated - a.updated);
    const sh = ISD.sheet('<header><div class="grow"><h2>Կցել շարք</h2></div><button class="iconbtn" data-x aria-label="Փակել">' + icon("close") + "</button></header>" +
      (all.length ? '<div style="display:grid;gap:8px">' + all.map(s => '<button class="btn block" style="justify-content:flex-start" data-s="' + esc(s.id) + '"><b>' + esc(s.code || "—") + '</b><span class="muted">' + esc(P.stageName(s.stage) + " · " + ISD.fmtShort(s.date)) + "</span></button>").join("") + "</div>" : '<p class="muted">Չկցված շարք չկա։ Ստեղծեք այն «Ֆոտո» հավելվածում։</p>'));
    sh.el.querySelector("[data-x]").onclick = sh.close;
    $$("[data-s]", sh.el).forEach(b => b.onclick = async () => {
      const s = await db.get("series", b.dataset.s); s.caseId = C.id; await db.put("series", s);
      C.seriesIds = (C.seriesIds || []).concat(s.id); saveCase(); sh.close(); drawSeries();
    });
  }

  /* ---------- PowerPoint export ---------- */
  function loadScript(src, global) { return new Promise((res, rej) => { if (global && window[global]) return res(); const t = document.createElement("script"); t.src = src; t.onload = res; t.onerror = rej; document.head.appendChild(t); }); }
  const VIEW = { // same view across protocols
    face: ["face"], profile: ["profile"], smile: ["smile", "smileF"], frontal: ["frontal", "retrF"], latR: ["latR", "retrR"], latL: ["latL", "retrL"], occU: ["occU"], occL: ["occL"]
  };
  async function viewImg(s, view) {
    if (!s) return null;
    for (const k of VIEW[view] || [view]) { const a = s.slots[k]; if (a && a.photoId) { const r = await ISD.correctedDataURL(a.photoId, a, 1800); if (r) return r; } }
    return null;
  }
  async function exportDeck(c) {
    const note = document.createElement("div"); note.className = "toast"; note.textContent = "PowerPoint-ը պատրաստվում է…"; document.body.appendChild(note);
    try {
      await loadScript("../assets/vendor/pptxgen.bundle.js", "PptxGenJS");
      const prof = (await db.meta("profile", {})) || {};
      const ser = (await Promise.all((c.seriesIds || []).map(id => db.get("series", id)))).filter(Boolean).sort((a, b) => (a.date || "").localeCompare(b.date || ""));
      const pre = ser.find(s => s.stage === "pre") || ser[0];
      const post = [...ser].reverse().find(s => s.stage === "post" || s.stage === "fu") || null;
      const lines = v => String(v || "").split(/\n+/).map(x => x.trim()).filter(Boolean);
      const d = {
        title: c.title, subtitle: c.subtitle, presenter: prof.name || "", role: [prof.title, prof.clinic].filter(Boolean).join(", "), event: ISD.fmtDate(c.date),
        contact: [prof.email, prof.phone].filter(Boolean).join(" · "), code: c.code, age: c.age ? c.age + " տ." : "", sex: c.sex, firstVisit: ISD.fmtShort(c.date),
        intro: c.intro, keywords: c.keywords, complaint: c.complaint, medical: c.medical, dental: c.dental, habits: c.habits,
        findingsExtra: c.findingsExtra, findingsIntra: c.findingsIntra, radioFindings: c.radioFindings,
        diagnosis: c.diagnosis, problems: lines(c.problems), options: c.options.filter(o => o.name), choiceWhy: c.choiceWhy,
        plan: c.plan.filter(p => p.phase || p.text), outcome: c.outcome, followup: c.followup.filter(x => x.date || x.text),
        discussion: c.discussion, differently: c.differently, literature: c.literature, conclusions: lines(c.conclusions), references: lines(c.references)
      };
      if (pre) {
        d.extra = { face: await viewImg(pre, "face"), profile: await viewImg(pre, "profile"), smile: await viewImg(pre, "smile") };
        d.intra = { frontal: await viewImg(pre, "frontal"), latR: await viewImg(pre, "latR"), latL: await viewImg(pre, "latL"), occU: await viewImg(pre, "occU"), occL: await viewImg(pre, "occL") };
      }
      if (post) { d.before = await viewImg(pre, c.compareView); d.after = await viewImg(post, c.compareView); d.beforeDate = ISD.fmtShort(pre && pre.date); d.afterDate = ISD.fmtShort(post.date); }
      d.hero = (post && (await viewImg(post, "smile") || await viewImg(post, "frontal"))) || (pre && (await viewImg(pre, "smile") || await viewImg(pre, "frontal")));
      d.xrays = [];
      for (const x of c.xrays.slice(0, 2)) { const r = await ISD.correctedDataURL(x.photoId, {}, 2000); if (r) d.xrays.push(Object.assign(r, { label: x.label })); }
      d.steps = [];
      for (const st of c.steps) {
        const photos = [];
        for (const p of (st.photos || []).slice(0, 4)) { const r = await ISD.correctedDataURL(p.photoId, {}, 1600); if (r) photos.push(Object.assign(r, { label: p.label })); }
        d.steps.push({ date: st.date, dateLabel: ISD.fmtDate(st.date), title: st.title, text: st.text, photos });
      }
      let logo = null; try { logo = await ISD.blobToDataURL(await (await fetch("/assets/brand/isd-logo.png")).blob()); } catch (e) {}
      const pptx = ISDDeck.build(window.PptxGenJS, d, { template: false, logo });
      const blob = await pptx.write({ outputType: "blob" });
      note.remove();
      const n = ((await db.meta("exports", 0)) || 0) + 1; await db.setMeta("exports", n);
      await ISD.saveFile(blob, ISD.safeName((c.code ? c.code + "_" : "") + (c.title || "case")) + ".pptx");
    } catch (e) {
      note.remove(); console.error(e); toast("Չհաջողվեց պատրաստել PowerPoint-ը");
    }
  }


  /* ---------- export: choose PowerPoint or PDF ---------- */
  function exportChooser(c) {
    const sh = ISD.sheet('<header><div class="grow"><h2>Արտահանել դեպքը</h2><p class="muted small" style="margin-top:4px">Ֆայլը կպահվի ձեր հեռախոսում կամ համակարգչում։ Ընտրեք ձևաչափը․</p></div><button class="iconbtn" data-x aria-label="Փակել">' + icon("close") + "</button></header>" +
      '<div class="expopts">' +
      '<button class="expopt" data-fmt="pptx"><span class="xi">' + icon("slides") + '</span><span class="xt"><b>PowerPoint</b><span>Ներկայացում՝ սլայդներով, CARE կառուցվածքով և խոսնակի նշումներով։ Կարող եք խմբագրել։</span></span><span class="xe">.pptx</span></button>' +
      '<button class="expopt" data-fmt="pdf"><span class="xi">' + icon("file") + '</span><span class="xt"><b>PDF</b><span>Դեպքի ամբողջական հաշվետվություն՝ A4, բաժիններով և բոլոր լուսանկարներով։ Հարմար է ուղարկելու, արխիվացնելու և տպելու համար։</span></span><span class="xe">.pdf</span></button>' +
      "</div>" + (pct(c) < 60 ? '<p class="muted small" style="margin-top:12px">Դեպքը ' + pct(c) + '% լրացված է․ դատարկ բաժինները ֆայլում չեն լինի։</p>' : ""));
    sh.el.querySelector("[data-x]").onclick = sh.close;
    $$("[data-fmt]", sh.el).forEach(b => b.onclick = () => { sh.close(); b.dataset.fmt === "pdf" ? exportPDF(c) : exportDeck(c); });
  }

  /* ---------- PDF case report ---------- */
  const VIEW_LABEL = { face: "Դեմք", profile: "Պրոֆիլ", smile: "Ժպիտ", frontal: "Առջևից", latR: "Աջ կողմ", latL: "Ձախ կողմ", occU: "Վերին ծնոտ", occL: "Ստորին ծնոտ" };
  async function seriesPhotos(s) {
    const out = []; if (!s) return out;
    const proto = P.PROTOCOLS[s.protocol] || P.PROTOCOLS.basic8;
    for (const sl of proto.slots) { const a = s.slots && s.slots[sl.key]; if (a && a.photoId) { const r = await ISD.correctedDataURL(a.photoId, a, 1400); if (r) out.push({ r, label: sl.short + " · " + sl.mag }); } }
    return out;
  }
  async function exportPDF(c) {
    const note = document.createElement("div"); note.className = "toast"; note.textContent = "PDF-ը պատրաստվում է…"; document.body.appendChild(note);
    try {
      await loadScript("../assets/vendor/jspdf.umd.min.js", "jspdf");
      await Promise.all(["400 24px NSA", "700 24px NSA", "700 48px NSerif"].map(f => document.fonts.load(f, "Աա Aa 1")));
      const prof = (await db.meta("profile", {})) || {};
      const ser = (await Promise.all((c.seriesIds || []).map(id => db.get("series", id)))).filter(Boolean).sort((a, b) => (a.date || "").localeCompare(b.date || ""));
      const pages = await renderCasePages(c, prof, ser);
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
      pages.forEach((pc, i) => { if (i) pdf.addPage(); pdf.addImage(pc.toDataURL("image/jpeg", 0.9), "JPEG", 0, 0, 210, 297, undefined, "FAST"); pc.width = 1; pc.height = 1; });
      pdf.setProperties({ title: c.title || "Կլինիկական դեպք", subject: c.discipline || "", author: prof.name || "", keywords: c.keywords || "", creator: "ISD Dental School · Պորտֆոլիո" });
      note.remove();
      const n = ((await db.meta("exports", 0)) || 0) + 1; await db.setMeta("exports", n);
      await ISD.saveFile(pdf.output("blob"), ISD.safeName((c.code ? c.code + "_" : "") + (c.title || "case")) + ".pdf");
    } catch (e) { note.remove(); console.error(e); toast("Չհաջողվեց պատրաստել PDF-ը"); }
  }
  async function renderCasePages(c, prof, ser) {
    const W = 1240, H = 1754, MM = W / 210, PT = 150 / 72, M = Math.round(16 * MM), CW = W - 2 * M, BOTTOM = H - M - Math.round(6 * MM);
    const SANS = "NSA, Arial, sans-serif", SERIF = "NSerif, Georgia, serif", RED = "#b8321f", INK = "#141414", GREY = "#666", LINE = "#dddddd";
    const pages = []; let cv, x, y;
    const page = () => { cv = document.createElement("canvas"); cv.width = W; cv.height = H; x = cv.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, W, H); pages.push(cv); y = M; };
    const font = (w, pt, fam) => { x.font = w + " " + Math.round(pt * PT) + "px " + (fam || SANS); };
    const need = h => { if (y + h > BOTTOM) page(); };
    const px = pt => Math.round(pt * PT);
    function wrap(runs, maxW, pt) {
      const lines = [[]]; let lw = 0;
      runs.forEach(r => String(r.t == null ? "" : r.t).split(/(\s+)/).filter(Boolean).forEach(tok => {
        font(r.b ? 700 : 400, pt);
        if (/^\s+$/.test(tok)) { if (/\n/.test(tok)) { lines.push([]); lw = 0; return; } if (lw > 0) { lines[lines.length - 1].push({ t: " ", b: r.b, c: r.c }); lw += x.measureText(" ").width; } return; }
        let w = x.measureText(tok).width;
        while (w > maxW) {
          let k = tok.length; while (k > 1 && x.measureText(tok.slice(0, k)).width > maxW - lw) k--;
          if (lw > 0 && k < 2) { lines.push([]); lw = 0; continue; }
          lines[lines.length - 1].push({ t: tok.slice(0, k), b: r.b, c: r.c }); lines.push([]); lw = 0; tok = tok.slice(k); w = x.measureText(tok).width;
        }
        if (lw + w > maxW && lw > 0) { const L = lines[lines.length - 1]; if (L.length && L[L.length - 1].t === " ") L.pop(); lines.push([]); lw = 0; }
        lines[lines.length - 1].push({ t: tok, b: r.b, c: r.c }); lw += w;
      }));
      return lines.filter(l => l.length);
    }
    function text(runs, x0, maxW, pt, color, lh) {
      const step = Math.round(px(pt) * (lh || 1.42));
      wrap(runs, maxW, pt).forEach(L => { need(step); let xx = x0; y += px(pt); L.forEach(r => { font(r.b ? 700 : 400, pt); x.fillStyle = r.c || color || INK; x.fillText(r.t, xx, y); xx += x.measureText(r.t).width; }); y += step - px(pt); });
    }
    const R = v => [{ t: v }];
    // section heading, numbered
    let secNo = 0;
    const heading = t => {
      need(px(13) * 4); y += Math.round(6 * MM); secNo++;
      font(700, 13); x.fillStyle = RED; y += px(13); x.fillText(secNo + ". " + t, M, y);
      y += Math.round(2.2 * MM); x.fillStyle = LINE; x.fillRect(M, y, CW, 2); y += Math.round(3.5 * MM);
    };
    const sub = t => { need(px(11) * 3); y += Math.round(2.5 * MM); text([{ t, b: true }], M, CW, 11, INK, 1.3); y += Math.round(1 * MM); };
    // label | value row
    const LC = Math.round(42 * MM);
    const row = (label, runs) => {
      if (!runs || !runs.some(r => String(r.t || "").trim())) return;
      const lines = wrap(runs, CW - LC, 10.5), step = Math.round(px(10.5) * 1.42);
      const lab = wrap(R(label), LC - 18, 9.5).slice(0, 3), labStep = Math.round(px(9.5) * 1.3);
      need(Math.max(step * Math.min(lines.length, 2), lab.length * labStep + 8));
      const y0 = y, pg0 = pages.length; font(400, 9.5); x.fillStyle = GREY;
      lab.forEach((L, i) => x.fillText(L.map(r => r.t).join(""), M, y0 + px(10.5) + i * labStep));
      text(runs, M + LC, CW - LC, 10.5, INK, 1.42);
      if (pages.length === pg0) y = Math.max(y, y0 + px(10.5) + (lab.length - 1) * labStep + Math.round(px(9.5) * 0.5));
      y += Math.round(1.6 * MM);
    };
    const list = (items, pt) => items.forEach((t, i) => {
      const step = Math.round(px(pt) * 1.42); need(step);
      const y0 = y; font(700, pt); x.fillStyle = RED; x.fillText((i + 1) + ".", M, y0 + px(pt));
      text(R(t), M + Math.round(7 * MM), CW - Math.round(7 * MM), pt, INK, 1.42); y += Math.round(0.8 * MM);
    });
    async function decodeR(r) { return ISD.decode(await ISD.dataURLToBlob(r.data)); }
    // photo grid: items [{r, label}], cols, cell aspect (h/w)
    async function grid(items, cols, aspect, bg) {
      if (!items.length) return;
      const gap = Math.round(3 * MM), cw = (CW - gap * (cols - 1)) / cols, ch = Math.round(cw * aspect), lh = px(8.5) * 2;
      for (let i = 0; i < items.length; i += cols) {
        need(ch + lh); const y0 = y;
        for (let k = 0; k < cols && i + k < items.length; k++) {
          const it = items[i + k], x0 = Math.round(M + k * (cw + gap)), img = await decodeR(it.r);
          x.save(); x.beginPath(); const rr = 10; x.moveTo(x0 + rr, y0); x.arcTo(x0 + cw, y0, x0 + cw, y0 + ch, rr); x.arcTo(x0 + cw, y0 + ch, x0, y0 + ch, rr); x.arcTo(x0, y0 + ch, x0, y0, rr); x.arcTo(x0, y0, x0 + cw, y0, rr); x.closePath(); x.clip();
          ISD.drawPhoto(x, img, x0, y0, cw, ch, {}, "contain", bg || "#f3f4f2"); x.restore();
          if (it.label) { font(400, 8.5); x.fillStyle = GREY; const L = wrap(R(it.label), cw, 8.5)[0]; if (L) x.fillText(L.map(r => r.t).join(""), x0, y0 + ch + px(8.5) + 6); }
        }
        y = y0 + ch + lh + Math.round(1.5 * MM);
      }
    }

    page();
    await ISD.drawLogoChip(x, W - M, M - 6, Math.round(13 * MM));   // ISD logo, top right of page 1
    /* title block */
    font(700, 9); x.fillStyle = RED; y += px(9); x.fillText(["ԿԼԻՆԻԿԱԿԱՆ ԴԵՊՔ", c.discipline].filter(Boolean).join("  ·  "), M, y); y += Math.round(3 * MM);
    wrap([{ t: c.title || "Անվերնագիր դեպք", b: true }], CW - Math.round(40 * MM), 22).forEach(L => { y += px(22); x.font = "700 " + px(22) + "px " + SERIF; x.fillStyle = INK; x.fillText(L.map(r => r.t).join(""), M, y); y += Math.round(px(22) * 0.28); });
    if (c.subtitle) { y += Math.round(1.5 * MM); text(R(c.subtitle), M, CW, 12, "#444", 1.35); }
    y += Math.round(4 * MM);
    // meta strip
    const meta = [["Բուժառուի կոդ", c.code || "—"], ["Սկիզբ", ISD.fmtDate(c.date) || "—"], ["Կարգավիճակ", STATUS[c.status] || "—"], ["Բժշկի դերը", ROLES[c.role] || "—"]];
    const mh = Math.round(15 * MM); need(mh); x.fillStyle = "#f4f4f1"; x.fillRect(M, y, CW, mh);
    meta.forEach((m, i) => { const x0 = M + Math.round(4 * MM) + i * (CW / 4); font(400, 8); x.fillStyle = GREY; x.fillText(m[0], x0, y + Math.round(5.5 * MM)); font(700, 10.5); x.fillStyle = INK; const L = wrap(R(m[1]), CW / 4 - 30, 10.5)[0]; x.fillText(L ? L.map(r => r.t).join("") : "", x0, y + Math.round(11.5 * MM)); });
    y += mh + Math.round(4 * MM);
    const author = [prof.name, prof.title, prof.clinic, prof.city].filter(Boolean).join(" · ");
    if (author) text([{ t: "Բժիշկ՝ ", c: GREY }, { t: author }], M, CW, 10, INK, 1.35);
    if (c.keywords) text([{ t: "Բանալի բառեր՝ ", c: GREY }, { t: c.keywords }], M, CW, 10, INK, 1.35);

    if (has(c.intro)) { heading("Ներածություն"); text(R(c.intro), M, CW, 10.5, INK, 1.45); }

    if ([c.age, c.sex, c.complaint, c.medical, c.dental, c.habits].some(has)) {
      heading("Բուժառու");
      row("Տարիք, սեռ", R([c.age ? c.age + " տարեկան" : "", c.sex].filter(Boolean).join(", ")));
      if (has(c.complaint)) row("Բողոք", [{ t: "«" + c.complaint.trim().replace(/^«|»$/g, "") + "»", b: true }]);
      row("Բժշկական անամնեզ", R(c.medical)); row("Ստոմատոլոգիական անամնեզ", R(c.dental)); row("Սովորություններ և ակնկալիքներ", R(c.habits));
    }

    const pre = ser.find(s => s.stage === "pre") || null;
    const others = ser.filter(s => s !== pre);
    if ([c.findingsExtra, c.findingsIntra, c.radioFindings].some(has) || pre || c.xrays.length) {
      heading("Հետազոտություն");
      row("Արտաբերանային", R(c.findingsExtra)); row("Ներբերանային", R(c.findingsIntra));
      if (pre) { const ph = await seriesPhotos(pre); if (ph.length) { sub("Լուսանկարներ · " + P.stageName(pre.stage) + " · " + ISD.fmtDate(pre.date)); await grid(ph, 3, 0.7); } }
      if (c.xrays.length) {
        sub("Ռենտգեն / ԿԿՏ");
        const xr = []; for (const q of c.xrays) { const r = await ISD.correctedDataURL(q.photoId, {}, 1600); if (r) xr.push({ r, label: q.label || "" }); }
        await grid(xr, 2, 0.62, "#111111");
      }
      if (has(c.radioFindings)) { y += Math.round(1 * MM); row("Ռենտգենաբանական գտածոներ", R(c.radioFindings)); }
    }

    const lines = v => String(v || "").split(/\n+/).map(t => t.trim()).filter(Boolean);
    if (has(c.diagnosis) || has(c.problems)) {
      heading("Ախտորոշում");
      row("Ախտորոշում", [{ t: c.diagnosis, b: true }]);
      if (has(c.problems)) { sub("Խնդիրների ցուցակ"); list(lines(c.problems), 10.5); }
    }

    const opts = c.options.filter(o => o.name), plan = c.plan.filter(p => p.phase || p.text);
    if (opts.length || plan.length || has(c.choiceWhy)) {
      heading("Բուժման տարբերակներ և պլան");
      opts.forEach((o, i) => row("Տարբերակ " + (i + 1), [{ t: o.name, b: true }].concat(o.chosen ? [{ t: "  ✓ ընտրված", c: RED, b: true }] : []).concat(o.pros ? [{ t: "\n+ " + o.pros }] : []).concat(o.cons ? [{ t: "\n− " + o.cons }] : [])));
      row("Ինչու այս տարբերակը", R(c.choiceWhy));
      if (plan.length) { sub("Փուլային պլան"); plan.forEach((p, i) => row((i + 1) + ". " + (p.phase || "Փուլ"), R(p.text || "—"))); }
    }

    const steps = c.steps.filter(st => st.title || st.text || (st.photos || []).length);
    if (steps.length) {
      heading("Բուժման փուլեր");
      for (const [i, st] of steps.entries()) {
        sub((i + 1) + ". " + (st.title || "Փուլ") + (st.date ? "  ·  " + ISD.fmtDate(st.date) : ""));
        if (has(st.text)) text(R(st.text), M, CW, 10.5, INK, 1.45);
        const ph = []; for (const q of (st.photos || [])) { const r = await ISD.correctedDataURL(q.photoId, {}, 1400); if (r) ph.push({ r, label: q.label || "" }); }
        if (ph.length) { y += Math.round(2 * MM); await grid(ph, 2, 0.66); }
      }
    }

    const post = [...ser].reverse().find(s => s.stage === "post" || s.stage === "fu") || null;
    const fu = c.followup.filter(q => q.date || q.text);
    if (has(c.outcome) || post || fu.length) {
      heading("Արդյունք և հետևում");
      if (has(c.outcome)) text(R(c.outcome), M, CW, 10.5, INK, 1.45);
      if (pre && post) {
        const b = await viewImg(pre, c.compareView), a = await viewImg(post, c.compareView);
        if (b && a) { sub("Նախքան / հետո · " + (VIEW_LABEL[c.compareView] || "")); await grid([{ r: b, label: "Նախքան · " + ISD.fmtDate(pre.date) }, { r: a, label: "Հետո · " + ISD.fmtDate(post.date) }], 2, 0.66); }
      }
      for (const s of others) { const ph = await seriesPhotos(s); if (ph.length) { sub("Լուսանկարներ · " + P.stageName(s.stage) + " · " + ISD.fmtDate(s.date)); await grid(ph, 3, 0.7); } }
      if (fu.length) { sub("Հետևման այցեր"); fu.forEach(q => row(q.date || "—", R(q.text || "—"))); }
    }

    if ([c.discussion, c.differently, c.literature, c.conclusions, c.references].some(has)) {
      heading("Քննարկում և եզրակացություն");
      row("Ինչ ստացվեց", R(c.discussion)); row("Ինչ կանեի այլ կերպ", R(c.differently)); row("Գրականությունը", R(c.literature));
      if (has(c.conclusions)) { sub("Եզրակացություններ"); list(lines(c.conclusions), 10.5); }
      if (has(c.references)) { sub("Գրականություն"); list(lines(c.references), 9); }
    }

    heading("Բուժառուի համաձայնություն");
    [["doc", "Փաստաթղթավորում"], ["edu", "Ուսուցում, դասախոսություններ"], ["pub", "Հրապարակում"], ["social", "Սոցիալական ցանցեր"]].forEach(k =>
      row(k[1], c.consent[k[0]] ? [{ t: "✓ Այո", b: true, c: "#1f7a4d" }] : [{ t: "— Ոչ", c: GREY }]));
    if (c.consent.date) row("Ամսաթիվ", R(ISD.fmtDate(c.consent.date)));
    y += Math.round(4 * MM); text([{ t: "Գրավոր համաձայնությունը պահվում է կլինիկայում։ Փաստաթուղթը պատրաստված է ISD Dental School «Պորտֆոլիո» հավելվածով, " + ISD.fmtDate(ISD.today()) + "։", c: "#888" }], M, CW, 8.5, "#888", 1.35);

    // footer on every page
    const left = [c.code, prof.name].filter(Boolean).join(" · ");
    pages.forEach((pc, i) => {
      const g = pc.getContext("2d"); g.font = "400 " + px(8) + "px " + SANS; g.fillStyle = "#9aa0a0";
      g.fillStyle = LINE; g.fillRect(M, H - Math.round(13 * MM), CW, 1); g.fillStyle = "#9aa0a0";
      g.textAlign = "left"; g.fillText(left, M, H - Math.round(9 * MM));
      g.textAlign = "right"; g.fillText((i + 1) + " / " + pages.length, W - M, H - Math.round(9 * MM));
    });
    return pages;
  }

  /* ---------- logbook ---------- */
  async function logView() {
    const all = (await db.all("cases")).map(normalize).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    const by = k => { const m = {}; all.forEach(c => { const v = c[k] || "—"; m[v] = (m[v] || 0) + 1; }); return Object.entries(m).sort((a, b) => b[1] - a[1]); };
    const disc = by("discipline"), max = Math.max(1, ...disc.map(x => x[1]));
    const roles = by("role");
    app.innerHTML = '<section class="lead"><div><h1>Գրանցամատյան</h1><p>Ձեր կլինիկական փորձը թվերով։ Այս թվերը տեղափոխվում են CV՝ «Կլինիկական փորձ» բաժին։</p></div><div class="kpis"><div class="kpi"><b>' + all.length + '</b><span>դեպք</span></div><div class="kpi"><b>' + all.filter(c => c.role === "operator").length + '</b><span>որպես կատարող</span></div><div class="kpi"><b>' + all.filter(c => c.status === "done").length + "</b><span>ավարտված</span></div></div></section>" +
      (all.length ? '<div class="card" style="margin-bottom:14px"><h3 style="margin-bottom:12px">Ըստ ոլորտի</h3><div class="bars">' + disc.map(x => '<div class="bar"><span>' + esc(x[0]) + '</span><span class="tr"><i style="width:' + (x[1] / max * 100) + '%"></i></span><b>' + x[1] + "</b></div>").join("") + '</div><p class="muted small" style="margin-top:12px">' + roles.map(r => esc(ROLES[r[0]] || r[0]) + "՝ " + r[1]).join(" · ") + "</p></div>" +
        '<div class="card"><div class="row" style="justify-content:space-between;margin-bottom:8px"><h3>Բոլոր դեպքերը</h3><span class="row"><button class="btn small" id="csv">' + icon("download") + 'CSV</button><button class="btn small" id="plog">' + icon("print") + 'Տպել</button></span></div><div class="scroll"><table class="log stack"><thead><tr><th>Ամսաթիվ</th><th>Կոդ</th><th>Դեպք</th><th>Ոլորտ</th><th>Դեր</th><th>Կարգավիճակ</th><th>%</th></tr></thead><tbody>' +
        all.map(c => '<tr data-id="' + esc(c.id) + '" style="cursor:pointer"><td>' + esc(ISD.fmtShort(c.date)) + "</td><td>" + esc(c.code) + "</td><td>" + esc(c.title || "—") + "</td><td>" + esc(c.discipline) + "</td><td>" + esc(ROLES[c.role] || "") + "</td><td>" + esc(STATUS[c.status] || "") + '</td><td class="num">' + pct(c) + "</td></tr>").join("") + "</tbody></table></div></div>"
        : '<div class="empty card">Գրանցամատյանը լրացվում է ինքնաշխատ, երբ ավելացնում եք դեպքեր։</div>');
    $$("tr[data-id]").forEach(r => r.onclick = () => location.hash = "case-" + r.dataset.id);
    const csv = $("#csv");
    if (csv) {
      csv.onclick = () => {
        const q = v => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
        const rows = [["Ամսաթիվ", "Կոդ", "Դեպք", "Ոլորտ", "Դեր", "Կարգավիճակ", "Ախտորոշում", "Ամբողջականություն %"]].concat(all.map(c => [c.date, c.code, c.title, c.discipline, ROLES[c.role], STATUS[c.status], c.diagnosis, pct(c)]));
        ISD.saveFile(new Blob(["﻿" + rows.map(r => r.map(q).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }), "logbook_" + ISD.today() + ".csv");
      };
      $("#plog").onclick = async () => {
        const prof = (await db.meta("profile", {})) || {};
        $("#print").innerHTML = "<h1>Կլինիկական գրանցամատյան</h1><div class='sub'>" + esc(prof.name || "") + " · " + esc(ISD.fmtDate(ISD.today())) + "</div><table><thead><tr><th>Ամսաթիվ</th><th>Կոդ</th><th>Դեպք</th><th>Ոլորտ</th><th>Դեր</th><th>Կարգավիճակ</th></tr></thead><tbody>" +
          all.map(c => "<tr><td>" + esc(ISD.fmtShort(c.date)) + "</td><td>" + esc(c.code) + "</td><td>" + esc(c.title) + "</td><td>" + esc(c.discipline) + "</td><td>" + esc(ROLES[c.role] || "") + "</td><td>" + esc(STATUS[c.status] || "") + "</td></tr>").join("") + "</tbody></table>";
        printNow();
      };
    }
  }
  function printNow() { $("#app").classList.add("no-print"); setTimeout(() => { print(); $("#app").classList.remove("no-print"); }, 60); }

  /* ---------- CV ---------- */
  const CVS = [
    ["edu", "Կրթություն", "Համալսարան, ֆակուլտետ", "Աստիճան"],
    ["res", "Օրդինատուրա և մասնագիտացում", "Ծրագիր", "Հաստատություն"],
    ["work", "Աշխատանքային փորձ", "Պաշտոն", "Կլինիկա"],
    ["courses", "Դասընթացներ և վերապատրաստում", "Դասընթաց", "Կազմակերպիչ, ժամեր"],
    ["certs", "Վկայականներ և անդամակցություն", "Անվանում", "Կազմակերպություն"],
    ["talks", "Ելույթներ և հրապարակումներ", "Վերնագիր", "Միջոցառում / ամսագիր"],
    ["langs", "Լեզուներ", "Լեզու", "Մակարդակ"],
    ["skills", "Կլինիկական հմտություններ", "Հմտություն", "Համակարգ, տեխնիկա"]
  ];
  let PR = null;
  const saveProfile = ISD.debounce(async () => { await db.setMeta("profile", PR); }, 400);
  async function cvView() {
    PR = Object.assign({ name: "", nameLatin: "", title: "", clinic: "", city: "", email: "", phone: "", about: "", includeLog: true }, (await db.meta("profile", {})) || {});
    CVS.forEach(s => { PR[s[0]] = PR[s[0]] || []; });
    const pf = (k, l, o) => '<label class="f"><span>' + l + "</span>" + (o && o.area ? '<textarea data-p="' + k + '" rows="3">' + esc(PR[k]) + "</textarea>" : '<input type="' + ((o && o.type) || "text") + '" data-p="' + k + '" value="' + esc(PR[k]) + '">') + "</label>";
    app.innerHTML = '<section class="lead"><div><h1>CV</h1><p>Լրացրեք մեկ անգամ, թարմացրեք 6 ամիսը մեկ։ «Ներբեռնել PDF»՝ պատրաստի A4 ֆայլ ձեր հեռախոսում կամ համակարգչում․ ուղարկեք, կցեք դիմումին։ Կլինիկական փորձի թվերը վերցվում են գրանցամատյանից։</p></div><div class="row" style="justify-content:flex-end;gap:8px"><button class="btn" id="pcv">' + icon("print") + 'Տպել</button><button class="btn primary" id="dcv">' + icon("download") + "Ներբեռնել PDF</button></div></section>" +
      '<div class="card cvsec"><h3 style="margin-bottom:12px">Անձնական տվյալներ</h3>' +
      '<div class="cvphoto"><div class="ava" id="ava">' + (PR.photo ? '<img src="' + PR.photo + '" alt="Լուսանկար">' : icon("cv")) + '</div><div><p class="small" style="margin:0 0 8px">Լուսանկար CV-ի համար՝ չեզոք ֆոն, ուսերից վեր</p><div class="row" style="gap:8px"><label class="btn small" for="pfile">' + icon("camera") + (PR.photo ? "Փոխել" : "Վերբեռնել լուսանկար") + '</label>' + (PR.photo ? '<button class="btn small" id="prm">' + icon("trash") + "Հեռացնել</button>" : "") + '</div><input type="file" id="pfile" accept="image/*" hidden></div></div>' +
      '<div class="grid2">' + pf("name", "Անուն Ազգանուն") + pf("nameLatin", "Անունը լատինատառ (անձնագրի պես)") + pf("title", "Մասնագիտացում") + pf("clinic", "Կլինիկա") + pf("city", "Քաղաք") + pf("email", "Էլ. հասցե", { type: "email" }) + pf("phone", "Հեռախոս", { type: "tel" }) + "</div>" + pf("about", "Մասնագիտական ամփոփում (2–3 նախադասություն)", { area: true }) +
      '<label class="switch"><input type="checkbox" id="incl"' + (PR.includeLog ? " checked" : "") + "><span>CV-ում ներառել «Կլինիկական փորձ թվերով» բաժինը գրանցամատյանից</span></label></div>" +
      CVS.map(s => '<div class="card cvsec"><div class="row" style="justify-content:space-between;margin-bottom:10px"><h3>' + s[1] + '</h3><button class="btn small" data-add="' + s[0] + '">' + icon("plus") + "Ավելացնել</button></div><div data-list=\"" + s[0] + '"></div></div>').join("");
    $$("[data-p]").forEach(el => el.oninput = () => { PR[el.dataset.p] = el.value; saveProfile(); });
    $("#incl").onchange = e => { PR.includeLog = e.target.checked; saveProfile(); };
    CVS.forEach(s => drawCvList(s));
    $$("[data-add]").forEach(b => b.onclick = () => { const s = CVS.find(x => x[0] === b.dataset.add); PR[s[0]].push({ what: "", where: "", when: "" }); saveProfile(); drawCvList(s, true); });
    $("#pcv").onclick = printCV;
    $("#dcv").onclick = downloadCV;
    $("#pfile").onchange = async e => {
      const f = e.target.files && e.target.files[0]; if (!f) return;
      try {
        const img = await ISD.decode(f);
        const c = document.createElement("canvas"); c.width = 600; c.height = 750;   // 4:5 portrait
        ISD.drawPhoto(c.getContext("2d"), img, 0, 0, 600, 750, {}, "cover", "#ffffff");
        PR.photo = c.toDataURL("image/jpeg", 0.86);
        await db.setMeta("profile", PR); cvView(); toast("Լուսանկարը պահված է");
      } catch (err) { toast("Չհաջողվեց բացել նկարը"); }
    };
    if ($("#prm")) $("#prm").onclick = async () => { delete PR.photo; await db.setMeta("profile", PR); cvView(); };
  }
  function drawCvList(s, focusLast) {
    const host = $('[data-list="' + s[0] + '"]');
    host.innerHTML = PR[s[0]].length ? PR[s[0]].map((it, i) => '<div class="cvitem"><input class="wide" data-cv="' + i + '" data-k="what" placeholder="' + esc(s[2]) + '" value="' + esc(it.what) + '"><input data-cv="' + i + '" data-k="where" placeholder="' + esc(s[3]) + '" value="' + esc(it.where) + '"><input data-cv="' + i + '" data-k="when" placeholder="Տարի(ներ)" value="' + esc(it.when) + '"><button class="iconbtn" data-cvrm="' + i + '" aria-label="Ջնջել">' + icon("trash") + "</button></div>").join("") : '<p class="muted small">Դեռ դատարկ է</p>';
    $$("[data-cv]", host).forEach(el => el.oninput = () => { PR[s[0]][+el.dataset.cv][el.dataset.k] = el.value; saveProfile(); });
    $$("[data-cvrm]", host).forEach(b => b.onclick = () => { PR[s[0]].splice(+b.dataset.cvrm, 1); saveProfile(); drawCvList(s); });
    if (focusLast) { const ins = $$("input.wide", host); ins.length && ins[ins.length - 1].focus(); }
  }
  async function printCV() {
    await db.setMeta("profile", PR);
    const all = (await db.all("cases")).map(normalize);
    const m = {}; all.filter(c => c.role === "operator").forEach(c => { if (c.discipline) m[c.discipline] = (m[c.discipline] || 0) + 1; });
    const log = Object.entries(m).sort((a, b) => b[1] - a[1]);
    $("#print").innerHTML = (PR.photo ? "<img class='cvph' src='" + PR.photo + "' alt=''>" : "") + "<h1>" + esc(PR.name || "Անուն Ազգանուն") + "</h1><div class='sub'>" + esc([PR.nameLatin, PR.title, PR.clinic, PR.city].filter(Boolean).join(" · ")) + "<br>" + esc([PR.email, PR.phone].filter(Boolean).join(" · ")) + "</div>" +
      (PR.about ? "<p style='font-size:11pt'>" + esc(PR.about) + "</p>" : "") +
      CVS.map(s => PR[s[0]].filter(x => x.what).length ? "<h2>" + s[1] + "</h2>" + PR[s[0]].filter(x => x.what).map(x => "<div class='it'><span class='w'>" + esc(x.when) + "</span><span><b>" + esc(x.what) + "</b>" + (x.where ? ", " + esc(x.where) : "") + "</span></div>").join("") : "").join("") +
      (PR.includeLog && log.length ? "<h2>Կլինիկական փորձ թվերով</h2>" + log.map(x => "<div class='it'><span class='w'>" + x[1] + " դեպք</span><span>" + esc(x[0]) + "</span></div>").join("") + "<p style='font-size:9pt;color:#666'>Ըստ անձնական կլինիկական գրանցամատյանի, " + esc(ISD.fmtDate(ISD.today())) + ".</p>" : "");
    printNow();
  }


  /* ---------- CV → PDF file ---------- */
  async function cvData() {
    await db.setMeta("profile", PR);
    const all = (await db.all("cases")).map(normalize);
    const m = {}; all.filter(c => c.role === "operator").forEach(c => { if (c.discipline) m[c.discipline] = (m[c.discipline] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }
  async function downloadCV() {
    const btn = $("#dcv"); btn.disabled = true; const label = btn.innerHTML; btn.innerHTML = icon("download") + "Պատրաստվում է…";
    try {
      const log = await cvData();
      await loadScript("../assets/vendor/jspdf.umd.min.js", "jspdf");
      await Promise.all(["400 24px NSA", "700 24px NSA", "700 48px NSerif"].map(f => document.fonts.load(f, "Աա Aa 1")));
      const pages = await renderCvPages(log);
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
      pages.forEach((c, i) => { if (i) pdf.addPage(); pdf.addImage(c.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, 210, 297, undefined, "FAST"); });
      pdf.setProperties({ title: "CV — " + (PR.nameLatin || PR.name || ""), author: PR.nameLatin || PR.name || "", creator: "ISD Dental School · Պորտֆոլիո" });
      const name = "CV_" + ISD.safeName(PR.nameLatin || PR.name || "dentist") + ".pdf";
      await ISD.saveFile(pdf.output("blob"), name);
      toast("CV-ն պատրաստ է");
    } catch (e) { console.error(e); toast("Չհաջողվեց ստեղծել PDF․ փորձեք «Տպել»"); }
    finally { btn.disabled = false; btn.innerHTML = label; }
  }
  // A4 at 150 dpi: 1240 × 1754 px; 1 mm ≈ 5.906 px; 1 pt ≈ 2.083 px
  async function renderCvPages(log) {
    const W = 1240, H = 1754, MM = W / 210, PT = 150 / 72, M = Math.round(16 * MM), CW = W - 2 * M;
    const SANS = "NSA, Arial, sans-serif", SERIF = "NSerif, Georgia, serif", RED = "#b8321f";
    const pages = []; let c, x, y;
    const page = () => { c = document.createElement("canvas"); c.width = W; c.height = H; x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, W, H); x.textBaseline = "alphabetic"; pages.push(c); y = M; };
    const font = (w, pt, fam) => { x.font = w + " " + Math.round(pt * PT) + "px " + (fam || SANS); };
    const need = h => { if (y + h > H - M - 30) page(); };
    // word-wrap a list of runs [{t, b}] into lines of runs
    function wrap(runs, maxW, pt) {
      const lines = [[]]; let lw = 0;
      runs.forEach(r => {
        String(r.t).split(/(\s+)/).filter(Boolean).forEach(tok => {
          font(r.b ? 700 : 400, pt); let w = x.measureText(tok).width;
          if (/^\s+$/.test(tok)) { if (lw > 0) { lines[lines.length - 1].push({ t: " ", b: r.b }); lw += x.measureText(" ").width; } return; }
          while (w > maxW) {                       // very long token: cut it
            let k = tok.length; while (k > 1 && x.measureText(tok.slice(0, k)).width > maxW - lw) k--;
            if (lw > 0 && k < 2) { lines.push([]); lw = 0; continue; }
            lines[lines.length - 1].push({ t: tok.slice(0, k), b: r.b }); lines.push([]); lw = 0; tok = tok.slice(k); w = x.measureText(tok).width;
          }
          if (lw + w > maxW && lw > 0) { const L = lines[lines.length - 1]; if (L.length && L[L.length - 1].t === " ") L.pop(); lines.push([]); lw = 0; }
          lines[lines.length - 1].push({ t: tok, b: r.b }); lw += w;
        });
      });
      return lines.filter(l => l.length);
    }
    function drawLines(lines, x0, pt, color, lh) {
      const step = Math.round(pt * PT * (lh || 1.4));
      lines.forEach(L => { need(step); let xx = x0; y += Math.round(pt * PT); L.forEach(r => { font(r.b ? 700 : 400, pt); x.fillStyle = color; x.fillText(r.t, xx, y); xx += x.measureText(r.t).width; }); y += step - Math.round(pt * PT); });
    }
    page();
    // header: photo right, name and contacts left
    const PW = Math.round(32 * MM), PH = Math.round(40 * MM), hasPh = !!PR.photo;
    const textW = hasPh ? CW - PW - Math.round(8 * MM) : CW, top = y;
    if (hasPh) {
      const img = await ISD.decode(await ISD.dataURLToBlob(PR.photo));
      x.save(); const r = 14, px = W - M - PW, py = top;
      x.beginPath(); x.moveTo(px + r, py); x.arcTo(px + PW, py, px + PW, py + PH, r); x.arcTo(px + PW, py + PH, px, py + PH, r); x.arcTo(px, py + PH, px, py, r); x.arcTo(px, py, px + PW, py, r); x.closePath(); x.clip();
      ISD.drawPhoto(x, img, px, py, PW, PH, {}, "cover", "#eee"); x.restore();
    }
    font(700, 26, SERIF); x.fillStyle = "#111";
    wrap([{ t: PR.name || "Անուն Ազգանուն", b: true }], textW, 26).forEach(L => { y += Math.round(26 * PT); x.font = "700 " + Math.round(26 * PT) + "px " + SERIF; x.fillText(L.map(r => r.t).join(""), M, y); y += Math.round(26 * PT * 0.25); });
    y += 10;
    const sub = [PR.nameLatin, PR.title, PR.clinic, PR.city].filter(Boolean).join(" · ");
    if (sub) drawLines(wrap([{ t: sub }], textW, 12), M, 12, "#444", 1.35);
    const con = [PR.email, PR.phone].filter(Boolean).join(" · ");
    if (con) drawLines(wrap([{ t: con }], textW, 12), M, 12, "#444", 1.35);
    y = Math.max(y, hasPh ? top + PH : y) + Math.round(7 * MM);
    if (PR.about) { drawLines(wrap([{ t: PR.about }], CW, 11), M, 11, "#222", 1.45); y += Math.round(2 * MM); }
    const heading = t => {
      need(Math.round(13 * PT * 3)); y += Math.round(5 * MM);
      font(700, 13); x.fillStyle = RED; y += Math.round(13 * PT); x.fillText(t, M, y);
      y += Math.round(2.2 * MM); x.fillStyle = "#dddddd"; x.fillRect(M, y, CW, 2); y += Math.round(3 * MM);
    };
    const WC = Math.round(30 * MM);
    const item = (when, runs) => {
      const lines = wrap(runs, CW - WC, 10.5), step = Math.round(10.5 * PT * 1.4);
      need(step * Math.min(lines.length, 2));
      const y0 = y; font(400, 10.5); x.fillStyle = "#666";
      wrap([{ t: when || "" }], WC - 16, 10.5).slice(0, 2).forEach((L, i) => x.fillText(L.map(r => r.t).join(""), M, y0 + Math.round(10.5 * PT) + i * step));
      drawLines(lines, M + WC, 10.5, "#111", 1.4); y += Math.round(1.2 * MM);
    };
    CVS.forEach(s => {
      const items = PR[s[0]].filter(it => it.what); if (!items.length) return;
      heading(s[1]);
      items.forEach(it => item(it.when, [{ t: it.what, b: true }].concat(it.where ? [{ t: ", " + it.where }] : [])));
    });
    if (PR.includeLog && log.length) {
      heading("Կլինիկական փորձ թվերով");
      log.forEach(e => item(e[1] + " դեպք", [{ t: e[0] }]));
      y += Math.round(1 * MM); drawLines(wrap([{ t: "Ըստ անձնական կլինիկական գրանցամատյանի, " + ISD.fmtDate(ISD.today()) + "։" }], CW, 9), M, 9, "#777", 1.3);
    }
    // footer on every page
    pages.forEach((pc, i) => { const g = pc.getContext("2d"); g.font = "400 " + Math.round(8 * PT) + "px " + SANS; g.fillStyle = "#9aa0a0"; g.textAlign = "right"; g.fillText((PR.nameLatin || PR.name || "") + (pages.length > 1 ? " · " + (i + 1) + "/" + pages.length : ""), W - M, H - Math.round(9 * MM)); });
    return pages;
  }

  /* ---------- more ---------- */
  async function moreView() {
    const st = await ISDSurvey.state();
    let usage = "";
    try { if (navigator.storage && navigator.storage.estimate) { const e = await navigator.storage.estimate(); usage = Math.round((e.usage || 0) / 1048576) + " ՄԲ"; } } catch (e) {}
    app.innerHTML = '<section class="lead"><div><h1>Ավելին</h1><p>Ձեր տվյալները պահվում են միայն այս սարքում։ Պահեստային պատճենը պահեք ամիսը մեկ՝ համակարգչում կամ ամպում։</p></div></section>' +
      '<div class="grid2" style="gap:12px">' +
      '<div class="card"><h3>Պահեստային պատճեն</h3><p class="muted small" style="margin:6px 0 12px">Բոլոր դեպքերը, CV-ն և լուսանկարները մեկ ֆայլում' + (usage ? " · այժմ՝ " + usage : "") + '։ Նույն ֆայլով տվյալները տեղափոխվում են այլ սարք։</p><div class="row"><button class="btn primary" id="bk">' + icon("download") + 'Պահել</button><button class="btn" id="rs">' + icon("upload") + "Վերականգնել</button></div></div>" +
      '<div class="card"><h3>PowerPoint ձևանմուշ</h3><p class="muted small" style="margin:6px 0 12px">Դեպքի ներկայացման դատարկ ձևանմուշ՝ CARE կառուցվածքով և նշումներով յուրաքանչյուր սլայդի համար։</p><a class="btn" href="../assets/ISD_Case_Presentation_Template.pptx" download>' + icon("slides") + "Ներբեռնել</a></div>" +
      '<div class="card"><h3>Ֆոտոարձանագրություն</h3><p class="muted small" style="margin:6px 0 12px">Ստանդարտ շարք (8 կամ 12 կադր), ինքնաշխատ դասավորում և կոլաժ։</p><a class="btn" href="../photo/">' + icon("camera") + "Բացել</a></div>" +
      '<div class="card"><h3>Հարցում</h3><p class="muted small" style="margin:6px 0 12px">' + (st && st.answeredAt ? "Պատասխանել եք " + esc(ISD.fmtDate(new Date(st.answeredAt).toISOString().slice(0, 10))) + (st.consent ? " · ուղարկված է" : " · պահված է միայն սարքում") : "Դեռ չեք պատասխանել") + '</p><button class="btn" id="sv">' + icon("chart") + (st && st.answeredAt ? "Պատասխանել նորից" : "Պատասխանել") + "</button></div>" +
      "</div>" +
      '<div class="card" style="margin-top:12px"><h3>Գաղտնիություն</h3><p class="small" style="margin-top:8px">Բուժառուների տվյալները, լուսանկարները, CV-ն երբեք չեն լքում այս սարքը։ ISD Dental School-ին ուղարկվում են միայն անանուն հարցման պատասխանները և ընդհանուր թվեր (դեպքերի և շարքերի քանակ, ոլորտներ)՝ ձեր համաձայնությամբ։ Հավելվածը օգտագործեք կոդերով, ոչ անուններով։</p><p class="muted tiny" style="margin-top:10px">ISD Dental School · տարբերակ ' + esc((window.ISD_CONFIG || {}).version || "") + "</p></div>";
    $("#bk").onclick = backup;
    $("#rs").onclick = () => $("#restore").click();
    $("#sv").onclick = () => ISDSurvey.open("portfolio", () => moreView());
  }
  async function backup() {
    const note = document.createElement("div"); note.className = "toast"; note.textContent = "Պատրաստվում է…"; document.body.appendChild(note);
    const photos = [];
    for (const p of await db.all("photos")) photos.push(Object.assign({}, p, { blob: await ISD.blobToDataURL(p.blob), thumb: await ISD.blobToDataURL(p.thumb) }));
    const data = { app: "isd-dental", version: 1, exported: new Date().toISOString(), profile: await db.meta("profile", null), cases: await db.all("cases"), series: await db.all("series"), photos };
    note.remove();
    await ISD.saveFile(new Blob([JSON.stringify(data)], { type: "application/json" }), "ISD_backup_" + ISD.today() + ".json");
  }
  $("#restore").onchange = async e => {
    const fl = e.target.files && e.target.files[0]; e.target.value = "";
    if (!fl) return;
    try {
      const data = JSON.parse(await fl.text());
      if (data.app !== "isd-dental") throw new Error("format");
      if (!(await ISD.confirmBox("Վերականգնել " + (data.cases || []).length + " դեպք և " + (data.photos || []).length + " լուսանկար։ Նույն դեպքերը կթարմացվեն։", "Վերականգնել"))) return;
      for (const p of data.photos || []) await db.put("photos", Object.assign({}, p, { blob: await ISD.dataURLToBlob(p.blob), thumb: await ISD.dataURLToBlob(p.thumb) }));
      for (const s of data.series || []) await db.put("series", s);
      for (const c of data.cases || []) await db.put("cases", c);
      if (data.profile) await db.setMeta("profile", data.profile);
      toast("Վերականգնված է"); location.hash = "cases"; route();
    } catch (er) { toast("Ֆայլը չի ճանաչվել"); }
  };

  route();
}
