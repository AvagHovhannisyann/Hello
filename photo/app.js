/* ISD «Ֆոտոարձանագրություն» — standard photo series, auto-placement, mirror correction, one-file export. */
{
  const { db, esc, $, $$, icon, toast } = ISD;
  const P = ISDPhoto;
  const app = $("#app");
  $("#mark").innerHTML = ISD.mark(true);
  ISD.registerSW();
  ISD.persist();

  let cur = null;          // series being edited
  let swapFrom = null;     // slot key picked for moving
  let target = null;       // {key, seq} for the single-file inputs
  const previewCache = new Map();

  const now = () => Date.now();
  const proto = s => P.PROTOCOLS[s.protocol];
  const filledCount = s => proto(s).slots.filter(x => s.slots[x.key] && s.slots[x.key].photoId).length;
  const nextEmpty = s => (proto(s).slots.find(x => !(s.slots[x.key] && s.slots[x.key].photoId)) || {}).key;
  async function save(s) { s.updated = now(); await db.put("series", s); }

  /* ---------- routing ---------- */
  async function route() {
    const h = location.hash.slice(1);
    if (h.startsWith("n-")) {           // new series started from a case in «Պորտֆոլիո»
      const c = await db.get("cases", h.slice(2));
      history.replaceState(null, "", "#");
      await home();
      return newSeries(c);
    }
    if (h.startsWith("s-") || h.startsWith("c-")) {
      const s = await db.get("series", h.slice(2));
      if (s) return h[0] === "s" ? editor(s) : collageView(s);
    }
    home();
  }
  addEventListener("hashchange", () => { swapFrom = null; route(); });

  /* ---------- home ---------- */
  function demoGrid() {
    const b = P.PROTOCOLS.basic8, order = b.layout.flatMap(r => r.cells);
    return order.map((k, i) => k === "@info" ? '<div class="on">' + icon("camera") + "</div>" : '<div class="' + (i % 3 === 1 ? "on" : "") + '">' + P.glyph(P.slotOf("basic8", k).icon) + "</div>").join("");
  }
  async function home() {
    cur = null;
    const list = (await db.all("series")).sort((a, b) => b.updated - a.updated);
    app.innerHTML =
      '<section class="hero"><div><h1>Մեկ շարք՝ մեկ ֆայլ</h1>' +
      "<p>Բեռնեք դեպքի բոլոր լուսանկարները միանգամից։ Հավելվածը դրանք դասավորում է ստանդարտ շարքի իրենց տեղերում, շրջում է հայելային կադրերը և պատրաստում մեկ կոլաժ՝ JPG կամ PDF։</p>" +
      '<div class="row cta"><button class="btn primary" id="new">' + icon("plus") + 'Նոր շարք</button><button class="btn" id="guide">' + icon("info") + "Կադրերի ուղեցույց</button></div></div>" +
      '<div class="demo" aria-hidden="true">' + demoGrid() + "</div></section>" +
      '<div class="sec-h"><h2>Իմ շարքերը</h2><span class="muted small">' + list.length + "</span></div>" +
      (list.length ? '<div class="list">' + list.map(s => {
        const n = filledCount(s), t = proto(s).slots.length;
        return '<button class="ser" data-id="' + esc(s.id) + '"><img class="pv" alt=""><span class="meta"><b>' + esc(s.code || "Առանց կոդի") + '</b><span class="muted small">' + esc(P.stageName(s.stage)) + " · " + esc(ISD.fmtShort(s.date)) + " · " + n + "/" + t + '</span><span class="progress"><i style="width:' + Math.round(n / t * 100) + '%"></i></span></span></button>';
      }).join("") + "</div>" : '<div class="empty card">Դեռ շարք չկա։ Սկսեք «Նոր շարք» կոճակով։</div>') +
      '<p class="muted tiny" style="margin-top:28px;max-width:70ch">Լուսանկարները պահվում են միայն այս սարքում և ոչ մի տեղ չեն ուղարկվում։ Կոլաժը պահեք կամ կցեք դեպքին «Պորտֆոլիո» հավելվածում։</p>';
    $("#new").onclick = newSeries;
    $("#guide").onclick = () => guide("basic8");
    $$(".ser").forEach(b => b.onclick = () => location.hash = "s-" + b.dataset.id);
    const just = sessionStorage.getItem("justSaved");
    if (just) {   // came here from «Պահել շարքը»: show the list, mark the saved series
      sessionStorage.removeItem("justSaved");
      const el = $('.ser[data-id="' + CSS.escape(just) + '"]');
      if (el) { el.classList.add("flash"); requestAnimationFrame(() => el.scrollIntoView({ block: "center", behavior: "smooth" })); }
    }
    for (const s of list) {
      const img = $('.ser[data-id="' + CSS.escape(s.id) + '"] img');
      if (!img || !filledCount(s)) continue;
      const key = s.id + ":" + s.updated;
      if (!previewCache.has(key)) {
        try {
          const c = await P.renderCollage(s, { width: 900, labels: false, getImage: id => ISD.bitmap(id, "thumb") });
          previewCache.set(key, URL.createObjectURL(await ISD.canvasToBlob(c, "image/jpeg", 0.8)));
        } catch (e) { continue; }
      }
      img.src = previewCache.get(key);
    }
    setTimeout(() => ISDSurvey.maybeAsk("photo"), 1200);
    pingStats();
  }

  async function pingStats() {
    const all = await db.all("series");
    ISDSurvey.ping("photo", { series: all.length, photos: all.reduce((a, s) => a + filledCount(s), 0), seriesComplete: all.filter(s => filledCount(s) === proto(s).slots.length).length });
  }

  /* ---------- new / edit series ---------- */
  function seriesForm(s) {
    const isNew = !s;
    s = s || { protocol: "basic8", code: "", stage: "pre", date: ISD.today(), mirrorLateral: true };
    return '<header><div class="grow"><h2>' + (isNew ? "Նոր շարք" : "Շարքի տվյալներ") + '</h2></div><button class="iconbtn" data-x aria-label="Փակել">' + icon("close") + "</button></header>" +
      '<form id="sf">' +
      (isNew ? '<div class="proto">' + Object.values(P.PROTOCOLS).map(p => '<label><input type="radio" name="protocol" value="' + p.id + '"' + (p.id === s.protocol ? " checked" : "") + '><span><b>' + esc(p.name) + '</b><br><span class="muted small">' + esc(p.desc) + "</span></span></label>").join("") + "</div>" : "") +
      '<label class="f"><span>Բուժառուի կոդ</span><input type="text" name="code" value="' + esc(s.code) + '" placeholder="օր.՝ P-2026-014" autocomplete="off"><small>Անուն մի գրեք։ Կոդը կապում է շարքը դեպքի հետ։</small></label>' +
      '<div class="grid2"><label class="f"><span>Փուլ</span><select name="stage">' + P.STAGES.map(x => '<option value="' + x.id + '"' + (x.id === s.stage ? " selected" : "") + ">" + esc(x.name) + "</option>").join("") + '</select></label><label class="f"><span>Ամսաթիվ</span><input type="date" name="date" value="' + esc(s.date) + '"></label></div>' +
      '<label class="switch"><input type="checkbox" name="mirrorLateral"' + (s.mirrorLateral !== false ? " checked" : "") + '><span>Կողմնային կադրերը արվում են կողմնային հայելով (հավելվածը դրանք կշրջի)։ Օկլյուզիոն կադրերը միշտ շրջվում են։</span></label>' +
      '<div class="row" style="justify-content:space-between">' + (isNew ? "<span></span>" : '<button type="button" class="btn ghost" data-del style="color:var(--accent)">' + icon("trash") + "Ջնջել շարքը</button>") + '<button class="btn primary">' + (isNew ? "Ստեղծել" : "Պահել") + "</button></div></form>";
  }
  function newSeries(forCase) {
    forCase = forCase && forCase.id ? forCase : null;
    const sh = ISD.sheet(seriesForm(null));
    sh.el.querySelector("[data-x]").onclick = sh.close;
    if (forCase && forCase.code) sh.el.querySelector('[name="code"]').value = forCase.code;
    sh.el.querySelector("#sf").onsubmit = async e => {
      e.preventDefault();
      const f = new FormData(e.target);
      const s = { id: ISD.uid(), protocol: f.get("protocol") || "basic8", code: (f.get("code") || "").trim(), stage: f.get("stage"), date: f.get("date") || ISD.today(), mirrorLateral: !!f.get("mirrorLateral"), slots: {}, extras: [], created: now(), updated: now(), caseId: forCase ? forCase.id : null };
      await db.put("series", s);
      if (forCase) { forCase.seriesIds = Array.from(new Set((forCase.seriesIds || []).concat(s.id))); forCase.updated = now(); await db.put("cases", forCase); }
      sh.close();
      location.hash = "s-" + s.id;
    };
  }
  function editSeries(s) {
    const sh = ISD.sheet(seriesForm(s));
    sh.el.querySelector("[data-x]").onclick = sh.close;
    sh.el.querySelector("[data-del]").onclick = async () => {
      if (!(await ISD.confirmBox("Ջնջե՞լ շարքը և դրա լուսանկարները այս սարքից։", "Ջնջել"))) return;
      const ids = Object.values(s.slots).map(a => a.photoId).concat(s.extras);
      for (const id of ids) await db.del("photos", id);
      await db.del("series", s.id);
      sh.close(); location.hash = "";
    };
    sh.el.querySelector("#sf").onsubmit = async e => {
      e.preventDefault();
      const f = new FormData(e.target), ml = !!f.get("mirrorLateral");
      if (ml !== (s.mirrorLateral !== false)) {
        proto(s).slots.filter(x => x.optionalMirror).forEach(x => { const a = s.slots[x.key]; if (a && a.photoId) Object.assign(a, P.defaultTransform(x, ml)); });
      }
      Object.assign(s, { code: (f.get("code") || "").trim(), stage: f.get("stage"), date: f.get("date") || s.date, mirrorLateral: ml });
      await save(s); sh.close(); editor(s);
    };
  }

  /* ---------- editor ---------- */
  function slotHTML(s, sl, i, nextKey) {
    const a = s.slots[sl.key], filled = !!(a && a.photoId);
    const mirrorOn = sl.mirror && (!sl.optionalMirror || s.mirrorLateral !== false);
    return '<button class="slot' + (filled ? " filled" : "") + (sl.key === nextKey && !swapFrom ? " next" : "") + (swapFrom === sl.key ? " picked" : "") + '" data-k="' + sl.key + '">' +
      '<span class="ph">' + (filled ? "<canvas></canvas>" : P.glyph(sl.icon)) + '<span class="n">' + (i + 1) + "</span>" + (filled ? '<span class="ok">' + icon("check") + "</span>" : "") + "</span>" +
      '<span class="cap">' + esc(sl.short) + "<small>" + esc(sl.mag) + (mirrorOn ? " · հայելի" : "") + "</small></span></button>";
  }
  async function paint(canvas, photoId, t, fit) {
    const img = await ISD.bitmap(photoId, "thumb");
    if (!img) return;
    const r = canvas.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(r.width * dpr)); canvas.height = Math.max(1, Math.round(r.height * dpr));
    ISD.drawPhoto(canvas.getContext("2d"), img, 0, 0, canvas.width, canvas.height, t, fit, "#151a1c");
  }
  async function editor(s) {
    cur = s;
    const pr = proto(s), n = filledCount(s), nextKey = nextEmpty(s);
    app.innerHTML =
      '<div class="ed-head"><a class="iconbtn" href="#" aria-label="Բոլոր շարքերը">' + icon("back") + '</a><div class="t"><b>' + esc(s.code || "Առանց կոդի") + '</b><div class="muted small">' + esc(P.stageName(s.stage)) + " · " + esc(ISD.fmtDate(s.date)) + " · " + esc(pr.name) + "</div></div>" +
      '<button class="btn" id="edit">' + icon("edit") + 'Տվյալներ</button><button class="btn primary" id="collage"' + (n ? "" : " disabled") + ">" + icon("grid") + "Կոլաժ · " + n + "/" + pr.slots.length + "</button></div>" +
      (swapFrom ? '<div class="swapbar"><span class="grow">Ընտրեք տեղը՝ «' + esc(P.slotOf(s.protocol, swapFrom).short) + '» կադրը տեղափոխելու համար</span><button class="btn small" id="cancel-swap">Չեղարկել</button></div>' : "") +
      '<div class="tools"><button class="btn" id="many">' + icon("upload") + 'Բեռնել բոլորը միասին</button><button class="btn" id="seq"' + (nextKey ? "" : " disabled") + ">" + icon("camera") + 'Լուսանկարել հերթով</button><button class="btn ghost" id="guide">' + icon("info") + "Ուղեցույց</button></div>" +
      '<p class="hint">Ընտրված լուսանկարները դասավորվում են ըստ նկարահանման ժամի՝ <b>1 → ' + pr.slots.length + "</b> հերթականությամբ։ Նկարեք նույն հերթով, և ամեն կադր կհայտնվի իր տեղում։ Սխալ տեղում հայտնված կադրին հպեք → «Տեղափոխել»։</p>" +
      '<div class="slots">' + pr.slots.map((sl, i) => slotHTML(s, sl, i, nextKey)).join("") + "</div>" +
      (s.extras.length ? '<div class="sec-h"><h3>Չդասավորված · ' + s.extras.length + '</h3><span class="muted small">Հպեք՝ տեղ ընտրելու համար</span></div><div class="tray">' + s.extras.map(id => '<button data-x="' + esc(id) + '" aria-label="Չդասավորված լուսանկար"><canvas></canvas></button>').join("") + "</div>" : "") +
      '<div class="savebar"><button class="btn primary" id="save">' + icon("check") + "Պահել շարքը</button></div>";

    $("#edit").onclick = () => editSeries(s);
    $("#collage").onclick = () => location.hash = "c-" + s.id;
    $("#save").onclick = async () => {
      await save(s);
      const n2 = filledCount(s);
      toast("Շարքը պահված է · " + n2 + "/" + pr.slots.length + " կադր");
      sessionStorage.setItem("justSaved", s.id);
      location.hash = "";
    };
    $("#many").onclick = () => $("#pick-many").click();
    $("#seq").onclick = () => { const k = nextEmpty(s); if (k) { target = { key: k, seq: true }; $("#shoot").click(); } };
    $("#guide").onclick = () => guide(s.protocol);
    if (swapFrom) $("#cancel-swap").onclick = () => { swapFrom = null; editor(s); };
    $$(".slot").forEach(b => b.onclick = () => onSlot(b.dataset.k));
    $$(".tray button").forEach(b => b.onclick = () => onExtra(b.dataset.x));
    requestAnimationFrame(() => {
      $$(".slot.filled").forEach(b => { const sl = P.slotOf(s.protocol, b.dataset.k), a = s.slots[sl.key]; paint(b.querySelector("canvas"), a.photoId, a, sl.kind === "extra" ? "contain" : "cover"); });
      $$(".tray button").forEach(b => paint(b.querySelector("canvas"), b.dataset.x, {}, "cover"));
    });
  }

  async function onSlot(key) {
    const s = cur;
    if (swapFrom) {
      if (swapFrom !== key) {
        const a = s.slots[swapFrom], b = s.slots[key];
        const sa = P.slotOf(s.protocol, swapFrom), sb = P.slotOf(s.protocol, key);
        if (a && a.photoId) s.slots[key] = Object.assign({ photoId: a.photoId }, P.defaultTransform(sb, s.mirrorLateral !== false)); else delete s.slots[key];
        if (b && b.photoId) s.slots[swapFrom] = Object.assign({ photoId: b.photoId }, P.defaultTransform(sa, s.mirrorLateral !== false)); else delete s.slots[swapFrom];
        await save(s);
      }
      swapFrom = null; return editor(s);
    }
    slotSheet(key);
  }

  function slotSheet(key) {
    const s = cur, sl = P.slotOf(s.protocol, key), idx = proto(s).slots.indexOf(sl) + 1;
    const a = s.slots[key], filled = !!(a && a.photoId);
    const extras = s.extras;
    const sh = ISD.sheet(
      '<header><div class="grow"><span class="badge accent">' + idx + " · " + esc(sl.mag) + '</span><h2 style="margin-top:8px">' + esc(sl.name) + '</h2></div><button class="iconbtn" data-x aria-label="Փակել">' + icon("close") + "</button></header>" +
      (filled ? '<canvas class="big" id="bigc"></canvas>' : '<div class="big" style="display:grid;place-items:center;color:var(--ink-3);background:var(--field)"><span style="width:46%">' + P.glyph(sl.icon) + "</span></div>") +
      (filled ? '<div class="acts"><button class="btn" data-t="flipH">' + icon("flipH") + 'Շրջել ↔</button><button class="btn" data-t="flipV">' + icon("flipV") + 'Շրջել ↕</button><button class="btn" data-t="rot">' + icon("rotate") + 'Պտտել</button><button class="btn" data-move>' + icon("swap") + "Տեղափոխել</button></div>" : "") +
      '<p class="hint" style="margin-top:12px">' + esc(sl.tip) + "</p>" +
      '<div class="row"><button class="btn primary" data-shoot>' + icon("camera") + (filled ? "Նկարել նորից" : "Լուսանկարել") + '</button><button class="btn" data-pick>' + icon("image") + "Ընտրել ֆայլ</button>" + (filled ? '<button class="btn ghost" data-remove>' + icon("trash") + "Հանել</button>" : "") + "</div>" +
      (!filled && extras.length ? '<hr class="s"><h3 style="margin-bottom:10px">Ընտրել չդասավորվածներից</h3><div class="tray">' + extras.map(id => '<button data-use="' + esc(id) + '"><canvas></canvas></button>').join("") + "</div>" : ""),
      { onClose: () => { if (cur === s && !location.hash.startsWith("#c-")) editor(s); } }
    );
    const el = sh.el;
    el.querySelector("[data-x]").onclick = sh.close;
    const redraw = () => { const c = el.querySelector("#bigc"); if (c) paintFull(c, s.slots[key]); };
    if (filled) requestAnimationFrame(redraw);
    $$("[data-t]", el).forEach(b => b.onclick = async () => {
      const t = s.slots[key];
      if (b.dataset.t === "rot") t.rot = ((t.rot || 0) + 1) % 4; else t[b.dataset.t] = !t[b.dataset.t];
      await save(s); redraw();
    });
    const mv = el.querySelector("[data-move]"); if (mv) mv.onclick = () => { swapFrom = key; sh.close(); };
    el.querySelector("[data-shoot]").onclick = () => { target = { key }; sh.close(); $("#shoot").click(); };
    el.querySelector("[data-pick]").onclick = () => { target = { key }; sh.close(); $("#pick-one").click(); };
    const rm = el.querySelector("[data-remove]");
    if (rm) rm.onclick = async () => { s.extras.unshift(s.slots[key].photoId); delete s.slots[key]; await save(s); sh.close(); };
    $$("[data-use]", el).forEach(b => {
      paint(b.querySelector("canvas"), b.dataset.use, {}, "cover");
      b.onclick = async () => { s.extras = s.extras.filter(x => x !== b.dataset.use); assign(s, key, b.dataset.use); await save(s); sh.close(); };
    });
  }
  async function paintFull(c, a) {
    const img = await ISD.bitmap(a.photoId, "full"); if (!img) return;
    const r = c.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr);
    ISD.drawPhoto(c.getContext("2d"), img, 0, 0, c.width, c.height, a, "contain", "#000");
  }

  function onExtra(id) {
    const s = cur, empties = proto(s).slots.filter(x => !(s.slots[x.key] && s.slots[x.key].photoId));
    const sh = ISD.sheet('<header><div class="grow"><h2>Որտե՞ղ տեղադրել</h2></div><button class="iconbtn" data-x aria-label="Փակել">' + icon("close") + '</button></header><canvas class="big" id="exc"></canvas><div class="chips" style="margin:14px 0">' +
      proto(s).slots.map(x => '<button class="chip" data-k="' + x.key + '">' + esc(x.short) + (empties.includes(x) ? "" : " ●") + "</button>").join("") +
      '</div><div class="row" style="justify-content:space-between"><span class="muted small">● — տեղը զբաղված է, առկա կադրը կտեղափոխվի չդասավորվածների մեջ</span><button class="btn ghost" data-del style="color:var(--accent)">' + icon("trash") + "Ջնջել</button></div>");
    requestAnimationFrame(() => paintFull(sh.el.querySelector("#exc"), { photoId: id }));
    sh.el.querySelector("[data-x]").onclick = sh.close;
    $$("[data-k]", sh.el).forEach(b => b.onclick = async () => { s.extras = s.extras.filter(x => x !== id); assign(s, b.dataset.k, id); await save(s); sh.close(); editor(s); });
    sh.el.querySelector("[data-del]").onclick = async () => { s.extras = s.extras.filter(x => x !== id); await db.del("photos", id); await save(s); sh.close(); editor(s); };
  }

  /* put a photo into a slot; a photo already there goes back to the tray */
  function assign(s, key, photoId) {
    const old = s.slots[key];
    if (old && old.photoId && old.photoId !== photoId) s.extras.unshift(old.photoId);
    s.slots[key] = Object.assign({ photoId }, P.defaultTransform(P.slotOf(s.protocol, key), s.mirrorLateral !== false));
  }

  async function importFiles(files) {
    const out = [];
    let i = 0;
    const note = document.createElement("div"); note.className = "toast"; document.body.appendChild(note);
    for (const f of files) {
      i++; note.textContent = "Մշակվում է " + i + "/" + files.length + "…";
      try { out.push(await ISD.importPhoto(f)); } catch (e) { toast("Չհաջողվեց կարդալ «" + (f.name || "ֆայլ") + "»"); }
    }
    note.remove();
    return out;
  }

  $("#pick-many").onchange = async e => {
    const s = cur, files = Array.from(e.target.files || []); e.target.value = "";
    if (!s || !files.length) return;
    const recs = (await importFiles(files)).sort((a, b) => a.takenAt - b.takenAt);
    const empties = proto(s).slots.filter(x => !(s.slots[x.key] && s.slots[x.key].photoId));
    let placed = 0;
    recs.forEach(r => { const sl = empties.shift(); if (sl) { assign(s, sl.key, r.id); placed++; } else s.extras.push(r.id); });
    await save(s); editor(s);
    toast(placed + " կադր դասավորվեց" + (recs.length > placed ? " · " + (recs.length - placed) + "-ը՝ չդասավորվածների մեջ" : ""));
  };
  async function single(e) {
    const s = cur, f = e.target.files && e.target.files[0]; e.target.value = "";
    if (!s || !f || !target) return;
    const t = target; target = null;
    const [r] = await importFiles([f]);
    if (!r) return;
    assign(s, t.key, r.id); await save(s); editor(s);
    if (t.seq) {
      const k = nextEmpty(s);
      if (!k) { toast("Շարքն ամբողջական է"); return; }
      const sl = P.slotOf(s.protocol, k), sh = ISD.sheet('<header><div class="grow"><span class="badge ok">' + icon("check") + ' Պահված է</span><h2 style="margin-top:10px">Հաջորդը՝ ' + esc(sl.name) + '</h2></div></header><div style="width:40%;margin:0 auto 10px;color:var(--ink-3)">' + P.glyph(sl.icon) + '</div><p class="hint">' + esc(sl.tip) + '</p><div class="row" style="justify-content:flex-end"><button class="btn" data-stop>Դադար</button><button class="btn primary" data-go>' + icon("camera") + "Լուսանկարել</button></div>");
      sh.el.querySelector("[data-stop]").onclick = sh.close;
      sh.el.querySelector("[data-go]").onclick = () => { target = { key: k, seq: true }; sh.close(); $("#shoot").click(); };
    }
  }
  $("#pick-one").onchange = single;
  $("#shoot").onchange = single;

  /* ---------- guide ---------- */
  function guide(pid) {
    const pr = P.PROTOCOLS[pid] || P.PROTOCOLS.basic8;
    const sh = ISD.sheet('<header><div class="grow"><h2>Կադրերի ուղեցույց</h2><p class="muted small" style="margin-top:6px">' + esc(pr.name) + '</p></div><button class="iconbtn" data-x aria-label="Փակել">' + icon("close") + "</button></header>" +
      '<div class="hint"><b>Կարգավորումներ (DSLR / mirrorless)։</b> Manual, ISO 100–200, 1/125–1/200 վ։ Ներբերանային՝ f/22–f/32, ֆլեշ TTL, ֆոկուսը՝ խցիկը առաջ-հետ շարժելով։ Արտաբերանային՝ f/8–f/11, միագույն ֆոն։</div>' +
      '<div class="chips" style="margin-bottom:14px">' + Object.values(P.PROTOCOLS).map(p => '<button class="chip" data-p="' + p.id + '"' + (p.id === pr.id ? ' style="background:var(--ink);color:var(--paper)"' : "") + ">" + esc(p.name) + "</button>").join("") + "</div>" +
      pr.slots.map((sl, i) => '<div style="display:grid;grid-template-columns:72px minmax(0,1fr);gap:12px;align-items:start;padding:10px 0;border-top:1px solid var(--line)"><div style="color:var(--accent)">' + P.glyph(sl.icon) + '</div><div><b>' + (i + 1) + ". " + esc(sl.name) + '</b> <span class="badge">' + esc(sl.mag) + '</span><p class="small muted" style="margin-top:4px">' + esc(sl.tip) + "</p></div></div>").join(""));
    sh.el.querySelector("[data-x]").onclick = sh.close;
    $$("[data-p]", sh.el).forEach(b => b.onclick = () => { sh.close(); guide(b.dataset.p); });
  }

  /* ---------- collage ---------- */
  async function doctorName() { const p = await db.meta("profile", null); return p && p.name ? p.name : ""; }
  async function collageView(s) {
    cur = s;
    const labels = (await db.meta("collageLabels", true)) !== false;
    app.innerHTML = '<div class="ed-head"><a class="iconbtn" href="#s-' + esc(s.id) + '" aria-label="Վերադառնալ շարքին">' + icon("back") + '</a><div class="t"><b>Կոլաժ</b><div class="muted small">' + esc(s.code || "Առանց կոդի") + " · " + esc(P.stageName(s.stage)) + '</div></div></div>' +
      '<div class="tools"><button class="btn primary" id="jpg">' + icon("download") + 'JPG</button><button class="btn" id="pdf">' + icon("file") + 'PDF</button><button class="btn" id="attach">' + icon("link") + 'Կցել դեպքին</button><label class="btn ghost"><input type="checkbox" id="lab"' + (labels ? " checked" : "") + ' style="accent-color:var(--accent);width:18px;height:18px"> Անվանումներ</label></div>' +
      '<p class="muted small" id="wait">Պատրաստվում է…</p><img class="collage-img" id="cimg" alt="Լուսանկարների կոլաժ">' +
      (s.caseId ? '<p class="small" style="margin-top:12px">Կցված է դեպքին։ <a href="../portfolio/#case-' + esc(s.caseId) + '">Բացել «Պորտֆոլիո»-ում</a></p>' : "");
    let canvas = null;
    const render = async () => {
      $("#wait").hidden = false;
      canvas = await P.renderCollage(s, { width: 3000, labels: $("#lab").checked, doctor: await doctorName() });
      const blob = await ISD.canvasToBlob(canvas, "image/jpeg", 0.92);
      $("#cimg").src = URL.createObjectURL(blob);
      $("#wait").hidden = true;
    };
    await render();
    const fname = ext => ISD.safeName([s.code || "series", s.stage, s.date].join("_")) + "." + ext;
    $("#lab").onchange = async e => { await db.setMeta("collageLabels", e.target.checked); render(); };
    $("#jpg").onclick = async () => { await ISD.saveFile(await ISD.canvasToBlob(canvas, "image/jpeg", 0.92), fname("jpg")); };
    $("#pdf").onclick = async () => {
      const { jsPDF } = window.jspdf;
      const land = canvas.width > canvas.height, pdf = new jsPDF({ orientation: land ? "landscape" : "portrait", unit: "mm", format: "a4" });
      const pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight(), m = 8;
      const r = Math.min((pw - 2 * m) / canvas.width, (ph - 2 * m) / canvas.height), w = canvas.width * r, h = canvas.height * r;
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", (pw - w) / 2, (ph - h) / 2, w, h);
      await ISD.saveFile(pdf.output("blob"), fname("pdf"));
    };
    $("#attach").onclick = () => attachToCase(s);
  }

  async function attachToCase(s) {
    const cases = (await db.all("cases")).sort((a, b) => (b.updated || 0) - (a.updated || 0));
    const sh = ISD.sheet('<header><div class="grow"><h2>Կցել դեպքին</h2><p class="muted small" style="margin-top:6px">Շարքը կհայտնվի «Պորտֆոլիո» հավելվածի դեպքի քարտում և PowerPoint-ում։</p></div><button class="iconbtn" data-x aria-label="Փակել">' + icon("close") + "</button></header>" +
      '<button class="btn primary block" data-new>' + icon("plus") + "Նոր դեպք" + (s.code ? "՝ " + esc(s.code) : "") + "</button>" +
      (cases.length ? '<div style="display:grid;gap:8px;margin-top:14px">' + cases.map(c => '<button class="btn block" style="justify-content:flex-start" data-c="' + esc(c.id) + '"><b>' + esc(c.code || "—") + '</b><span class="muted">' + esc(c.title || "Անվերնագիր դեպք") + "</span></button>").join("") + "</div>" : ""));
    sh.el.querySelector("[data-x]").onclick = sh.close;
    const link = async c => {
      c.seriesIds = Array.from(new Set((c.seriesIds || []).concat(s.id)));
      c.updated = now(); await db.put("cases", c);
      s.caseId = c.id; await save(s);
      sh.close(); toast("Կցված է դեպքին"); collageView(s);
    };
    sh.el.querySelector("[data-new]").onclick = () => link({ id: ISD.uid(), code: s.code, title: "", created: now(), updated: now(), date: s.date, seriesIds: [] });
    $$("[data-c]", sh.el).forEach(b => b.onclick = async () => link(await db.get("cases", b.dataset.c)));
  }

  route();
}
