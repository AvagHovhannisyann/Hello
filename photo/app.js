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


  /* ---------- case album: finished work, by treatment type, to show patients ---------- */
  const VIEWS = [["frontal", ["frontal", "retrF"], "Առջևից"], ["smile", ["smile", "smileF"], "Ժպիտ"], ["ant", ["antF"], "Առջևի ատամներ"], ["occU", ["occU"], "Վերին ծնոտ"], ["occL", ["occL"], "Ստորին ծնոտ"],
    ["latR", ["latR", "retrR"], "Աջ կողմ"], ["latL", ["latL", "retrL"], "Ձախ կողմ"], ["face", ["face"], "Դեմք"], ["profile", ["profile"], "Պրոֆիլ"]];
  const isFaceSlot = sl => sl.icon === "face" || sl.icon === "profile";
  const facesOn = () => localStorage.getItem("album-faces") === "1";
  const pick = (s, keys) => { for (const k of keys) { const a = s.slots && s.slots[k]; if (a && a.photoId) return { a, sl: P.slotOf(s.protocol, k) }; } return null; };
  let albumCache = null;
  async function albumGroups() {
    const [series, cases] = await Promise.all([db.all("series"), db.all("cases")]);
    const byCase = new Map(cases.map(c => [c.id, c])), g = new Map();
    series.filter(s => filledCount(s) > 0).forEach(s => {
      const c = s.caseId && byCase.get(s.caseId);
      const key = c ? "c:" + c.id : s.code ? "p:" + s.code.trim().toLowerCase() : "s:" + s.id;
      if (!g.has(key)) g.set(key, { key, series: [], case: c || null });
      g.get(key).series.push(s);
    });
    const out = [...g.values()].map(x => {
      x.series.sort((a, b) => (a.date || "").localeCompare(b.date || "") || a.created - b.created);
      x.code = (x.series.find(s => s.code) || {}).code || "";
      x.title = (x.case && x.case.title) || x.code || "Առանց կոդի";
      x.cat = x.series.map(s => s.category).find(Boolean) || (x.case ? P.catFromDisc(x.case.discipline) : "") || "";
      x.pre = x.series.find(s => s.stage === "pre") || x.series[0];
      x.post = [...x.series].reverse().find(s => s !== x.pre && (s.stage === "post" || s.stage === "fu")) || null;
      x.n = x.series.reduce((a, s) => a + filledCount(s), 0);
      x.updated = Math.max(...x.series.map(s => s.updated || 0));
      return x;
    }).sort((a, b) => b.updated - a.updated);
    albumCache = out;
    return out;
  }
  async function albumView() {
    cur = null;
    const visible = x => x.series.some(s => proto(s).slots.some(sl => s.slots[sl.key] && s.slots[sl.key].photoId && (facesOn() || !isFaceSlot(sl))));
    const groups = (await albumGroups()).filter(visible);
    let cat = sessionStorage.getItem("album-cat") || "";
    const count = id => groups.filter(x => (id === "none" ? !x.cat : x.cat === id)).length;
    if (cat && !count(cat)) cat = "";
    const chips = [["", "Բոլորը", groups.length]].concat(P.CATEGORIES.map(c => [c.id, c.name, count(c.id)]).filter(c => c[2])).concat(count("none") ? [["none", "Չդասակարգված", count("none")]] : []);
    const shown = groups.filter(x => !cat || (cat === "none" ? !x.cat : x.cat === cat));
    const cdef = P.CATEGORIES.find(c => c.id === cat);
    app.innerHTML =
      '<div class="ed-head"><a class="iconbtn" href="#" aria-label="Գլխավոր">' + icon("back") + '</a><div class="t"><b>Դեպքերի ալբոմ</b><div class="muted small">' + (cdef ? esc(cdef.sub) : "Ձեր ավարտված աշխատանքները՝ ըստ բուժման տեսակի") + "</div></div>" +
      (shown.length ? '<button class="btn" id="albpdf">' + icon("file") + "PDF ալբոմ</button>" : "") + "</div>" +
      '<div class="acats" role="tablist">' + chips.map(c => '<button role="tab" data-cat="' + c[0] + '" aria-selected="' + (c[0] === cat) + '">' + esc(c[1]) + " <i>" + c[2] + "</i></button>").join("") + "</div>" +
      '<label class="switch faces"><input type="checkbox" id="faces"' + (facesOn() ? " checked" : "") + '><span>Ցույց տալ դեմքի և պրոֆիլի կադրերը <span class="muted small">(միայն բուժառուի համաձայնությամբ)</span></span></label>' +
      (count("none") && cat !== "none" ? '<p class="hint">Որոշ շարքեր դեռ դասակարգված չեն։ Բացեք շարքը → «Տվյալներ» → «Բուժման տեսակ»։</p>' : "") +
      (shown.length ? '<div class="albgrid">' + shown.map(x => '<button class="alb" data-g="' + esc(x.key) + '"><span class="cov"><canvas></canvas>' + (x.pre && x.post ? '<span class="ba">Նախքան · Հետո</span>' : "") + '</span><span class="meta">' + (x.cat ? '<span class="cat">' + esc(P.catName(x.cat)) + "</span>" : "") + "<b>" + esc(x.title) + '</b><span class="muted small">' + esc(x.series.map(s => P.stageName(s.stage)).filter((v, i, a) => a.indexOf(v) === i).join(" → ")) + " · " + x.n + ' կադր</span></span><span class="play">' + icon("play") + "</span></button>").join("") + "</div>"
        : '<div class="empty card">' + (groups.length ? "Այս բաժնում դեպք չկա։" : "Ալբոմը դեռ դատարկ է։ Ստեղծեք շարք, ավելացրեք լուսանկարներ և ընտրեք բուժման տեսակը։") + "</div>");
    $$(".acats button").forEach(b => b.onclick = () => { sessionStorage.setItem("album-cat", b.dataset.cat); albumView(); });
    $("#faces").onchange = e => { localStorage.setItem("album-faces", e.target.checked ? "1" : "0"); albumView(); };
    $$(".alb").forEach(b => b.onclick = () => { location.hash = "album/" + encodeURIComponent(b.dataset.g); });
    if ($("#albpdf")) $("#albpdf").onclick = () => albumPDF(shown, cdef ? cdef.name : cat === "none" ? "Չդասակարգված" : "Բոլոր դեպքերը");
    for (const x of shown) {   // covers: before | after split when both exist
      const cv = $('.alb[data-g="' + CSS.escape(x.key) + '"] canvas'); if (!cv) continue;
      try { await drawCover(cv, x); } catch (e) {}
    }
  }
  function coverPick(s) {
    const order = facesOn() ? ["frontal", "smile", "ant", "occU", "face"] : ["frontal", "smile", "ant", "occU", "occL"];
    for (const v of order) { const r = pick(s, VIEWS.find(q => q[0] === v)[1]); if (r) return r; }
    const sl = proto(s).slots.find(q => s.slots[q.key] && s.slots[q.key].photoId && (facesOn() || !isFaceSlot(q)));
    return sl ? { a: s.slots[sl.key], sl } : null;
  }
  async function drawCover(cv, x) {
    const W = 720, H = 480; cv.width = W; cv.height = H; const g = cv.getContext("2d");
    g.fillStyle = "#151a1c"; g.fillRect(0, 0, W, H);
    const draw = async (r, x0, w) => { if (!r) return; const img = await ISD.bitmap(r.a.photoId, "thumb"); if (img) ISD.drawPhoto(g, img, x0, 0, w, H, r.a, "cover", "#151a1c"); };
    if (x.pre && x.post) {
      let rb = null, ra = null;
      for (const v of VIEWS) { if (!facesOn() && (v[0] === "face" || v[0] === "profile")) continue; const b = pick(x.pre, v[1]), a = pick(x.post, v[1]); if (b && a) { rb = b; ra = a; break; } }
      if (!rb) { rb = coverPick(x.pre); ra = coverPick(x.post); }
      await draw(rb, 0, W / 2); await draw(ra, W / 2, W / 2);
      g.fillStyle = "#0b0e0f"; g.fillRect(W / 2 - 2, 0, 4, H);
    } else await draw(coverPick(x.post || x.series[x.series.length - 1]), 0, W);
  }

  /* slides of one case, shared by the viewer and the PDF */
  function caseSlides(x) {
    const out = [{ type: "title" }];
    if (x.pre && x.post) VIEWS.forEach(v => {
      if (!facesOn() && (v[0] === "face" || v[0] === "profile")) return;
      const b = pick(x.pre, v[1]), a = pick(x.post, v[1]);
      if (b && a) out.push({ type: "cmp", label: v[2], b, a });
    });
    x.series.forEach(s => proto(s).slots.forEach(sl => {
      const a = s.slots[sl.key]; if (!(a && a.photoId)) return;
      if (!facesOn() && isFaceSlot(sl)) return;
      out.push({ type: "photo", s, sl, a });
    }));
    return out;
  }
  const imgCache = new Map();
  async function slideImg(r, max) {
    const k = r.a.photoId + "|" + (max || 2000) + "|" + JSON.stringify([r.a.rot, r.a.flipH, r.a.flipV]);
    if (!imgCache.has(k)) imgCache.set(k, ISD.correctedDataURL(r.a.photoId, r.a, max || 2000));
    return imgCache.get(k);
  }

  async function openViewer(key) {
    if (!albumCache) await albumGroups();
    const x = albumCache.find(g => g.key === key); if (!x) { location.hash = "album"; return; }
    const prof = (await db.meta("profile", {})) || {};
    const slides = caseSlides(x); let i = 0;
    const v = document.createElement("div"); v.className = "viewer"; v.setAttribute("role", "dialog"); v.setAttribute("aria-label", x.title);
    v.innerHTML = '<div class="vtop"><div class="vt"><span class="cat">' + esc(P.catName(x.cat) || "Դեպք") + "</span><b>" + esc(x.title) + '</b></div><span class="vc" id="vc"></span><button class="iconbtn" id="vpdf" aria-label="PDF">' + icon("file") + '</button><button class="iconbtn" id="vx" aria-label="Փակել">' + icon("close") + "</button></div>" +
      '<div class="vstage" id="vs"></div><button class="vnav prev" id="vp" aria-label="Նախորդ">' + icon("back") + '</button><button class="vnav nextb" id="vn" aria-label="Հաջորդ">' + icon("next") + "</button>" +
      '<div class="vdots" id="vd">' + slides.map((_, k) => "<i data-k=\"" + k + "\"></i>").join("") + "</div>";
    document.body.appendChild(v); document.documentElement.style.overflow = "hidden";
    const stage = v.querySelector("#vs");
    const cap = (t, sub) => '<div class="vcap"><b>' + esc(t) + "</b>" + (sub ? "<span>" + esc(sub) + "</span>" : "") + "</div>";
    async function show(n) {
      i = Math.max(0, Math.min(slides.length - 1, n)); const sl = slides[i], tok = Symbol(); show.tok = tok;
      v.querySelector("#vc").textContent = (i + 1) + " / " + slides.length;
      $$(".vdots i", v).forEach((d, k) => d.classList.toggle("on", k === i));
      v.querySelector("#vp").disabled = i === 0; v.querySelector("#vn").disabled = i === slides.length - 1;
      if (sl.type === "title") {
        const st = x.series.map(s => "<li><b>" + esc(P.stageName(s.stage)) + "</b><span>" + esc(ISD.fmtDate(s.date)) + "</span></li>").join("");
        stage.innerHTML = '<div class="vtitle"><span class="cat">' + esc(P.catName(x.cat) || "Կլինիկական դեպք") + "</span><h2>" + esc(x.title) + "</h2>" + (x.case && x.case.subtitle ? "<p>" + esc(x.case.subtitle) + "</p>" : "") + "<ul>" + st + "</ul>" +
          (prof.name ? '<p class="by">' + esc([prof.name, prof.clinic].filter(Boolean).join(" · ")) + "</p>" : "") + '<p class="hintv">Սահեցրեք կամ սեղմեք → հաջորդի համար</p></div>';
        return;
      }
      stage.innerHTML = '<div class="vload"></div>';
      if (sl.type === "cmp") {
        const [b, a] = await Promise.all([slideImg(sl.b), slideImg(sl.a)]); if (show.tok !== tok) return;
        stage.innerHTML = '<div class="vcmp"><figure><img src="' + b.data + '" alt="Նախքան"><figcaption><b>Նախքան</b> · ' + esc(ISD.fmtDate(x.pre.date)) + '</figcaption></figure><figure><img src="' + a.data + '" alt="Հետո"><figcaption><b>Հետո</b> · ' + esc(ISD.fmtDate(x.post.date)) + "</figcaption></figure></div>" + cap(sl.label);
      } else {
        const r = await slideImg(sl); if (show.tok !== tok) return;
        stage.innerHTML = '<div class="vone"><img src="' + r.data + '" alt="' + esc(sl.sl.name) + '"></div>' + cap(sl.sl.name, P.stageName(sl.s.stage) + " · " + ISD.fmtDate(sl.s.date));
      }
      [slides[i + 1], slides[i + 2]].forEach(nx => { if (!nx || nx.type === "title") return; if (nx.type === "cmp") { slideImg(nx.b); slideImg(nx.a); } else slideImg(nx); });   // preload
    }
    const close = () => { location.hash = "album"; };
    v.querySelector("#vx").onclick = close;
    v.querySelector("#vp").onclick = () => show(i - 1);
    v.querySelector("#vn").onclick = () => show(i + 1);
    v.querySelector("#vpdf").onclick = () => casePDF(x, prof);
    $$(".vdots i", v).forEach(d => d.onclick = () => show(+d.dataset.k));
    let sx = null, sy = null;
    stage.addEventListener("touchstart", e => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
    stage.addEventListener("touchend", e => { if (sx == null) return; const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy; if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) show(i + (dx < 0 ? 1 : -1)); sx = null; });
    stage.addEventListener("click", e => { if (e.target.closest("button")) return; const r = stage.getBoundingClientRect(); show(i + (e.clientX - r.left > r.width * 0.35 ? 1 : -1)); });
    const key2 = e => { if (!document.body.contains(v)) return removeEventListener("keydown", key2); if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); show(i + 1); } else if (e.key === "ArrowLeft") show(i - 1); else if (e.key === "Escape") close(); };
    addEventListener("keydown", key2);
    show(0);
  }

  /* ---------- album → PDF (landscape slides) ---------- */
  async function slidesPDF(pagesFn, filename) {
    const note = document.createElement("div"); note.className = "toast"; note.textContent = "PDF-ը պատրաստվում է…"; document.body.appendChild(note);
    try {
      await P.fontsReady(); await Promise.all(["400 24px NSA", "700 24px NSA", "700 48px NSerif"].map(f => document.fonts.load(f, "Աա Aa 1")));
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape", compress: true });
      let first = true;
      await pagesFn(async cv => { if (!first) pdf.addPage("a4", "landscape"); first = false; pdf.addImage(cv.toDataURL("image/jpeg", 0.9), "JPEG", 0, 0, 297, 210, undefined, "FAST"); });
      note.remove();
      await ISD.saveFile(pdf.output("blob"), ISD.safeName(filename) + ".pdf");
    } catch (e) { note.remove(); console.error(e); toast("Չհաջողվեց պատրաստել PDF-ը"); }
  }
  const PW = 1754, PH = 1240;
  function pdfPage() { const c = document.createElement("canvas"); c.width = PW; c.height = PH; const g = c.getContext("2d"); g.fillStyle = "#0e1214"; g.fillRect(0, 0, PW, PH); return [c, g]; }
  function fitText(g, t, maxW) { if (g.measureText(t).width <= maxW) return t; while (t.length > 1 && g.measureText(t + "…").width > maxW) t = t.slice(0, -1); return t + "…"; }
  function wrapLines(g, t, maxW) { const out = []; let line = ""; String(t).split(/\s+/).forEach(w => { const test = line ? line + " " + w : w; if (g.measureText(test).width > maxW && line) { out.push(line); line = w; } else line = test; }); if (line) out.push(line); return out; }
  function footer(g, x, prof) {
    g.fillStyle = "#59625f"; g.font = '400 22px "NSA", sans-serif'; g.textAlign = "left"; g.textBaseline = "alphabetic";
    g.fillText(fitText(g, [P.catName(x.cat), x.title].filter(Boolean).join(" · "), PW * 0.6), 80, PH - 46);
    g.textAlign = "right"; g.fillText(fitText(g, [prof.name, prof.clinic].filter(Boolean).join(" · ") || "", PW * 0.35), PW - 80, PH - 46); g.textAlign = "left";
  }
  async function renderSlide(x, sl, prof) {
    const [c, g] = pdfPage();
    if (sl.type === "title") {
      g.fillStyle = "#ff5c47"; g.font = '700 30px "NSA", sans-serif'; g.fillText((P.catName(x.cat) || "Կլինիկական դեպք").toUpperCase(), 120, 380);
      g.fillStyle = "#eef1ef"; g.font = '700 84px "NSerif", serif'; let y = 490;
      wrapLines(g, x.title, PW - 240).slice(0, 3).forEach(l => { g.fillText(l, 120, y); y += 100; });
      g.font = '400 32px "NSA", sans-serif'; g.fillStyle = "#a9b4b1"; y += 20;
      x.series.forEach(s => { g.fillText(P.stageName(s.stage) + " · " + ISD.fmtDate(s.date), 120, y); y += 48; });
      if (prof.name) { g.fillStyle = "#eef1ef"; g.font = '500 30px "NSA", sans-serif'; g.fillText([prof.name, prof.clinic].filter(Boolean).join(" · "), 120, PH - 150); }
      g.fillStyle = "#ff5c47"; g.fillRect(120, 300, 90, 6);
      await ISD.drawLogoChip(g, PW - 120, 110, 110);
      return c;
    }
    const top = 80, bottom = PH - 150;
    const put = async (r, x0, w, label, sub) => {
      const d = await slideImg(r, 2000), img = await ISD.decode(await ISD.dataURLToBlob(d.data));
      ISD.drawPhoto(g, img, x0, top, w, bottom - top, {}, "contain", "#151a1c");
      g.fillStyle = "#eef1ef"; g.font = '700 30px "NSA", sans-serif'; g.fillText(label, x0, bottom + 50);
      if (sub) { const lw = g.measureText(label).width; g.fillStyle = "#a9b4b1"; g.font = '400 28px "NSA", sans-serif'; g.fillText("  ·  " + sub, x0 + lw, bottom + 50); }
    };
    if (sl.type === "cmp") {
      const w = (PW - 160 - 40) / 2;
      await put(sl.b, 80, w, "Նախքան", ISD.fmtDate(x.pre.date)); await put(sl.a, 80 + w + 40, w, "Հետո", ISD.fmtDate(x.post.date));
      g.fillStyle = "#ff5c47"; g.font = '700 28px "NSA", sans-serif'; g.textAlign = "right"; g.fillText(sl.label, PW - 80, bottom + 50); g.textAlign = "left";
    } else await put(sl, 80, PW - 160, sl.sl.name, P.stageName(sl.s.stage) + " · " + ISD.fmtDate(sl.s.date));
    footer(g, x, prof);
    return c;
  }
  function casePDF(x, prof) {
    return slidesPDF(async add => { for (const sl of caseSlides(x)) await add(await renderSlide(x, sl, prof)); }, (x.code ? x.code + "_" : "") + (x.title || "case"));
  }
  async function albumPDF(groups, name) {
    const prof = (await db.meta("profile", {})) || {};
    return slidesPDF(async add => {
      const [c, g] = pdfPage();      // album cover
      await ISD.drawLogoChip(g, PW - 120, 110, 150);
      g.fillStyle = "#ff5c47"; g.fillRect(120, 380, 90, 6); g.font = '700 30px "NSA", sans-serif'; g.fillText("ԴԵՊՔԵՐԻ ԱԼԲՈՄ", 120, 460);
      g.fillStyle = "#eef1ef"; g.font = '700 96px "NSerif", serif'; g.fillText(fitText(g, name, PW - 240), 120, 580);
      g.fillStyle = "#a9b4b1"; g.font = '400 34px "NSA", sans-serif'; g.fillText(groups.length + " դեպք · " + ISD.fmtDate(ISD.today()), 120, 650);
      if (prof.name) { g.fillStyle = "#eef1ef"; g.font = '500 32px "NSA", sans-serif'; g.fillText([prof.name, prof.title, prof.clinic].filter(Boolean).join(" · "), 120, PH - 150); }
      await add(c);
      for (const x of groups) {
        const all = caseSlides(x), cmp = all.filter(s => s.type === "cmp");
        const body = cmp.length ? cmp : all.filter(s => s.type === "photo").slice(-3);   // no before/after → last 3 photos
        await add(await renderSlide(x, all[0], prof));
        for (const sl of body) await add(await renderSlide(x, sl, prof));
      }
    }, "Ալբոմ_" + name);
  }

  /* ---------- routing ---------- */
  async function route() {
    const h = location.hash.slice(1);
    const vw = $(".viewer"); if (vw) vw.remove(), document.documentElement.style.overflow = "";
    if (h === "album" || h.startsWith("album/")) { await albumView(); if (h.startsWith("album/")) openViewer(decodeURIComponent(h.slice(6))); return; }
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
      '<a class="albbar" href="#album"><span class="xi">' + icon("album") + '</span><span class="xt"><b>Դեպքերի ալբոմ</b><span>Ցույց տվեք ձեր աշխատանքները բուժառուներին՝ ըստ բուժման տեսակի</span></span><span class="go">' + icon("next") + "</span></a>" +
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
      '<label class="f"><span>Բուժման տեսակ</span><select name="category"><option value="">— ընտրել —</option>' + P.CATEGORIES.map(c => '<option value="' + c.id + '"' + (c.id === (s.category || "") ? " selected" : "") + ">" + esc(c.name) + " · " + esc(c.sub) + "</option>").join("") + "</select><small>Ըստ այս բաժնի դեպքը կհայտնվի «Դեպքերի ալբոմ»-ում։</small></label>" +
      '<div class="grid2"><label class="f"><span>Փուլ</span><select name="stage">' + P.STAGES.map(x => '<option value="' + x.id + '"' + (x.id === s.stage ? " selected" : "") + ">" + esc(x.name) + "</option>").join("") + '</select></label><label class="f"><span>Ամսաթիվ</span><input type="date" name="date" value="' + esc(s.date) + '"></label></div>' +
      '<label class="switch"><input type="checkbox" name="mirrorLateral"' + (s.mirrorLateral !== false ? " checked" : "") + '><span>Կողմնային կադրերը արվում են կողմնային հայելով (հավելվածը դրանք կշրջի)։ Օկլյուզիոն կադրերը միշտ շրջվում են։</span></label>' +
      '<div class="row" style="justify-content:space-between">' + (isNew ? "<span></span>" : '<button type="button" class="btn ghost" data-del style="color:var(--accent)">' + icon("trash") + "Ջնջել շարքը</button>") + '<button class="btn primary">' + (isNew ? "Ստեղծել" : "Պահել") + "</button></div></form>";
  }
  function newSeries(forCase) {
    forCase = forCase && forCase.id ? forCase : null;
    const sh = ISD.sheet(seriesForm(null));
    sh.el.querySelector("[data-x]").onclick = sh.close;
    if (forCase && forCase.code) sh.el.querySelector('[name="code"]').value = forCase.code;
    if (forCase && forCase.discipline) sh.el.querySelector('[name="category"]').value = P.catFromDisc(forCase.discipline);
    sh.el.querySelector("#sf").onsubmit = async e => {
      e.preventDefault();
      const f = new FormData(e.target);
      const s = { id: ISD.uid(), protocol: f.get("protocol") || "basic8", code: (f.get("code") || "").trim(), category: f.get("category") || "", stage: f.get("stage"), date: f.get("date") || ISD.today(), mirrorLateral: !!f.get("mirrorLateral"), slots: {}, extras: [], created: now(), updated: now(), caseId: forCase ? forCase.id : null };
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
      Object.assign(s, { code: (f.get("code") || "").trim(), category: f.get("category") || "", stage: f.get("stage"), date: f.get("date") || s.date, mirrorLateral: ml });
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
      '<div class="ed-head"><a class="iconbtn" href="#" aria-label="Բոլոր շարքերը">' + icon("back") + '</a><div class="t"><b>' + esc(s.code || "Առանց կոդի") + '</b><div class="muted small">' + esc(P.stageName(s.stage)) + " · " + esc(ISD.fmtDate(s.date)) + " · " + esc(pr.name) + (s.category ? " · " + esc(P.catName(s.category)) : "") + "</div></div>" +
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
