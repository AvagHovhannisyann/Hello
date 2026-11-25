/* ISD Dental School — anonymous survey + usage counters.
   Sent: the answers below and counts (cases, photo series). Never sent: names, contacts, patients, photos. */
(function (root) {
  "use strict";
  const Q = [
    { id: "role", t: "Ձեր մասնագիտացումը", o: ["Ուսանող", "Օրդինատոր", "Ընդհանուր (ընտանեկան) ստոմատոլոգ", "Թերապևտ", "Օրթոպեդ", "Վիրաբույժ, իմպլանտոլոգ", "Պարոդոնտոլոգ", "Օրթոդոնտ", "Մանկական ստոմատոլոգ", "Այլ"] },
    { id: "exp", t: "Աշխատանքային փորձը", o: ["Դեռ սովորում եմ", "2 տարուց քիչ", "2–5 տարի", "5–10 տարի", "10 տարուց ավել"] },
    { id: "region", t: "Որտե՞ղ եք աշխատում", o: ["Երևան", "Մարզ", "Արտերկիր"] },
    { id: "work", t: "Աշխատանքի ձևը", o: ["Սեփական կլինիկա", "Վարձու աշխատող", "Աթոռի վարձակալություն", "Համալսարան / կլինիկա-բազա", "Դեռ չեմ աշխատում"] },
    { id: "photoFreq", t: "Որքա՞ն հաճախ եք լուսանկարում կլինիկական դեպքերը", o: ["Երբեք", "Հազվադեպ", "Միայն հետաքրքիր դեպքերը", "Գրեթե բոլորը"] },
    { id: "camera", t: "Ինչո՞վ եք լուսանկարում", multi: true, o: ["Հեռախոս", "Հեռախոս + լույս կամ մակրո ոսպնյակ", "DSLR / mirrorless + մակրո", "Ներբերանային տեսախցիկ", "Չեմ լուսանկարում"] },
    { id: "mirrors", t: "Ունե՞ք լուսանկարչական հայելիներ և ետքաշիչներ", o: ["Այո", "Միայն ետքաշիչներ", "Ոչ"] },
    { id: "logbook", t: "Պահո՞ւմ եք դեպքերի գրանցամատյան", o: ["Այո, կանոնավոր", "Մասամբ", "Ոչ"] },
    { id: "cases", t: "Քանի՞ ամբողջական փաստաթղթավորված դեպք կարող եք ցույց տալ հիմա", o: ["0", "1–5", "6–20", "20-ից ավել"] },
    { id: "cv", t: "Ունե՞ք թարմ CV (վերջին 12 ամսում թարմացված)", o: ["Այո", "Կա, բայց հին է", "Ոչ"] },
    { id: "barrier", t: "Ի՞նչն է ամենաշատը խանգարում", multi: true, o: ["Ժամանակը", "Սարքավորումը", "Չգիտեմ ինչպես", "Բուժառուի համաձայնությունը", "Պահպանումն ու կազմակերպումը", "Կարիք չեմ տեսնում"] },
    { id: "courses", t: "Ո՞ր դասընթացները կօգնեին ձեզ", multi: true, o: ["Կլինիկական լուսանկարչություն", "Դեպքի ներկայացում", "CV և դիմումներ արտերկրի ծրագրերին", "Գիտական հոդված գրել", "Սոցիալական ցանցեր բժշկի համար"] }
  ];

  const cfg = () => root.ISD_CONFIG || {};

  async function post(payload) {
    const url = cfg().endpoint;
    if (!url) throw new Error("no endpoint");
    await fetch(url, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) });
  }
  async function queue(payload) {
    const box = (await ISD.db.meta("outbox", [])) || [];
    box.push(payload); await ISD.db.setMeta("outbox", box.slice(-20));
  }
  async function flush() {
    const box = (await ISD.db.meta("outbox", [])) || [];
    if (!box.length || !cfg().endpoint || !navigator.onLine) return;
    const left = [];
    for (const p of box) { try { await post(p); } catch (e) { left.push(p); } }
    await ISD.db.setMeta("outbox", left);
  }
  async function send(payload) {
    try { if (!navigator.onLine) throw new Error("offline"); await post(payload); }
    catch (e) { await queue(payload); }
  }

  async function state() { return (await ISD.db.meta("survey", null)) || null; }

  function open(app, onDone) {
    const html = '<header><div class="grow"><h2>Կարճ հարցում</h2><p class="muted small" style="margin-top:6px">12 հարց, 2 րոպե։ Անանուն է։ Օգնում է ISD Dental School-ին հասկանալ, ինչպես են հայ ստոմատոլոգները փաստաթղթավորում իրենց աշխատանքը։</p></div><button class="iconbtn" data-x aria-label="Փակել">' + ISD.icon("close") + '</button></header>' +
      '<form id="svf">' + Q.map((q, i) => '<fieldset style="border:0;padding:0;margin:0 0 18px"><legend style="font-weight:700;margin-bottom:8px">' + (i + 1) + ". " + ISD.esc(q.t) + (q.multi ? ' <span class="muted tiny" style="font-weight:400">(մի քանիսը)</span>' : "") + '</legend><div class="chips">' +
        q.o.map((o, j) => '<label class="chip"><input type="' + (q.multi ? "checkbox" : "radio") + '" name="' + q.id + '" value="' + j + '">' + ISD.esc(o) + "</label>").join("") + "</div></fieldset>").join("") +
      '<label class="row" style="align-items:flex-start;gap:12px;margin:6px 0 18px;font-size:14px"><input type="checkbox" name="consent" style="width:22px;height:22px;margin-top:2px;flex:none"><span>Համաձայն եմ, որ իմ անանուն պատասխանները և հավելվածի ընդհանուր թվերը (դեպքերի և լուսանկարների շարքերի քանակը) ուղարկվեն ISD Dental School-ին՝ հետազոտության համար։ Անուն, հեռախոս, բուժառուների տվյալներ և լուսանկարներ <b>չեն ուղարկվում</b>։</span></label>' +
      '<div class="row" style="justify-content:space-between"><button type="button" class="btn ghost" data-skip>Ավելի ուշ</button><button class="btn primary" type="submit">Ուղարկել</button></div></form>';
    const s = ISD.sheet(html, { sticky: true, focus: false });
    const f = s.el.querySelector("#svf");
    s.el.querySelector("[data-x]").onclick = s.el.querySelector("[data-skip]").onclick = async () => {
      const st = (await state()) || {}; st.skippedAt = Date.now(); await ISD.db.setMeta("survey", st); s.close(); onDone && onDone(false);
    };
    f.onsubmit = async e => {
      e.preventDefault();
      const fd = new FormData(f), answers = {};
      Q.forEach(q => { const v = fd.getAll(q.id).map(n => q.o[+n]); answers[q.id] = q.multi ? v.join("; ") : (v[0] || ""); });
      const answered = Q.filter(q => answers[q.id]).length;
      if (answered < 8) { ISD.toast("Խնդրում ենք պատասխանել առնվազն 8 հարցի"); return; }
      const consent = !!fd.get("consent");
      const st = { answeredAt: Date.now(), consent, answers };
      await ISD.db.setMeta("survey", st);
      if (consent) await send({ type: "survey", app, installId: await ISD.installId(), ts: new Date().toISOString(), version: cfg().version, answers });
      s.close();
      ISD.toast(consent ? "Շնորհակալություն։ Պատասխաններն ուղարկված են։" : "Պահված է միայն այս սարքում։");
      onDone && onDone(true);
    };
  }

  async function maybeAsk(app, onDone) {
    const st = await state();
    if (st && st.answeredAt) return;
    if (st && st.skippedAt && Date.now() - st.skippedAt < 3 * 864e5) return;
    open(app, onDone);
  }

  /* counts only — at most once a day, only after consent */
  async function ping(app, stats) {
    try {
      await flush();
      const st = await state();
      if (!st || !st.consent) return;
      const last = await ISD.db.meta("lastPing-" + app, 0);
      if (Date.now() - last < 20 * 36e5) return;
      await send(Object.assign({ type: "stats", app, installId: await ISD.installId(), ts: new Date().toISOString(), version: cfg().version }, stats));
      await ISD.db.setMeta("lastPing-" + app, Date.now());
    } catch (e) {}
  }

  root.ISDSurvey = { QUESTIONS: Q, open, maybeAsk, ping, state };
})(window);
