/* ISD Dental School — photo protocols, shot guide, pictograms and the collage renderer.
   Sources: AACD "12 required views"; Essential Dental Portfolio (Ahmad, jCD); 8 basic views (Dentistry Today). */
(function (root) {
  "use strict";
  const G = {
    face: '<ellipse cx="24" cy="16" rx="8.5" ry="11.5"/><path d="M20 20.5q4 3 8 0"/><path d="M20.5 13h.1M27.4 13h.1"/>',
    profile: '<path d="M20 4.5c5.5-1 10 2.6 10.5 7.4l2.8 4.2-2.4.9.8 2.8-1.4.6.5 2.2c-.5 1.8-2.9 2.3-5.8 1.8L24 28"/><path d="M20 4.5c-4 1.5-6 5.2-5.5 9.5.4 3.4 2.5 5.6 4.5 7"/>',
    smile: '<path d="M9 16q15-9 30 0q-15 12-30 0z"/><path d="M12.5 15.6q11.5 3.5 23 0"/><path d="M18 14.8v3.4M24 15.4v3.8M30 14.8v3.4"/>',
    frontal: '<path d="M8 9q16-5 32 0v6H8z"/><path d="M8 17h32v6q-16 5-32 0z"/><path d="M14 8v7M20 7v8M24 6.7v8.3M28 7v8M34 8v7M14 17v7M20 17v8M24 17v8.3M28 17v8M34 17v7"/>',
    latR: '<path d="M6 9h36v6H6zM6 17h36v6H6z"/><path d="M12 9v6M19 9v6M26 9v6M34 9v6M12 17v6M19 17v6M26 17v6M34 17v6"/><path d="M44 16h-3M44 16l-2-2M44 16l-2 2" stroke-width="1.4"/>',
    latL: '<path d="M6 9h36v6H6zM6 17h36v6H6z"/><path d="M14 9v6M22 9v6M29 9v6M36 9v6M14 17v6M22 17v6M29 17v6M36 17v6"/><path d="M4 16h3M4 16l2-2M4 16l2 2" stroke-width="1.4"/>',
    occU: '<path d="M11 28C10 8 38 8 37 28"/><path d="M16 27C15.5 14 32.5 14 32 27"/><path d="M20.5 9.8l1 4M27.5 9.8l-1 4M24 9.2v4.4"/>',
    occL: '<path d="M11 4C10 24 38 24 37 4"/><path d="M16 5C15.5 18 32.5 18 32 5"/><path d="M20.5 22.2l1-4M27.5 22.2l-1-4M24 22.8v-4.4"/>',
    ant: '<path d="M10 6h7v20h-7zM17 5h7v21h-7zM24 5h7v21h-7zM31 6h7v20h-7z"/>',
    antR: '<path d="M10 7h8v19h-8zM18 6h8v20h-8zM26 6h7v20h-7zM33 7.5h5v18h-5z"/>',
    antL: '<path d="M10 7.5h5v18h-5zM15 6h7v20h-7zM22 6h8v20h-8zM30 7h8v19h-8z"/>',
    smileR: '<path d="M9 16q15-9 30 0q-15 12-30 0z"/><path d="M12.5 15.6q11.5 3.5 23 0"/><path d="M44 16h-3M44 16l-2-2M44 16l-2 2" stroke-width="1.4"/>',
    smileL: '<path d="M9 16q15-9 30 0q-15 12-30 0z"/><path d="M12.5 15.6q11.5 3.5 23 0"/><path d="M4 16h3M4 16l2-2M4 16l2 2" stroke-width="1.4"/>'
  };
  const glyph = k => '<svg viewBox="0 0 48 32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (G[k] || G.frontal) + "</svg>";

  const T = {
    face: "Գլուխն ուղիղ, աչքերի գիծը հորիզոնական, միագույն ֆոն։ 1:10, f/8–f/11։ Կադրում՝ գլուխն ու պարանոցի վերին մասը։",
    profile: "Աջ պրոֆիլ, Ֆրանկֆուրտյան հարթությունը հորիզոնական, ականջը տեսանելի։ Նույն ֆոնը և խոշորացումը, ինչ դեմքի կադրում։",
    smile: "Բնական ժպիտ, շրթունքներն ու ատամները կադրում։ 1:2, կենտրոնական գիծը կադրի մեջտեղում, խցիկը զուգահեռ օկլյուզիոն հարթությանը։",
    frontal: "Ետքաշիչներ, սովորույթային կծվածք։ Ֆոկուսը՝ կենտրոնական կտրիչներ, օկլյուզիոն հարթությունը հորիզոնական։ 1:2, f/22–f/32։",
    latR: "Աջ ետքաշիչը ձգել դեպի հետ, կողմնային հայելին այտի կողմից։ Կադրում՝ կենտրոնական կտրիչից մինչև երկրորդ մոլյար։ Հայելով կադրը հավելվածը շրջում է ինքնաշխատ։",
    latL: "Ձախ ետքաշիչը ձգել դեպի հետ, կողմնային հայելին այտի կողմից։ Կադրում՝ կենտրոնական կտրիչից մինչև երկրորդ մոլյար։ Հայելով կադրը հավելվածը շրջում է ինքնաշխատ։",
    occU: "Բերանը լայն բաց, գլուխը մի փոքր ետ, օկլյուզիոն հայելին խցիկի առանցքի նկատմամբ 45°։ Ամբողջ աղեղը՝ կտրիչներից մինչև մոլյարներ։ Հայելին նախապես տաքացնել։",
    occL: "Լեզուն հայելու տակ, բուժառուն նայում է վեր։ Հայելին՝ վերջին մոլյարից հետ, 45°։ Ամբողջ աղեղը, առանց շրթունքների ու մատների։",
    smileF: "Ժպիտ՝ ճակատից, 1:2։ Կենտրոնական գիծը մեջտեղում, ինցիզալ հարթությունը հորիզոնական։",
    smileR: "Ժպիտ՝ աջ կողմից, 1:2։ Խցիկը շրջել այնպես, որ կադրի կենտրոնում լինի աջ ժանիքը։",
    smileL: "Ժպիտ՝ ձախ կողմից, 1:2։ Կադրի կենտրոնում՝ ձախ ժանիքը։",
    retrF: "Ետքաշիչներ, սովորույթային կծվածք, 1:2։ Ֆոկուսը՝ կենտրոնական կտրիչներ։",
    retrR: "Ետքաշիչներով աջ կողմնային, 1:2։ Կադրի կենտրոնում՝ աջ ժանիքը։",
    retrL: "Ետքաշիչներով ձախ կողմնային, 1:2։ Կադրի կենտրոնում՝ ձախ ժանիքը։",
    antF: "Վերին առջևի ատամներ՝ ճակատից, 1:1։ Ցանկալի է սև կոնտրաստեր։",
    antR: "Վերին առջևի ատամներ՝ աջից, 1:1։ Կենտրոնում՝ աջ կողմնային կտրիչը։",
    antL: "Վերին առջևի ատամներ՝ ձախից, 1:1։ Կենտրոնում՝ ձախ կողմնային կտրիչը։"
  };

  const S = (key, name, short, mag, kind, icon, extra) => Object.assign({ key, name, short, mag, kind, icon, tip: T[key] || "" }, extra || {});

  const PROTOCOLS = {
    basic8: {
      id: "basic8",
      name: "Նվազագույն շարք · 8 կադր",
      desc: "3 արտաբերանային + 5 ներբերանային։ Յուրաքանչյուր դեպքի համար։",
      slots: [
        S("face", "Դեմք՝ ճակատից, ժպիտով", "Դեմք", "1:10", "extra", "face"),
        S("profile", "Պրոֆիլ աջից", "Պրոֆիլ", "1:10", "extra", "profile"),
        S("smile", "Ժպիտ մոտիկից", "Ժպիտ", "1:2", "extra", "smile"),
        S("frontal", "Ճակատային՝ ետքաշիչներով, սովորույթային կծվածքում", "Ճակատային", "1:2", "intra", "frontal"),
        S("latR", "Աջ կողմնային", "Աջ կողմ", "1:2", "intra", "latR", { mirror: "H", optionalMirror: true }),
        S("latL", "Ձախ կողմնային", "Ձախ կողմ", "1:2", "intra", "latL", { mirror: "H", optionalMirror: true }),
        S("occU", "Վերին ծնոտ՝ օկլյուզիոն", "Վերին ծնոտ", "1:2", "intra", "occU", { mirror: "V" }),
        S("occL", "Ստորին ծնոտ՝ օկլյուզիոն", "Ստորին ծնոտ", "1:2", "intra", "occL", { mirror: "V" })
      ],
      layout: [
        { aspects: [0.75, 0.75, 1.5], cells: ["profile", "face", "smile"] },
        { aspect: 1.5, cells: ["latR", "frontal", "latL"] },
        { aspect: 1.5, cells: ["occU", "@info", "occL"] }
      ]
    },
    aacd12: {
      id: "aacd12",
      name: "Ընդլայնված շարք · 12 կադր (AACD)",
      desc: "Էսթետիկ և համալիր դեպքերի համար։ AACD-ի 12 տեսքը։",
      slots: [
        S("face", "Դեմք՝ ժպիտով", "Դեմք", "1:10", "extra", "face"),
        S("smileF", "Ժպիտ՝ ճակատից", "Ժպիտ ճակատ", "1:2", "extra", "smile"),
        S("smileR", "Ժպիտ՝ աջ կողմից", "Ժպիտ աջ", "1:2", "extra", "smileR"),
        S("smileL", "Ժպիտ՝ ձախ կողմից", "Ժպիտ ձախ", "1:2", "extra", "smileL"),
        S("retrF", "Ետքաշիչներով՝ ճակատային", "Ճակատային", "1:2", "intra", "frontal"),
        S("retrR", "Ետքաշիչներով՝ աջ կողմնային", "Աջ կողմ", "1:2", "intra", "latR"),
        S("retrL", "Ետքաշիչներով՝ ձախ կողմնային", "Ձախ կողմ", "1:2", "intra", "latL"),
        S("antF", "Վերին առջևի ատամներ՝ ճակատից", "Առջևի 1:1", "1:1", "intra", "ant"),
        S("antR", "Վերին առջևի ատամներ՝ աջից", "Առջևի աջ", "1:1", "intra", "antR"),
        S("antL", "Վերին առջևի ատամներ՝ ձախից", "Առջևի ձախ", "1:1", "intra", "antL"),
        S("occU", "Վերին ծնոտ՝ օկլյուզիոն", "Վերին ծնոտ", "1:2", "intra", "occU", { mirror: "V" }),
        S("occL", "Ստորին ծնոտ՝ օկլյուզիոն", "Ստորին ծնոտ", "1:2", "intra", "occL", { mirror: "V" })
      ],
      layout: [
        { aspect: 1.5, cells: ["face", "smileR", "smileF", "smileL"] },
        { aspect: 1.5, cells: ["occU", "retrR", "retrF", "retrL"] },
        { aspect: 1.5, cells: ["occL", "antR", "antF", "antL"] }
      ]
    }
  };

  const STAGES = [
    { id: "pre", name: "Նախքան բուժումը" },
    { id: "mid", name: "Բուժման ընթացքում" },
    { id: "post", name: "Բուժումից հետո" },
    { id: "fu", name: "Հետևում" }
  ];
  const stageName = id => (STAGES.find(s => s.id === id) || STAGES[0]).name;
  const slotOf = (proto, key) => PROTOCOLS[proto].slots.find(s => s.key === key);

  /* Transform a slot's photo should get on assignment (mirror correction). */
  function defaultTransform(slot, mirrorLateral) {
    const t = { flipH: false, flipV: false, rot: 0 };
    if (!slot || !slot.mirror) return t;
    if (slot.optionalMirror && !mirrorLateral) return t;
    if (slot.mirror === "H") t.flipH = true;
    if (slot.mirror === "V") t.flipV = true;
    return t;
  }

  /* ---------- collage ---------- */
  async function fontsReady() { try { await Promise.all([document.fonts.load('700 40px "NSA"'), document.fonts.load('400 20px "NSA"'), document.fonts.load('700 40px "NSerif"')]); } catch (e) {} }

  async function renderCollage(series, opts) {
    opts = opts || {};
    await fontsReady();
    const proto = PROTOCOLS[series.protocol];
    const W = opts.width || 3000, pad = Math.round(W * 0.018), gap = Math.round(W * 0.006);
    const headH = Math.round(W * 0.075);
    const rows = proto.layout.map(r => {
      const avail = W - 2 * pad - (r.cells.length - 1) * gap;
      const asp = r.aspects || r.cells.map(() => r.aspect);
      const ch = Math.round(avail / asp.reduce((a, b) => a + b, 0));
      return { r, ch, cws: asp.map(a => a * ch) };
    });
    const H = pad + headH + gap + rows.reduce((a, x) => a + x.ch, 0) + gap * (rows.length - 1) + pad + Math.round(W * 0.018);
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const x = c.getContext("2d");
    x.fillStyle = "#0b0e0f"; x.fillRect(0, 0, W, H);

    // header band
    const hy = pad, f = W / 3000;
    x.fillStyle = "#151a1c"; roundRect(x, pad, hy, W - 2 * pad, headH, 14 * f); x.fill();
    x.fillStyle = "#ff5c47"; x.fillRect(pad, hy, 10 * f, headH);
    x.textBaseline = "middle";
    x.fillStyle = "#eef1ef"; x.font = '700 ' + Math.round(64 * f) + 'px "NSA", sans-serif';
    x.fillText(series.code || "Առանց կոդի", pad + 50 * f, hy + headH * 0.42);
    x.fillStyle = "#8b9591"; x.font = '400 ' + Math.round(32 * f) + 'px "NSA", sans-serif';
    x.fillText([stageName(series.stage), ISD.fmtDate(series.date), proto.name].filter(Boolean).join("   ·   "), pad + 50 * f, hy + headH * 0.78);
    x.textAlign = "right";
    x.fillStyle = "#eef1ef"; x.font = '700 ' + Math.round(36 * f) + 'px "NSA", sans-serif';
    x.fillText("ISD Dental School", W - pad - 44 * f, hy + headH * 0.40);
    if (opts.doctor) { x.fillStyle = "#8b9591"; x.font = '400 ' + Math.round(28 * f) + 'px "NSA", sans-serif'; x.fillText(opts.doctor, W - pad - 44 * f, hy + headH * 0.76); }
    x.textAlign = "left";

    let y = hy + headH + gap;
    for (const row of rows) {
      let cx = pad;
      for (let ci = 0; ci < row.r.cells.length; ci++) {
        const key = row.r.cells[ci], w = row.cws[ci], h = row.ch;
        x.fillStyle = "#151a1c"; x.fillRect(cx, y, w, h);
        if (key === "@info") {
          drawInfo(x, cx, y, w, h, series, f);
        } else {
          const slot = slotOf(series.protocol, key), a = series.slots[key];
          if (a && a.photoId) {
            const img = await (opts.getImage ? opts.getImage(a.photoId) : ISD.bitmap(a.photoId, "full"));
            if (img) ISD.drawPhoto(x, img, cx, y, w, h, a, slot.kind === "extra" ? "contain" : "cover", "#151a1c");
          } else {
            x.fillStyle = "#3a4245"; x.font = '400 ' + Math.round(30 * f) + 'px "NSA", sans-serif'; x.textAlign = "center";
            x.fillText("—", cx + w / 2, y + h / 2); x.textAlign = "left";
          }
          if (opts.labels !== false) {
            const lh = Math.round(46 * f);
            const g = x.createLinearGradient(0, y + h - lh * 1.6, 0, y + h);
            g.addColorStop(0, "rgba(11,14,15,0)"); g.addColorStop(1, "rgba(11,14,15,.78)");
            x.fillStyle = g; x.fillRect(cx, y + h - lh * 1.6, w, lh * 1.6);
            x.fillStyle = "#eef1ef"; x.font = '500 ' + Math.round(26 * f) + 'px "NSA", sans-serif'; x.textBaseline = "alphabetic";
            x.fillText(slot.short + "  ·  " + slot.mag, cx + 18 * f, y + h - 16 * f); x.textBaseline = "middle";
          }
        }
        cx += w + gap;
      }
      y += row.ch + gap;
    }
    x.fillStyle = "#59625f"; x.font = '400 ' + Math.round(22 * f) + 'px "NSA", sans-serif'; x.textBaseline = "alphabetic";
    x.fillText("Բուժառուի համաձայնությամբ · միայն մասնագիտական օգտագործման համար", pad, H - pad * 0.55);
    return c;
  }
  function drawInfo(x, cx, y, w, h, s, f) {
    x.save();
    x.strokeStyle = "#ff5c47"; x.lineWidth = 4 * f; const k = 40 * f, m = 26 * f;
    x.beginPath(); x.moveTo(cx + m, cy(m + k)); x.lineTo(cx + m, cy(m)); x.lineTo(cx + m + k, cy(m)); x.stroke();
    x.beginPath(); x.moveTo(cx + w - m, y + h - m - k); x.lineTo(cx + w - m, y + h - m); x.lineTo(cx + w - m - k, y + h - m); x.stroke();
    function cy(v) { return y + v; }
    x.textAlign = "center"; x.textBaseline = "middle";
    x.fillStyle = "#ff5c47"; x.font = '700 ' + Math.round(44 * f) + 'px "NSerif", serif';
    x.fillText(stageName(s.stage), cx + w / 2, y + h * 0.40);
    x.fillStyle = "#eef1ef"; x.font = '500 ' + Math.round(30 * f) + 'px "NSA", sans-serif';
    x.fillText(ISD.fmtDate(s.date), cx + w / 2, y + h * 0.58);
    x.restore();
  }
  function roundRect(x, a, b, w, h, r) { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); }

  root.ISDPhoto = { PROTOCOLS, STAGES, stageName, slotOf, glyph, defaultTransform, renderCollage, fontsReady };
})(window);
