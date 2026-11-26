/* ISD Dental School — clinical case presentation builder (PptxGenJS).
   One module for two jobs: the empty guide-template (template:true) and a filled deck exported from the app.
   Order follows the CARE case-report checklist. Clinical photos are never cropped (contain-fit on black). */
(function (root) {
  "use strict";
  const W = 13.333, H = 7.5, M = 0.6;
  const C = { ink: "101517", ink2: "3C4448", ink3: "6B7478", paper: "F5F5F1", card: "FFFFFF", line: "DFE2E0", black: "0B0E0F", black2: "151A1C", black3: "252C2F", light: "EEF1EF", gray: "8B9591", coral: "FF5C47", coralD: "D63D29", soft: "FBE4DF" };
  const SANS = "Noto Sans Armenian", SERIF = "Noto Serif Armenian";

  function build(PptxGenJS, d, opt) {
    d = d || {}; opt = opt || {};
    const TPL = !!opt.template;
    const LOGO = opt.logo ? String(opt.logo).replace(/^data:/, "") : null;   // "image/png;base64,…"
    const pptx = new PptxGenJS();
    pptx.layout = "LAYOUT_WIDE";
    pptx.author = d.presenter || "ISD Dental School";
    pptx.company = "ISD Dental School";
    pptx.title = d.title || "Կլինիկական դեպքի ներկայացում";
    pptx.theme = { headFontFace: SERIF, bodyFontFace: SANS };
    pptx.defineSlideMaster({ title: "LIGHT", background: { color: C.paper }, slideNumber: { x: W - M - 0.6, y: H - 0.42, w: 0.6, h: 0.25, fontFace: SANS, fontSize: 9, color: C.ink3, align: "right" } });
    pptx.defineSlideMaster({ title: "DARK", background: { color: C.black }, slideNumber: { x: W - M - 0.6, y: H - 0.42, w: 0.6, h: 0.25, fontFace: SANS, fontSize: 9, color: C.gray, align: "right" } });

    const foot = [d.code ? "Բուժառու " + d.code : null, d.presenter || null].filter(Boolean).join("  ·  ");
    const has = v => Array.isArray(v) ? v.length > 0 : !!(v && String(v).trim());
    const G = (v, guide) => has(v) ? v : (TPL ? guide : "");

    /* ---------- primitives ---------- */
    function slide(dark, section, title, notes) {
      const s = pptx.addSlide({ masterName: dark ? "DARK" : "LIGHT" });
      s._dark = dark;
      if (section) s.addText(section, { x: M, y: 0.42, w: 8, h: 0.3, fontFace: SANS, fontSize: 11, bold: true, color: dark ? C.coral : C.coralD, margin: 0 });
      if (title) s.addText(title, { x: M, y: 0.72, w: W - 2 * M, h: 0.7, fontFace: SERIF, fontSize: 28, bold: true, color: dark ? C.light : C.ink, margin: 0, valign: "top", fit: "shrink" });
      if (LOGO) {   // ISD logo on a small white chip, then the footer text
        s.addShape(pptx.ShapeType.roundRect, { x: M, y: H - 0.5, w: 1.12, h: 0.38, fill: { color: "FFFFFF" }, line: { color: dark ? "FFFFFF" : C.line, width: 0.5 }, rectRadius: 0.06 });
        s.addImage({ data: LOGO, x: M + 0.06, y: H - 0.46, w: 1.0, h: 0.3 });
        if (foot) s.addText(foot, { x: M + 1.28, y: H - 0.44, w: 8, h: 0.25, fontFace: SANS, fontSize: 9, color: dark ? C.gray : C.ink3, margin: 0 });
      } else s.addText([{ text: "ISD Dental School", options: { bold: true } }, { text: foot ? "   " + foot : "" }], { x: M, y: H - 0.42, w: 9, h: 0.25, fontFace: SANS, fontSize: 9, color: dark ? C.gray : C.ink3, margin: 0 });
      if (notes) s.addNotes(notes);
      return s;
    }
    function text(s, t, o) {
      o = Object.assign({ fontFace: SANS, fontSize: 15, color: s._dark ? C.light : C.ink, margin: 0, valign: "top", paraSpaceAfter: 6, fit: "shrink" }, o || {});
      if (TPL && o.guide) { o.color = s._dark ? C.gray : C.ink3; o.italic = true; }
      delete o.guide;
      s.addText(t == null ? "" : t, o);
    }
    function brackets(s, x, y, w, h, color) {
      const k = Math.min(0.28, w / 6, h / 6), c = color || C.coral, lw = 1.5;
      [[x, y, k, 0], [x, y, 0, k], [x + w - k, y + h, k, 0], [x + w, y + h - k, 0, k]].forEach(([a, b, ww, hh]) => s.addShape("line", { x: a, y: b, w: ww, h: hh, line: { color: c, width: lw } }));
    }
    /* photo box: real image (contain-fit) or a dashed placeholder telling what goes there */
    function photo(s, img, x, y, w, h, label, opts) {
      opts = opts || {};
      s.addShape("rect", { x, y, w, h, fill: { color: s._dark ? C.black2 : "E6E8E5" }, line: { color: s._dark ? C.black3 : C.line, width: 0.75, dashType: img ? "solid" : "dash" } });
      if (img && img.data) {
        const ar = (img.w && img.h) ? img.w / img.h : 1.5;
        let iw = w, ih = w / ar; if (ih > h) { ih = h; iw = h * ar; }
        s.addImage({ data: img.data.replace(/^data:/, ""), x: x + (w - iw) / 2, y: y + (h - ih) / 2, w: iw, h: ih });
      } else if (TPL || opts.always) {
        s.addText([{ text: label || "Լուսանկար", options: { bold: true, breakLine: true } }, { text: opts.hint || "Տեղադրել → Նկար", options: { fontSize: 10 } }], { x: x + 0.15, y: y + 0.15, w: w - 0.3, h: h - 0.3, align: "center", valign: "middle", fontFace: SANS, fontSize: 12, color: s._dark ? C.gray : C.ink3, margin: 0, fit: "shrink" });
      }
      brackets(s, x, y, w, h);
      if (label && img && img.data && opts.caption !== false) {
        s.addText(label, { x: x, y: y + h + 0.06, w: w, h: 0.26, fontFace: SANS, fontSize: 10, color: s._dark ? C.gray : C.ink3, margin: 0 });
      }
    }
    function box(s, x, y, w, h, head, body, o) {
      o = o || {};
      s.addShape("rect", { x, y, w, h, fill: { color: s._dark ? C.black2 : C.card }, line: { color: s._dark ? C.black3 : C.line, width: 0.75 } });
      if (o.accent) s.addShape("rect", { x, y, w: 0.07, h, fill: { color: C.coral }, line: { color: C.coral, width: 0 } });
      if (head) text(s, head, { x: x + 0.25, y: y + 0.18, w: w - 0.5, h: 0.32, fontSize: 12, bold: true, color: s._dark ? C.coral : C.coralD });
      text(s, body, { x: x + 0.25, y: y + (head ? 0.55 : 0.22), w: w - 0.5, h: h - (head ? 0.7 : 0.4), fontSize: o.size || 14, guide: o.guide });
    }
    const lines = v => Array.isArray(v) ? v.filter(Boolean) : String(v || "").split(/\n+/).map(x => x.trim()).filter(Boolean);
    const bullets = (arr, o) => arr.map(t => ({ text: t, options: Object.assign({ bullet: { indent: 14 }, breakLine: true }, o || {}) }));

    /* ---------- 1. title ---------- */
    {
      const s = slide(true, null, null, TPL ? "Վերնագիր՝ ախտորոշումը կամ միջամտությունը + «կլինիկական դեպք»։ Ենթավերնագիր՝ մեկ նախադասություն, թե ինչով է դեպքը հետաքրքիր։ Աջ կողմում՝ վերջնական արդյունքի ամենաուժեղ լուսանկարը։" : null);
      s.addShape("rect", { x: 0, y: 0, w: 0.12, h: H, fill: { color: C.coral }, line: { color: C.coral, width: 0 } });
      s.addText("Կլինիկական դեպք", { x: M, y: 0.9, w: 6.2, h: 0.35, fontFace: SANS, fontSize: 13, bold: true, color: C.coral, margin: 0 });
      text(s, G(d.title, "Դեպքի վերնագիրը՝ ախտորոշում կամ միջամտություն"), { x: M, y: 1.35, w: 6.4, h: 2.4, fontFace: SERIF, fontSize: 38, bold: true, color: C.light, guide: !has(d.title) });
      text(s, G(d.subtitle, "Մեկ նախադասություն՝ ինչով է այս դեպքը կարևոր"), { x: M, y: 3.85, w: 6.2, h: 0.9, fontSize: 17, color: C.gray, guide: !has(d.subtitle) });
      text(s, [
        { text: G(d.presenter, "Անուն Ազգանուն"), options: { bold: true, fontSize: 16, color: C.light, breakLine: true } },
        { text: G(d.role, "Մասնագիտացում, կլինիկա"), options: { fontSize: 13, color: C.gray, breakLine: true } },
        { text: G(d.event, "Միջոցառում · ամսաթիվ"), options: { fontSize: 13, color: C.gray } }
      ], { x: M, y: 5.35, w: 6.2, h: 1.2 });
      photo(s, d.hero, 7.35, 0.6, 5.4, 6.1, "Վերջնական արդյունքի լավագույն կադրը", { hint: "Ժպիտ մոտիկից կամ կադր՝ առջևից", caption: false });
    }

    /* ---------- template guide ---------- */
    if (TPL) {
      const s = slide(false, "Ինչպես օգտագործել ձևանմուշը", "Ջնջեք այս սլայդը ներկայացումից առաջ", "Ձևանմուշի կառուցվածքը հետևում է CARE ուղեցույցին (care-statement.org)։ Յուրաքանչյուր սլայդի նշումներում գրված է՝ ինչ ասել և որքան ժամանակ տրամադրել։");
      const rules = [
        ["Հերթականությունը՝ CARE", "Բուժառու → հետազոտություն → ախտորոշում → տարբերակներ → պլան → փուլեր → արդյունք → քննարկում։"],
        ["Մեկ սլայդ՝ մեկ միտք", "Վերնագիրը ասում է եզրակացությունը, ոչ թե թեման։ 20 սլայդը 15 րոպեի համար բավական է։"],
        ["Նույն շարքը՝ նախքան և հետո", "Նույն տեսքերը, խոշորացումը և լույսը։ «Ֆոտոարձանագրություն» հավելվածը պատրաստում է դրանք։"],
        ["Անանուն", "Բուժառուի կոդ, ոչ անուն։ Դեմքով կադրեր՝ միայն գրավոր համաձայնությամբ։"],
        ["Լուսանկարները չկտրել", "Կլինիկական տեղեկությունը կորչում է։ Տեղադրել ամբողջությամբ, սև ֆոնի վրա։"],
        ["Տառատեսակ", "Noto Sans Armenian և Noto Serif Armenian (անվճար, fonts.google.com)։ Տեղադրեք, որ տեքստը ճիշտ երևա։"]
      ];
      rules.forEach((r, i) => {
        const col = i % 3, row = Math.floor(i / 3), bw = (W - 2 * M - 0.5) / 3;
        box(s, M + col * (bw + 0.25), 1.75 + row * 2.45, bw, 2.2, r[0], r[1], { size: 14 });
      });
    }

    /* ---------- 2. introduction ---------- */
    if (TPL || has(d.intro) || has(d.keywords)) {
      const s = slide(false, "Ներածություն", "Ինչու է այս դեպքը կարևոր", "1 րոպե։ Ի՞նչ է ավելացնում այս դեպքը գիտելիքին կամ պրակտիկային։ Բանալի բառերը՝ 2–5։");
      text(s, G(d.intro, "2–3 նախադասություն՝ ինչ խնդիր, ինչ մոտեցում, ինչ արդյունք։ Ո՞րն է դեպքի «նորությունը» լսարանի համար։"), { x: M, y: 1.75, w: 7.6, h: 4.6, fontFace: SERIF, fontSize: 24, guide: !has(d.intro) });
      const kw = has(d.keywords) ? lines(String(d.keywords).replace(/[,;]/g, "\n")) : (TPL ? ["բանալի բառ 1", "բանալի բառ 2", "կլինիկական դեպք"] : []);
      text(s, "Բանալի բառեր", { x: 9.0, y: 1.8, w: 3.7, h: 0.3, fontSize: 11, bold: true, color: C.coralD });
      kw.slice(0, 6).forEach((k, i) => {
        s.addShape("roundRect", { x: 9.0, y: 2.25 + i * 0.62, w: 3.7, h: 0.48, rectRadius: 0.24, fill: { color: C.card }, line: { color: C.line, width: 0.75 } });
        text(s, k, { x: 9.2, y: 2.25 + i * 0.62, w: 3.3, h: 0.48, fontSize: 13, valign: "middle", guide: !has(d.keywords) });
      });
    }

    /* ---------- 3. patient ---------- */
    if (TPL || has(d.complaint) || has(d.medical) || has(d.dental)) {
      const s = slide(false, "Բուժառու", d.patientTitle || "Բուժառուն և նրա բողոքը", "1–2 րոպե։ Բողոքը՝ բուժառուի բառերով։ Ընդհանուր հիվանդություններ, դեղեր, ալերգիաներ, սովորություններ (ծխել, բրուքսիզմ), նախկին բուժում։");
      const facts = [["Կոդ", G(d.code, "P-0000")], ["Տարիք", G(d.age, "—")], ["Սեռ", G(d.sex, "—")], ["Առաջին այց", G(d.firstVisit, "—")]];
      facts.forEach((f, i) => {
        text(s, f[0], { x: M, y: 1.8 + i * 0.78, w: 2.6, h: 0.28, fontSize: 11, color: C.ink3 });
        text(s, f[1], { x: M, y: 2.06 + i * 0.78, w: 2.6, h: 0.4, fontSize: 18, bold: true, guide: TPL && f[1] === "—" });
      });
      s.addShape("line", { x: 3.45, y: 1.85, w: 0, h: 3.1, line: { color: C.line, width: 1 } });
      text(s, "«" + G(d.complaint, "Բողոքը՝ բուժառուի բառերով") + "»", { x: 3.8, y: 1.75, w: 8.9, h: 1.7, fontFace: SERIF, fontSize: 24, guide: !has(d.complaint) });
      const hb = [["Բժշկական անամնեզ", d.medical, "Հիվանդություններ, դեղեր, ալերգիաներ"], ["Ստոմատոլոգիական անամնեզ", d.dental, "Նախկին բուժում, հիգիենա, այցերի հաճախականություն"], ["Սովորություններ և ակնկալիքներ", d.habits, "Ծխել, բրուքսիզմ, էսթետիկ ակնկալիքներ"]].filter(x => TPL || has(x[1]));
      const bw = hb.length ? (W - 3.8 - M - 0.25 * (hb.length - 1)) / hb.length : 0;
      hb.forEach((x, i) => box(s, 3.8 + i * (bw + 0.25), 3.75, bw, 2.85, x[0], G(x[1], x[2]), { guide: !has(x[1]), size: 13 }));
    }

    /* ---------- 4. extraoral ---------- */
    const ex = d.extra || {};
    if (TPL || ex.face || ex.profile || ex.smile || has(d.findingsExtra)) {
      const s = slide(true, "Կլինիկական հետազոտություն", "Արտաբերանային հետազոտություն", "1 րոպե։ Դեմքի համաչափություն, պրոֆիլ, ժպիտի գիծ, շրթունքների դիրք, լնդի տեսանելիություն ժպտալիս։");
      const pw = (W - 2 * M - 0.5) / 3;
      [["profile", "Պրոֆիլ աջից · 1:10"], ["face", "Դեմք՝ ժպիտով · 1:10"], ["smile", "Ժպիտ մոտիկից · 1:2"]].forEach((p, i) => photo(s, ex[p[0]], M + i * (pw + 0.25), 1.65, pw, 3.9, p[1]));
      text(s, G(d.findingsExtra, "Հիմնական արտաբերանային գտածոները՝ 1–2 տող"), { x: M, y: 6.05, w: W - 2 * M, h: 0.8, fontSize: 14, guide: !has(d.findingsExtra) });
    }

    /* ---------- 5. intraoral ---------- */
    const io = d.intra || {};
    if (TPL || io.frontal || io.latR || io.latL || io.occU || io.occL || has(d.findingsIntra)) {
      const s = slide(true, "Կլինիկական հետազոտություն", "Ներբերանային հետազոտություն", "1–2 րոպե։ Պերիօդոնտալ վիճակ (պերիօդոնտալ քարտեզը՝ առանձին սլայդով կամ հավելվածում), ատամների վիճակ, կծվածք, ֆունկցիոնալ գտածոներ։");
      const top = 1.6, cw = 3.55, ch = 2.37, cg = 0.18, x0 = (W - (3 * cw + 2 * cg)) / 2;
      photo(s, io.latR, x0, top, cw, ch, "Աջ կողմնային");
      photo(s, io.frontal, x0 + cw + cg, top, cw, ch, "Առջևից՝ կծվածքում");
      photo(s, io.latL, x0 + 2 * (cw + cg), top, cw, ch, "Ձախ կողմնային");
      photo(s, io.occU, x0, top + ch + 0.42, cw, ch, "Վերին ծնոտ՝ օկլյուզիոն");
      text(s, G(d.findingsIntra, "Ներբերանային գտածոները՝ 3–4 կետ"), { x: x0 + cw + cg + 0.1, y: top + ch + 0.42, w: cw - 0.2, h: ch, fontSize: 13, guide: !has(d.findingsIntra) });
      photo(s, io.occL, x0 + 2 * (cw + cg), top + ch + 0.42, cw, ch, "Ստորին ծնոտ՝ օկլյուզիոն");
    }

    /* ---------- 6. radiographs ---------- */
    if (TPL || has(d.xrays) || has(d.radioFindings)) {
      const s = slide(true, "Լրացուցիչ հետազոտություն", "Ռենտգեն և ԿԿՏ", "1 րոպե։ Օրթոպանտոմոգրամ, ներբերանային կադրեր կամ ԿԿՏ կտրվածքներ։ Նշել, թե ինչ ենք տեսնում և ինչ որոշում է դա ազդել։");
      const xr = (d.xrays || []).slice(0, 2);
      if (xr.length <= 1) photo(s, xr[0], M, 1.6, 7.9, 5.0, xr[0] && xr[0].label || "ՕՊՏԳ կամ ԿԿՏ", { hint: "Օրթոպանտոմոգրամ / ԿԿՏ կտրվածք" });
      else { photo(s, xr[0], M, 1.6, 3.85, 5.0, xr[0].label); photo(s, xr[1], M + 4.05, 1.6, 3.85, 5.0, xr[1].label); }
      const rf = has(d.radioFindings) ? lines(d.radioFindings) : ["Ոսկրի մակարդակ", "Պերիապիկալ փոփոխություններ", "Արմատների երկարություն և ձև"];
      text(s, bullets(rf), { x: 8.9, y: 1.7, w: W - 8.9 - M, h: 4.8, fontSize: 15, guide: !has(d.radioFindings) });
    }

    /* ---------- 7. diagnosis ---------- */
    if (TPL || has(d.diagnosis) || has(d.problems)) {
      const s = slide(false, "Ախտորոշում", "Ախտորոշում և խնդիրների ցուցակ", "1 րոպե։ Ախտորոշումը՝ ընդունված դասակարգմամբ (օր.՝ 2017 AAP/EFP պերիօդոնտիտի դասակարգում)։ Խնդիրները՝ ըստ առաջնահերթության։");
      box(s, M, 1.7, 5.6, 4.9, "Ախտորոշում", G(d.diagnosis, "Հիմնական և ուղեկցող ախտորոշումներ՝ ընդունված դասակարգմամբ"), { accent: true, size: 18, guide: !has(d.diagnosis) });
      const pr = has(d.problems) ? lines(d.problems) : ["Խնդիր 1 (առաջնահերթ)", "Խնդիր 2", "Խնդիր 3"];
      text(s, "Խնդիրների ցուցակ", { x: 6.7, y: 1.75, w: 6, h: 0.3, fontSize: 12, bold: true, color: C.coralD });
      text(s, pr.map(t => ({ text: t, options: { bullet: { type: "number" }, breakLine: true } })), { x: 6.7, y: 2.15, w: W - 6.7 - M, h: 4.4, fontSize: 16, paraSpaceAfter: 10, guide: !has(d.problems) });
    }

    /* ---------- 8. options ---------- */
    if (TPL || has(d.options)) {
      const s = slide(false, "Բուժման տարբերակներ", "Քննարկված տարբերակներ", "1–2 րոպե։ Ցույց տալ, որ դիտարկվել են այլընտրանքներ։ Ընտրված տարբերակը նշել և բացատրել՝ ինչու (կլինիկական, ֆինանսական, բուժառուի նախընտրություն)։");
      const opts = has(d.options) ? d.options : [{ name: "Տարբերակ Ա", pros: "Առավելություններ", cons: "Թերություններ", chosen: true }, { name: "Տարբերակ Բ", pros: "…", cons: "…" }, { name: "Տարբերակ Գ", pros: "…", cons: "…" }];
      const hd = o => ({ text: o, options: { bold: true, color: C.light, fill: { color: C.ink }, fontSize: 12 } });
      const rows = [[hd("Տարբերակ"), hd("Առավելություններ"), hd("Թերություններ")]].concat(opts.slice(0, 5).map(o => {
        const f = o.chosen ? { fill: { color: C.soft } } : { fill: { color: C.card } };
        return [{ text: (o.chosen ? "✓ " : "") + (o.name || ""), options: Object.assign({ bold: true }, f) }, { text: o.pros || "", options: f }, { text: o.cons || "", options: f }];
      }));
      s.addTable(rows, { x: M, y: 1.75, w: W - 2 * M, colW: [3.4, (W - 2 * M - 3.4) / 2, (W - 2 * M - 3.4) / 2], fontFace: SANS, fontSize: 13, color: C.ink, border: { type: "solid", color: C.line, pt: 0.75 }, valign: "middle", margin: 0.1, rowH: 0.62, autoPage: false });
      if (has(d.choiceWhy) || TPL) text(s, "Ընտրության հիմնավորումը՝ " + G(d.choiceWhy, "ինչու հենց այս տարբերակը"), { x: M, y: 6.25, w: W - 2 * M, h: 0.6, fontSize: 14, guide: !has(d.choiceWhy) });
    }

    /* ---------- 9. plan ---------- */
    if (TPL || has(d.plan)) {
      const s = slide(false, "Բուժման պլան", d.planTitle || "Փուլային բուժման պլան", "1 րոպե։ Փուլերը և դրանց հաջորդականությունը։ Պերիօդոնտալ-օրթոպեդիկ տրամաբանություն՝ նախ ախտահարման վերահսկում, ապա վերականգնում, ապա պահպանողական թերապիա։");
      const ph = has(d.plan) ? d.plan.slice(0, 5) : [
        { phase: "Նախնական փուլ", text: "Մոտիվացիա, հիգիենա, մասնագիտական մաքրում, ոչ վիրաբուժական պերիօդոնտալ թերապիա" },
        { phase: "Վիրաբուժական փուլ", text: "Ռեզեկտիվ / ռեգեներատիվ վիրաբուժություն, պսակի կլինիկական երկարացում, իմպլանտացիա" },
        { phase: "Վերականգնողական փուլ", text: "Ժամանակավոր և մշտական ռեստավրացիաներ, պրոթեզավորում" },
        { phase: "Պահպանողական թերապիա", text: "Կանոնավոր այցեր, վերահսկում, հիգիենա" }];
      const n = ph.length, gw = 0.22, bw = (W - 2 * M - gw * (n - 1)) / n;
      s.addShape("line", { x: M, y: 2.05, w: W - 2 * M, h: 0, line: { color: C.line, width: 1.25 } });
      ph.forEach((p, i) => {
        const x = M + i * (bw + gw);
        s.addShape("ellipse", { x: x, y: 1.93, w: 0.24, h: 0.24, fill: { color: C.coral }, line: { color: C.coral, width: 0 } });
        box(s, x, 2.45, bw, ph.some(q => has(q.text)) ? 4.1 : 1.0, p.phase || "", G(p.text, ""), { size: 13, guide: !has(d.plan) });
      });
    }

    /* ---------- 10. steps ---------- */
    const steps = has(d.steps) ? d.steps : (TPL ? [{ date: "Ամսաթիվ", title: "Փուլի անվանումը", text: "Ինչ արվեց, ինչ նյութերով և ինչու։ Կարևոր մանրամասն, որը լսարանը պետք է նկատի։", photos: [] }, { date: "Ամսաթիվ", title: "Հաջորդ փուլը", text: "Մեկ սլայդ՝ մեկ կլինիկական քայլ։ Լուսանկարները՝ նույն խոշորացմամբ։", photos: [] }] : []);
    steps.forEach((st, i) => {
      const s = slide(true, "Բուժման ընթացք · " + (i + 1) + "/" + steps.length, st.title || "Բուժման փուլ", TPL ? "30–60 վայրկյան յուրաքանչյուր փուլին։ Ի՞նչ արվեց, ինչ նյութերով, որն էր կրիտիկական կետը։" : null);
      const ph = (st.photos || []).slice(0, 4);
      const area = { x: M, y: 1.6, w: 8.2, h: 5.1 };
      if (ph.length <= 1) photo(s, ph[0], area.x, area.y, area.w, area.h, ph[0] ? ph[0].label : "Փուլի լուսանկարը");
      else if (ph.length === 2) { const w2 = (area.w - 0.2) / 2; ph.forEach((p, k) => photo(s, p, area.x + k * (w2 + 0.2), area.y, w2, area.h, p.label)); }
      else { const w2 = (area.w - 0.2) / 2, h2 = (area.h - 0.45) / 2; ph.forEach((p, k) => photo(s, p, area.x + (k % 2) * (w2 + 0.2), area.y + Math.floor(k / 2) * (h2 + 0.45), w2, h2, p.label)); }
      text(s, st.date ? (st.dateLabel || st.date) : "", { x: 9.15, y: 1.65, w: W - 9.15 - M, h: 0.35, fontSize: 12, bold: true, color: C.coral, guide: TPL });
      text(s, st.text || "", { x: 9.15, y: 2.1, w: W - 9.15 - M, h: 4.5, fontSize: 15, guide: TPL });
    });

    /* ---------- 11. before / after ---------- */
    if (TPL || d.before || d.after) {
      const s = slide(true, "Արդյունք", d.resultTitle || "Նախքան և հետո", "30 վայրկյան։ Նույն տեսքը, նույն խոշորացումը և լույսը։ Լավագույնը՝ կադրը առջևից կամ ժպիտը։");
      const bw = (W - 2 * M - 0.3) / 2;
      photo(s, d.before, M, 1.6, bw, 4.75, null, { hint: "Նախքան բուժումը" });
      photo(s, d.after, M + bw + 0.3, 1.6, bw, 4.75, null, { hint: "Բուժումից հետո" });
      text(s, [{ text: "Նախքան", options: { bold: true, color: C.light } }, { text: d.beforeDate ? "   " + d.beforeDate : "", options: { color: C.gray } }], { x: M, y: 6.45, w: bw, h: 0.35, fontSize: 14 });
      text(s, [{ text: "Հետո", options: { bold: true, color: C.coral } }, { text: d.afterDate ? "   " + d.afterDate : "", options: { color: C.gray } }], { x: M + bw + 0.3, y: 6.45, w: bw, h: 0.35, fontSize: 14 });
    }

    /* ---------- 12. outcome & follow-up ---------- */
    if (TPL || has(d.outcome) || has(d.followup)) {
      const s = slide(false, "Արդյունք և հետևում", "Ինչ ունենք այսօր", "1 րոպե։ Կլինիկական և ռենտգենաբանական արդյունքը, բուժառուի գնահատականը, բարդություններ (եթե եղել են)։ Հետևման այցերը՝ ամսաթվերով։");
      box(s, M, 1.7, 5.9, 4.9, "Արդյունք", G(d.outcome, "Կլինիկական արդյունքը, բուժառուի կարծիքը, բարդություններ"), { accent: true, size: 15, guide: !has(d.outcome) });
      const fu = has(d.followup) ? d.followup.slice(0, 6) : [{ date: "1 ամիս", text: "…" }, { date: "6 ամիս", text: "…" }, { date: "1 տարի", text: "…" }];
      const x0 = 7.1, y0 = 1.85, step = Math.min(0.85, 4.6 / fu.length);
      s.addShape("line", { x: x0 + 0.1, y: y0 + 0.12, w: 0, h: step * (fu.length - 1), line: { color: C.line, width: 1.25 } });
      fu.forEach((f, i) => {
        s.addShape("ellipse", { x: x0, y: y0 + i * step, w: 0.22, h: 0.22, fill: { color: i === fu.length - 1 ? C.coral : C.card }, line: { color: C.coral, width: 1.25 } });
        text(s, [{ text: f.date || "", options: { bold: true, breakLine: true } }, { text: f.text || "", options: { color: C.ink2 } }], { x: x0 + 0.45, y: y0 - 0.08 + i * step, w: W - x0 - 0.45 - M, h: step, fontSize: 13, guide: !has(d.followup) });
      });
    }

    /* ---------- 13. discussion ---------- */
    if (TPL || has(d.discussion) || has(d.differently) || has(d.literature)) {
      const s = slide(false, "Քննարկում", "Ինչ սովորեցինք", "1–2 րոպե։ Ուժեղ և թույլ կողմեր, համեմատություն գրականության հետ։ Ազնիվ լինել սահմանափակումների մասին՝ դա բարձրացնում է վստահությունը։");
      const bw = (W - 2 * M - 0.5) / 3;
      box(s, M, 1.7, bw, 4.9, "Ինչ ստացվեց", G(d.discussion, "Ինչն աշխատեց և ինչու"), { guide: !has(d.discussion) });
      box(s, M + bw + 0.25, 1.7, bw, 4.9, "Ինչ կանեի այլ կերպ", G(d.differently, "Սահմանափակումներ, սխալներ, այլընտրանքներ"), { guide: !has(d.differently) });
      box(s, M + 2 * (bw + 0.25), 1.7, bw, 4.9, "Ինչ է ասում գրականությունը", G(d.literature, "2–3 աղբյուր, որոնց հետ համեմատում եք արդյունքը"), { guide: !has(d.literature) });
    }

    /* ---------- 14. conclusions ---------- */
    if (TPL || has(d.conclusions)) {
      const s = slide(true, "Եզրակացություն", "Երեք միտք, որ պետք է հիշել", "30 վայրկյան։ Լսարանը պետք է կարողանա կրկնել այս երեք միտքը։");
      const cc = has(d.conclusions) ? lines(d.conclusions).slice(0, 3) : ["Առաջին եզրակացությունը", "Երկրորդ եզրակացությունը", "Երրորդ եզրակացությունը"];
      cc.forEach((c, i) => {
        s.addShape("line", { x: M, y: 1.85 + i * 1.6, w: 0.5, h: 0, line: { color: C.coral, width: 2.5 } });
        text(s, c, { x: M + 0.8, y: 1.6 + i * 1.6, w: W - 2 * M - 0.8, h: 1.3, fontFace: SERIF, fontSize: 24, color: C.light, guide: !has(d.conclusions) });
      });
    }

    /* ---------- 15. references ---------- */
    if (TPL || has(d.references)) {
      const s = slide(false, "Գրականություն", "Աղբյուրներ", "Վանկուվերյան ոճ։ 3–8 աղբյուր։");
      const rf = has(d.references) ? lines(d.references) : ["Հեղինակ ԱԲ, Հեղինակ ԳԴ. Հոդվածի վերնագիր. Ամսագիր. Տարի;Հատոր(Համար):էջեր.", "Gagnier JJ, Kienle G, Altman DG, et al. The CARE guidelines: consensus-based clinical case reporting guideline development. J Clin Epidemiol. 2014;67(1):46-51."];
      text(s, rf.map(t => ({ text: t, options: { bullet: { type: "number" }, breakLine: true } })), { x: M, y: 1.75, w: W - 2 * M, h: 4.9, fontSize: 13, paraSpaceAfter: 8, guide: !has(d.references) });
    }

    /* ---------- 16. thanks ---------- */
    {
      const s = slide(true, null, null, TPL ? "Կոնտակտներ և հարցեր։ Հիշեցնել համաձայնության մասին։" : null);
      s.addShape("rect", { x: 0, y: 0, w: 0.12, h: H, fill: { color: C.coral }, line: { color: C.coral, width: 0 } });
      s.addText("Շնորհակալություն", { x: M, y: 2.2, w: W - 2 * M, h: 1.2, fontFace: SERIF, fontSize: 48, bold: true, color: C.light, margin: 0 });
      text(s, [{ text: G(d.presenter, "Անուն Ազգանուն"), options: { bold: true, breakLine: true } }, { text: G(d.contact, "էլ. հասցե · հեռախոս"), options: { color: C.gray } }], { x: M, y: 3.6, w: 8, h: 1, fontSize: 16, guide: !has(d.presenter) });
      text(s, "Բուժառուն տվել է գրավոր համաձայնություն լուսանկարների և տվյալների օգտագործման համար։", { x: M, y: 6.25, w: 9, h: 0.4, fontSize: 11, color: C.gray });
    }
    return pptx;
  }

  const api = { build };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.ISDDeck = api;
})(typeof window !== "undefined" ? window : globalThis);
