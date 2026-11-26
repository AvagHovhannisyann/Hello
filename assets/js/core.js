/* ISD Dental School — shared core: storage (IndexedDB), helpers, images, files, UI bits.
   Everything stays on the device. Nothing here talks to a server. */
(function (root) {
  "use strict";

  /* ---------- storage ---------- */
  const DB_NAME = "isd-dental", DB_VER = 1, STORES = ["cases", "photos", "series", "meta"];
  let dbp = null;
  function open() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open(DB_NAME, DB_VER);
      r.onupgradeneeded = () => {
        const d = r.result;
        STORES.forEach(s => { if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: "id" }); });
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return dbp;
  }
  const req = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  async function store(name, mode) { const d = await open(); return d.transaction(name, mode || "readonly").objectStore(name); }
  const db = {
    get: async (s, id) => req((await store(s)).get(id)),
    all: async s => req((await store(s)).getAll()),
    put: async (s, obj) => req((await store(s, "readwrite")).put(obj)),
    del: async (s, id) => req((await store(s, "readwrite")).delete(id)),
    clear: async s => req((await store(s, "readwrite")).clear()),
    meta: async (id, fallback) => { const m = await db.get("meta", id); return m ? m.value : fallback; },
    setMeta: async (id, value) => db.put("meta", { id, value })
  };
  async function persist() { try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch (e) {} }

  /* ---------- small helpers ---------- */
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : "id-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const $ = (sel, el) => (el || document).querySelector(sel);
  const $$ = (sel, el) => Array.from((el || document).querySelectorAll(sel));
  const today = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  const MONTHS = ["հունվարի", "փետրվարի", "մարտի", "ապրիլի", "մայիսի", "հունիսի", "հուլիսի", "օգոստոսի", "սեպտեմբերի", "հոկտեմբերի", "նոյեմբերի", "դեկտեմբերի"];
  function fmtDate(iso) {
    if (!iso) return "";
    const d = new Date(iso.length <= 10 ? iso + "T12:00:00" : iso);
    if (isNaN(d)) return iso;
    return d.getDate() + " " + MONTHS[d.getMonth()] + " " + d.getFullYear();
  }
  const fmtShort = iso => { if (!iso) return ""; const p = iso.slice(0, 10).split("-"); return p.length === 3 ? p[2] + "." + p[1] + "." + p[0] : iso; };
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

  /* ---------- toast & sheet ---------- */
  function toast(msg, ms) {
    const t = document.createElement("div");
    t.className = "toast"; t.setAttribute("role", "status"); t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), ms || 2600);
  }
  function sheet(html, opts) {
    opts = opts || {};
    const back = document.createElement("div");
    back.className = "sheet-back";
    back.innerHTML = '<div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>' + html + "</div>";
    document.body.appendChild(back);
    document.documentElement.style.overflow = "hidden";
    const close = () => { back.remove(); document.documentElement.style.overflow = ""; opts.onClose && opts.onClose(); };
    back.addEventListener("click", e => { if (e.target === back && !opts.sticky) close(); });
    back.addEventListener("keydown", e => { if (e.key === "Escape" && !opts.sticky) close(); });
    const first = back.querySelector("[autofocus],input,select,textarea,button");
    if (first && opts.focus !== false) setTimeout(() => first.focus({ preventScroll: true }), 30);
    return { el: back.firstElementChild, close };
  }
  function confirmBox(text, okLabel) {
    return new Promise(res => {
      const s = sheet('<p style="font-size:17px;margin:4px 0 18px">' + esc(text) + '</p><div class="row" style="justify-content:flex-end"><button class="btn" data-no>Չեղարկել</button><button class="btn primary" data-yes>' + esc(okLabel || "Այո") + "</button></div>", { onClose: () => res(false) });
      s.el.querySelector("[data-no]").onclick = () => { s.close(); };
      s.el.querySelector("[data-yes]").onclick = () => { res(true); s.close(); };
    });
  }

  /* ---------- files ---------- */
  const isTouch = () => matchMedia("(pointer:coarse)").matches;
  async function saveFile(blob, filename) {
    try {
      const file = new File([blob], filename, { type: blob.type || "application/octet-stream" });
      if (isTouch() && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: filename });
        return true;
      }
    } catch (e) { if (e && e.name === "AbortError") return false; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.rel = "noopener";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return true;
  }
  const blobToDataURL = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
  async function dataURLToBlob(u) { const r = await fetch(u); return r.blob(); }
  const safeName = s => String(s || "").trim().replace(/[\\/:*?"<>|\s]+/g, "_").slice(0, 60) || "file";

  /* ---------- images ---------- */
  async function decode(blob) {
    if (root.createImageBitmap) {
      try { return await createImageBitmap(blob, { imageOrientation: "from-image" }); } catch (e) {}
      try { return await createImageBitmap(blob); } catch (e) {}
    }
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(blob), img = new Image();
      img.onload = () => { res(img); setTimeout(() => URL.revokeObjectURL(url), 1000); };
      img.onerror = () => rej(new Error("decode"));
      img.src = url;
    });
  }
  function canvasToBlob(c, type, q) { return new Promise(res => c.toBlob(b => res(b), type || "image/jpeg", q == null ? 0.9 : q)); }
  function scaled(img, maxEdge) {
    const w = img.width, h = img.height, s = Math.min(1, maxEdge / Math.max(w, h));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w * s)); c.height = Math.max(1, Math.round(h * s));
    const x = c.getContext("2d"); x.imageSmoothingQuality = "high"; x.drawImage(img, 0, 0, c.width, c.height);
    return c;
  }
  async function takenAt(file) {
    try {
      if (root.exifr) {
        const t = await root.exifr.parse(file, ["DateTimeOriginal", "CreateDate"]);
        const d = t && (t.DateTimeOriginal || t.CreateDate);
        if (d instanceof Date && !isNaN(d)) return d.getTime();
      }
    } catch (e) {}
    return file.lastModified || Date.now();
  }
  /* Import a picked file: downscale to 2400 px (enough for slides and print), keep a 480 px thumb. */
  async function importPhoto(file) {
    const at = await takenAt(file);
    const img = await decode(file);
    const full = scaled(img, 2400), th = scaled(img, 480);
    const rec = { id: uid(), blob: await canvasToBlob(full, "image/jpeg", 0.9), thumb: await canvasToBlob(th, "image/jpeg", 0.82), w: full.width, h: full.height, takenAt: at, name: file.name || "", added: Date.now() };
    if (img.close) img.close();
    await db.put("photos", rec);
    return rec;
  }
  const bmpCache = new Map();
  async function bitmap(photoId, which) {
    const key = photoId + ":" + (which || "thumb");
    if (bmpCache.has(key)) return bmpCache.get(key);
    const rec = await db.get("photos", photoId);
    if (!rec) return null;
    const b = await decode(which === "full" ? rec.blob : rec.thumb);
    if (bmpCache.size > 160) bmpCache.clear();
    bmpCache.set(key, b);
    return b;
  }
  /* Draw with screen-space flips, quarter-turn rotation and fit (cover|contain). */
  function drawPhoto(ctx, img, x, y, w, h, t, fit, bg) {
    t = t || {};
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    if (bg) { ctx.fillStyle = bg; ctx.fillRect(x, y, w, h); }
    const rot = ((t.rot || 0) % 4 + 4) % 4, iw = img.width, ih = img.height;
    const ew = rot % 2 ? ih : iw, eh = rot % 2 ? iw : ih;
    const s = fit === "contain" ? Math.min(w / ew, h / eh) : Math.max(w / ew, h / eh);
    ctx.translate(x + w / 2, y + h / 2);
    ctx.scale(t.flipH ? -1 : 1, t.flipV ? -1 : 1);
    ctx.rotate(rot * Math.PI / 2);
    ctx.drawImage(img, -iw * s / 2, -ih * s / 2, iw * s, ih * s);
    ctx.restore();
  }
  /* Full-resolution corrected copy (for slides): returns a JPEG data URL and its aspect. */
  async function correctedDataURL(photoId, t, maxEdge) {
    const img = await bitmap(photoId, "full");
    if (!img) return null;
    const rot = ((t && t.rot) || 0) % 2;
    let w = rot ? img.height : img.width, h = rot ? img.width : img.height;
    const s = Math.min(1, (maxEdge || 1800) / Math.max(w, h)); w = Math.round(w * s); h = Math.round(h * s);
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    drawPhoto(c.getContext("2d"), img, 0, 0, w, h, t, "contain");
    return { data: c.toDataURL("image/jpeg", 0.88), w, h };
  }

  /* ---------- profile & install id ---------- */
  async function installId() {
    let id = await db.meta("installId");
    if (!id) { id = uid(); await db.setMeta("installId", id); }
    return id;
  }

  /* ---------- icons (inline, stroke) ---------- */
  const P = {
    cases: '<path d="M4 7h16v12H4z"/><path d="M9 7V5h6v2"/><path d="M4 12h16"/>',
    log: '<path d="M6 4h12v16H6z"/><path d="M9 8h6M9 12h6M9 16h4"/>',
    cv: '<circle cx="12" cy="8" r="3.2"/><path d="M5.5 19c1.2-3.4 3.6-5 6.5-5s5.3 1.6 6.5 5"/>',
    more: '<circle cx="6" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="18" cy="12" r="1.4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    camera: '<path d="M4 8h3.5L9 6h6l1.5 2H20v11H4z"/><circle cx="12" cy="13" r="3.6"/>',
    image: '<path d="M4 5h16v14H4z"/><path d="m4 16 5-5 4 4 2-2 5 5"/><circle cx="15.5" cy="9" r="1.5"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v4h16v-4"/>',
    download: '<path d="M12 4v12M7 11l5 5 5-5"/><path d="M4 18v2h16v-2"/>',
    flipH: '<path d="M12 3v18"/><path d="M9 7 4 12l5 5z"/><path d="m15 7 5 5-5 5"/>',
    flipV: '<path d="M3 12h18"/><path d="M7 9l5-5 5 5z"/><path d="m7 15 5 5 5-5"/>',
    rotate: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
    swap: '<path d="M7 7h12l-3-3M17 17H5l3 3"/>',
    trash: '<path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13"/>',
    back: '<path d="m15 5-7 7 7 7"/>',
    check: '<path d="m5 12 5 5 9-10"/>',
    album: '<rect x="3" y="7" width="14" height="13" rx="2"/><path d="M7 4h12a2 2 0 0 1 2 2v10"/><path d="m3 17 4-4 3 3 2-2 5 5"/>',
    play: '<path d="M8 5v14l11-7z"/>',
    next: '<path d="m9 5 7 7-7 7"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
    grid: '<path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/>',
    file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>',
    slides: '<path d="M3 5h18v11H3z"/><path d="M12 16v4M8 20h8"/>',
    print: '<path d="M7 9V4h10v5"/><path d="M5 9h14v7h-3v4H8v-4H5z"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8v.5"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'
  };
  const icon = (n, extra) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"' + (extra || "") + ">" + (P[n] || "") + "</svg>";
  const mark = (dark) => '<svg class="mark" viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="9" fill="' + (dark ? "#eef1ef" : "#101517") + '"/><path d="M8 14V8h6M32 26v6h-6" fill="none" stroke="#ff5c47" stroke-width="2.4"/><text x="20" y="25" text-anchor="middle" font-family="NSA,Arial,sans-serif" font-weight="700" font-size="12.5" letter-spacing=".5" fill="' + (dark ? "#101517" : "#f5f5f1") + '">ISD</text></svg>';

  function registerSW() {
    if ("serviceWorker" in navigator && location.protocol !== "file:") {
      navigator.serviceWorker.register("../sw.js", { scope: "../" }).catch(() => {});
    }
  }

  root.ISD = { db, persist, uid, esc, $, $$, today, fmtDate, fmtShort, debounce, toast, sheet, confirmBox, saveFile, blobToDataURL, dataURLToBlob, safeName, decode, canvasToBlob, importPhoto, bitmap, drawPhoto, correctedDataURL, installId, icon, mark, registerSW, isTouch };
})(window);
