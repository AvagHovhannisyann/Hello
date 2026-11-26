/* ISD Dental School — one-time registration before using «Պորտֆոլիո» and «Ֆոտոարձանագրություն».
   Sent once (and again only when the doctor edits it): name, phone, e-mail, specialty, clinic.
   It uses its own random ID and is never linked to the anonymous survey or the usage counters.
   Stored in localStorage, so one registration covers both apps on the same device. */
(function (root) {
  "use strict";
  const KEY = "isd-reg";
  const ROLES = ["Ուսանող", "Օրդինատոր", "Ընդհանուր (ընտանեկան) ստոմատոլոգ", "Թերապևտ", "Օրթոպեդ", "Վիրաբույժ, իմպլանտոլոգ", "Պերիօդոնտոլոգ", "Օրթոդոնտ", "Մանկական ստոմատոլոգ", "Այլ"];
  const cfg = () => root.ISD_CONFIG || {};
  const esc = s => ISD.esc(s == null ? "" : s);

  function get() { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { return null; } }
  function put(r) { try { localStorage.setItem(KEY, JSON.stringify(r)); } catch (e) {} }
  const digits = v => String(v || "").replace(/\D/g, "");

  function device() {
    const u = navigator.userAgent || "";
    if (/iPad|Macintosh/.test(u) && navigator.maxTouchPoints > 1) return "iPad";
    if (/iPhone/.test(u)) return "iPhone";
    if (/Android/.test(u)) return "Android";
    if (/Windows/.test(u)) return "Windows";
    if (/Mac/.test(u)) return "Mac";
    return "Այլ";
  }

  /* The collector answers "registered" only when the new Code.gs is deployed. Until then the row stays
     "pending" here and is re-sent on the next start; the server merges repeats by ID / phone. */
  let busy = false;
  async function sync() {
    const r = get();
    if (!r || r.synced || busy || !cfg().endpoint || !navigator.onLine) return;
    busy = true;
    const body = JSON.stringify({ type: "register", regId: r.id, name: r.name, phone: r.phone, email: r.email, role: r.role, place: r.place, news: !!r.news, app: r.app, device: r.device, version: cfg().version, ts: new Date().toISOString() });
    try {
      const res = await fetch(cfg().endpoint, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body });
      if ((await res.text()).trim() === "registered") { const x = get(); if (x && x.id === r.id && x.rev === r.rev) { x.synced = true; put(x); } }
    } catch (e) {
      try { await fetch(cfg().endpoint, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body }); } catch (e2) {}
    } finally { busy = false; }
  }
  addEventListener("online", () => sync());

  function form(r, opts) {
    r = r || {};
    return '<form id="regf" novalidate>' +
      '<label class="f"><span>Անուն, ազգանուն *</span><input type="text" name="name" autocomplete="name" value="' + esc(r.name) + '" required></label>' +
      '<label class="f"><span>Հեռախոս *</span><input type="tel" name="phone" autocomplete="tel" inputmode="tel" placeholder="+374 __ ______" value="' + esc(r.phone) + '" required></label>' +
      '<label class="f"><span>Էլ. փոստ</span><input type="email" name="email" autocomplete="email" value="' + esc(r.email) + '"><small>Ոչ պարտադիր</small></label>' +
      '<label class="f"><span>Մասնագիտացում *</span><select name="role" required><option value="">Ընտրեք</option>' + ROLES.map(x => '<option' + (r.role === x ? " selected" : "") + ">" + esc(x) + "</option>").join("") + "</select></label>" +
      '<label class="f"><span>Կլինիկա կամ բուհ</span><input type="text" name="place" autocomplete="organization" value="' + esc(r.place) + '"><small>Ոչ պարտադիր</small></label>' +
      '<label class="regcheck"><input type="checkbox" name="consent"' + (r.id ? " checked" : "") + '><span>Համաձայն եմ, որ այս տվյալները պահվեն ISD Dental School-ում՝ օգտատերերի հաշվառման և ինձ հետ կապվելու համար։ Բուժառուների տվյալները, լուսանկարները և դեպքերը <b>չեն ուղարկվում</b>։ *</span></label>' +
      '<label class="regcheck"><input type="checkbox" name="news"' + (r.news ? " checked" : "") + "><span>Ցանկանում եմ տեղեկանալ ISD Dental School-ի դասընթացների և միջոցառումների մասին</span></label>" +
      '<button class="btn primary regsubmit" type="submit">' + esc(opts.submit) + "</button></form>";
  }

  function bind(f, app, prev, done) {
    f.onsubmit = e => {
      e.preventDefault();
      const fd = new FormData(f);
      const v = k => String(fd.get(k) || "").trim();
      const bad = (name, msg) => { ISD.toast(msg); const el = f.elements[name]; if (el) el.focus(); };
      if (v("name").length < 3) return bad("name", "Լրացրեք անունը և ազգանունը");
      if (digits(v("phone")).length < 8) return bad("phone", "Ստուգեք հեռախոսահամարը");
      if (v("email") && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v("email"))) return bad("email", "Ստուգեք էլ. փոստի հասցեն");
      if (!v("role")) return bad("role", "Ընտրեք մասնագիտացումը");
      if (!fd.get("consent")) return bad("consent", "Գրանցման համար անհրաժեշտ է համաձայնություն");
      const r = Object.assign({}, prev || {}, {
        id: (prev && prev.id) || ISD.uid(), name: v("name"), phone: v("phone"), email: v("email"), role: v("role"), place: v("place"),
        news: !!fd.get("news"), app: (prev && prev.app) || app, device: device(), at: (prev && prev.at) || Date.now(), rev: Date.now(), synced: false
      });
      put(r);
      sync();
      done(r);
    };
  }

  /* CV starts from the registration data when it is still empty */
  async function seedProfile(r) {
    try {
      const p = (await ISD.db.meta("profile", null)) || {};
      let ch = false;
      [["name", r.name], ["phone", r.phone], ["email", r.email], ["clinic", r.place]].forEach(([k, val]) => { if (!p[k] && val) { p[k] = val; ch = true; } });
      if (ch) await ISD.db.setMeta("profile", p);
    } catch (e) {}
  }

  async function surveyCard(app) {
    const st = root.ISDSurvey ? await ISDSurvey.state() : null;
    const done = st && st.answeredAt;
    return '<div class="regsurvey"><div class="grow"><b>Անանուն հարցում · 2 րոպե</b><span>' + (done ? "Պատասխանված է։ Շնորհակալություն։" : "Կարող եք պատասխանել նաև առանց գրանցման") + "</span></div>" +
      (done ? "" : '<button class="btn" type="button" data-survey>' + ISD.icon("chart") + "Պատասխանել</button>") + "</div>";
  }

  /* Blocks the app until the doctor registers. The anonymous survey stays reachable from the gate. */
  async function gate(app, start) {
    if (get()) { start(); sync(); return; }
    const el = document.createElement("div");
    el.className = "reggate";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.setAttribute("aria-label", "Գրանցում");
    const appName = app === "photo" ? "«Ֆոտոարձանագրություն»" : "«Պորտֆոլիո»";
    const paint = async () => {
      el.innerHTML = '<div class="reginner">' +
        '<div class="reghead">' + ISD.mark(false) + '<span class="regapp">' + esc(appName) + "</span></div>" +
        '<h1>Գրանցում</h1><p class="lead2">Մեկ անգամ՝ հավելվածից օգտվելու համար։ Հաջորդ անգամ այս սարքում հավելվածը կբացվի անմիջապես։ Գրանցումը գործում է նաև մյուս ISD հավելվածի համար։</p>' +
        (await surveyCard(app)) + form(null, { submit: "Գրանցվել և սկսել" }) +
        '<p class="regfoot">ISD Dental School · Innovative Solutions in Dentistry</p></div>';
      bindSurvey();
      bind(el.querySelector("#regf"), app, null, async r => {
        await seedProfile(r);
        el.remove();
        document.documentElement.style.overflow = "";
        ISD.toast("Բարի գալուստ, " + r.name.split(" ")[0] + "։");
        start();
      });
    };
    const bindSurvey = () => { const sv = el.querySelector("[data-survey]"); if (sv) sv.onclick = () => ISDSurvey.open(app, () => repaintSurvey()); };
    const repaintSurvey = async () => {
      const old = el.querySelector(".regsurvey");
      if (old) { const t = document.createElement("div"); t.innerHTML = await surveyCard(app); old.replaceWith(t.firstElementChild); bindSurvey(); }
    };
    await paint();
    document.body.appendChild(el);
    document.documentElement.style.overflow = "hidden";
    /* same flow as before at the lecture: the survey offers itself on first open */
    if (root.ISDSurvey) setTimeout(() => ISDSurvey.maybeAsk(app, () => repaintSurvey()), 1200);
  }

  /* «Ավելին»: show and edit */
  function card() {
    const r = get();
    if (!r) return "";
    return '<div class="card"><h3>Գրանցում</h3><p class="small" style="margin:8px 0 2px"><b>' + esc(r.name) + "</b></p>" +
      '<p class="muted small" style="margin:0 0 12px">' + esc([r.role, r.phone, r.email].filter(Boolean).join(" · ")) + "<br>" +
      (r.synced ? "Ուղարկված է ISD Dental School-ին" : "Կուղարկվի ինտերնետին միանալուն պես") + "</p>" +
      '<button class="btn" type="button" id="regedit">' + ISD.icon("edit") + "Փոխել տվյալները</button></div>";
  }
  function edit(app, onDone) {
    const prev = get();
    const s = ISD.sheet('<header><div class="grow"><h2>Գրանցման տվյալներ</h2></div><button class="iconbtn" data-x aria-label="Փակել">' + ISD.icon("close") + "</button></header>" + form(prev, { submit: "Պահել" }), { focus: false });
    s.el.querySelector("[data-x]").onclick = () => s.close();
    bind(s.el.querySelector("#regf"), app, prev, r => { s.close(); ISD.toast("Պահված է"); onDone && onDone(r); });
  }

  root.ISDReg = { get, gate, sync, card, edit };
})(window);
