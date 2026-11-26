/**
 * ISD Dental School — сбор анонимной анкеты и счётчиков из приложений «Պորտֆոլիո» и «Ֆոտոարձանագրություն».
 *
 * Установка (5 минут):
 *  1. Создайте пустую Google Таблицу → Расширения → Apps Script → вставьте этот файл целиком → Сохранить.
 *  2. Выберите функцию setup → Выполнить → разрешите доступ (один раз).
 *  3. Развернуть → Новое развертывание → тип «Веб-приложение»; Выполнять как: «Я»; Доступ: «Все» → Развернуть.
 *  4. Скопируйте URL веб-приложения (…/exec) и вставьте в assets/js/config.js → endpoint.
 *
 * Что приходит:
 *  — «Գրանցում»: регистрация врача (имя, телефон, e-mail, специализация, марз и община, клиника) — один раз, с его согласия;
 *  — «Հարցում»: анонимные ответы на 12 вопросов — НЕ связаны с регистрацией (другой ID);
 *  — «Օգտագործում»: счётчики (кол-во кейсов, серий фото, направления) — тоже без имени.
 * Чего здесь нет и не может быть: данных пациентов, фотографий, текстов кейсов.
 */

const SH_SURVEY = "Հարցում";
const SH_STATS = "Օգտագործում";
const SH_SUMMARY = "Ամփոփում";
const SH_REG = "Գրանցում";
const REG_COLS = ["Գրանցվել է", "Թարմացվել է", "ID", "Անուն, ազգանուն", "Հեռախոս", "Էլ. փոստ", "Մասնագիտացում", "Մարզ", "Համայնք / բնակավայր", "Կլինիկա / բուհ", "Լուրեր դասընթացների մասին", "Հավելված", "Սարք"];
const MARZ = ["Երևան", "Արագածոտն", "Արարատ", "Արմավիր", "Գեղարքունիք", "Կոտայք", "Լոռի", "Շիրակ", "Սյունիք", "Տավուշ", "Վայոց ձոր", "Արտերկիր"];

// Keep in sync with assets/js/survey.js
const Q = [
  ["role", "Մասնագիտացում", ["Ուսանող", "Օրդինատոր", "Ընդհանուր (ընտանեկան) ստոմատոլոգ", "Թերապևտ", "Օրթոպեդ", "Վիրաբույժ, իմպլանտոլոգ", "Պերիօդոնտոլոգ", "Օրթոդոնտ", "Մանկական ստոմատոլոգ", "Այլ"]],
  ["exp", "Փորձ", ["Դեռ սովորում եմ", "2 տարուց քիչ", "2–5 տարի", "5–10 տարի", "10 տարուց ավել"]],
  ["region", "Որտեղ է աշխատում", ["Երևան", "Մարզ", "Արտերկիր"]],
  ["work", "Աշխատանքի ձև", ["Սեփական կլինիկա", "Վարձու աշխատող", "Աթոռի վարձակալություն", "Համալսարան / կլինիկա-բազա", "Դեռ չեմ աշխատում"]],
  ["photoFreq", "Որքան հաճախ է լուսանկարում", ["Երբեք", "Հազվադեպ", "Միայն հետաքրքիր դեպքերը", "Գրեթե բոլորը"]],
  ["camera", "Ինչով է լուսանկարում", ["Հեռախոս", "Հեռախոս + լույս կամ մակրո ոսպնյակ", "DSLR / mirrorless + մակրո", "Ներբերանային տեսախցիկ", "Չեմ լուսանկարում"]],
  ["mirrors", "Հայելիներ և ետքաշիչներ", ["Այո", "Միայն ետքաշիչներ", "Ոչ"]],
  ["logbook", "Գրանցամատյան", ["Այո, կանոնավոր", "Մասամբ", "Ոչ"]],
  ["cases", "Փաստաթղթավորված դեպքեր", ["0", "1–5", "6–20", "20-ից ավել"]],
  ["cv", "Թարմ CV", ["Այո", "Կա, բայց հին է", "Ոչ"]],
  ["barrier", "Ինչն է խանգարում", ["Ժամանակը", "Սարքավորումը", "Չգիտեմ ինչպես", "Բուժառուի համաձայնությունը", "Պահպանումն ու կազմակերպումը", "Կարիք չեմ տեսնում"]],
  ["courses", "Ցանկալի դասընթացներ", ["Կլինիկական լուսանկարչություն", "Դեպքի ներկայացում", "CV և դիմումներ արտերկրի ծրագրերին", "Գիտական հոդված գրել", "Սոցիալական ցանցեր բժշկի համար"]]
];
const STAT_COLS = ["Վերջին այց", "Սարք (անանուն ID)", "Հավելված", "Տարբերակ", "Դեպքեր", "Պատրաստ դեպքեր", "Դեպքեր լուսանկարներով", "Շարքեր", "Լուսանկարներ", "Ամբողջական շարքեր", "Ոլորտներ", "CV լրացված"];

function setup() {
  const ss = book();
  const sv = ss.getSheetByName(SH_SURVEY) || ss.insertSheet(SH_SURVEY);
  sv.getRange(1, 1, 1, 4 + Q.length).setValues([["Ժամ", "Սարք (անանուն ID)", "Հավելված", "Տարբերակ"].concat(Q.map(q => q[1]))]).setFontWeight("bold");
  sv.setFrozenRows(1);
  const st = ss.getSheetByName(SH_STATS) || ss.insertSheet(SH_STATS);
  st.getRange(1, 1, 1, STAT_COLS.length).setValues([STAT_COLS]).setFontWeight("bold");
  st.setFrozenRows(1);
  (ss.getSheetByName(SH_SUMMARY) || ss.insertSheet(SH_SUMMARY, 0));
  regSheet(ss);
  const def = ss.getSheetByName("Sheet1") || ss.getSheetByName("Лист1") || ss.getSheetByName("Թերթ1");
  if (def && ss.getSheets().length > 4) ss.deleteSheet(def);
  refreshSummary();
  Logger.log("Таблица: " + ss.getUrl());
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(15000);
  try {
    const d = JSON.parse(e.postData.contents);
    const ss = book();
    if (d.type === "register") return ContentService.createTextOutput(register(ss, d));
    if (d.type === "survey") {
      const a = d.answers || {};
      ss.getSheetByName(SH_SURVEY).appendRow([new Date(), clip(d.installId), clip(d.app), clip(d.version)].concat(Q.map(q => clip(a[q[0]]))));
    } else if (d.type === "stats") {
      const sh = ss.getSheetByName(SH_STATS);
      const row = [new Date(), clip(d.installId), clip(d.app), clip(d.version), num(d.cases), num(d.casesReady), num(d.casesWithPhotos), num(d.series), num(d.photos), num(d.seriesComplete), clip(d.disciplines), d.cvFilled === true ? "այո" : (d.cvFilled === false ? "ոչ" : "")];
      const vals = sh.getLastRow() > 1 ? sh.getRange(2, 2, sh.getLastRow() - 1, 2).getValues() : [];
      const i = vals.findIndex(v => v[0] === row[1] && v[1] === row[2]);
      if (i >= 0) sh.getRange(i + 2, 1, 1, row.length).setValues([row]); else sh.appendRow(row);
    }
    return ContentService.createTextOutput("ok");
  } catch (err) {
    return ContentService.createTextOutput("error");
  } finally {
    lock.releaseLock();
  }
}

/* Registration: one row per doctor. Same ID or same phone number → the row is updated, not duplicated
   (e.g. the same doctor opens «Ֆոտո» on a computer after «Պորտֆոլիո» on the phone). */
function regSheet(ss) {
  let sh = ss.getSheetByName(SH_REG);
  if (!sh) {
    sh = ss.insertSheet(SH_REG, 1);
    sh.getRange(1, 1, 1, REG_COLS.length).setValues([REG_COLS]).setFontWeight("bold");
    sh.setFrozenRows(1);
    sh.getRange("E:E").setNumberFormat("@");
    sh.setColumnWidth(4, 220); sh.setColumnWidth(6, 200); sh.setColumnWidth(7, 220); sh.setColumnWidth(9, 200); sh.setColumnWidth(10, 220);
  } else if (String(sh.getRange(1, 8).getValue()) !== "Մարզ") {
    // sheet made by the first version of Update 7 (no marz / community): add the two columns after «Մասնագիտացում»
    sh.insertColumnsAfter(7, 2);
    sh.getRange(1, 1, 1, REG_COLS.length).setValues([REG_COLS]).setFontWeight("bold");
  }
  return sh;
}
function register(ss, d) {
  const sh = regSheet(ss);
  const id = clip(d.regId), phone = clip(d.phone), key = digits(phone);
  if (!id || !clip(d.name) || key.length < 6) return "error";
  const n = Math.max(0, sh.getLastRow() - 1);
  const vals = n ? sh.getRange(2, 1, n, REG_COLS.length).getValues() : [];
  let i = vals.findIndex(v => String(v[2]) === id);
  if (i < 0) i = vals.findIndex(v => digits(v[4]) === key);
  const join = (a, b) => { const set = String(a || "").split(", ").filter(String); if (b && set.indexOf(b) < 0) set.push(b); return set.join(", "); };
  const old = i >= 0 ? vals[i] : null;
  const row = [old ? old[0] : new Date(), new Date(), old ? old[2] : id, clip(d.name), phone, clip(d.email), clip(d.role), clip(d.region), clip(d.locality), clip(d.place),
    d.news === true ? "այո" : "ոչ", join(old && old[11], clip(d.app)), join(old && old[12], clip(d.device))];
  if (old) sh.getRange(i + 2, 1, 1, row.length).setValues([row]); else sh.appendRow(row);
  return "registered";
}

/* GET …/exec?summary=1 → anonymous totals for the live results page (isd-dental.vercel.app/live).
   Only counts per answer — never single rows. */
function doGet(e) {
  if (!(e && e.parameter && e.parameter.summary)) return ContentService.createTextOutput("ISD Dental School collector: OK");
  const sv = book().getSheetByName(SH_SURVEY);
  const n = sv ? Math.max(0, sv.getLastRow() - 1) : 0;
  const data = n ? sv.getRange(2, 5, n, Q.length).getDisplayValues() : [];
  const rows = data.filter(r => r.some(v => String(v).trim() !== ""));
  const out = { n: rows.length, updated: new Date().toISOString(), q: {} };
  Q.forEach((q, qi) => {
    const c = {};
    q[2].forEach(opt => { c[opt] = rows.filter(r => String(r[qi]).split("; ").indexOf(opt) >= 0).length; });
    out.q[q[0]] = c;
  });
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

/* «Ամփոփում»: live summary built from formulas, so it follows the «Հարցում» sheet by itself —
   new answers, deleted rows, cleared cells. Run refreshSummary (or setup) once after pasting this code. */
function refreshSummary() {
  const ss = book();
  regSheet(ss);
  const out = ss.getSheetByName(SH_SUMMARY) || ss.insertSheet(SH_SUMMARY, 0);
  const src = "'" + SH_SURVEY + "'!";
  const col = i => { let n = i, s = ""; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
  const lit = t => '"' + String(t).replace(/"/g, '""') + '"';
  const rows = [
    ["Հայ ստոմատոլոգները թվերով", "", "", ""],
    ["Պատասխանողներ", "=COUNTA(" + src + "A2:A)", "", ""],
    ["Գրանցված օգտատերեր", "=COUNTA('" + SH_REG + "'!C2:C)", "", ""],
    ["Հարց", "Պատասխան", "Քանակ", "%"]
  ];
  Q.forEach((q, qi) => {
    const R = src + col(5 + qi) + "2:" + col(5 + qi);
    q[2].forEach((opt, oi) => {
      const r = rows.length + 1;
      // exact match of one answer, also inside multi-choice cells joined with "; "
      const f = "=COUNTIF(" + R + "," + lit(opt) + ")+COUNTIF(" + R + "," + lit(opt + "; *") + ")+COUNTIF(" + R + "," + lit("*; " + opt) + ")+COUNTIF(" + R + "," + lit("*; " + opt + "; *") + ")";
      rows.push([oi === 0 ? q[1] : "", opt, f, "=IF($B$2=0,0,C" + r + "/$B$2)"]);
    });
  });
  // registrations by marz, under the survey block
  const reg = "'" + SH_REG + "'!H2:H";
  rows.push(["", "", "", ""], ["Գրանցվածներ ըստ մարզերի", "Մարզ", "Քանակ", "%"]);
  MARZ.forEach(m => { const r = rows.length + 1; rows.push(["", m, "=COUNTIF(" + reg + "," + lit(m) + ")", "=IF($B$3=0,0,C" + r + "/$B$3)"]); });
  out.clear();
  const isF = v => typeof v === "string" && v.charAt(0) === "=";
  out.getRange(1, 1, rows.length, 4).setValues(rows.map(r => r.map(v => isF(v) ? "" : v)));
  // Formula argument separator depends on the Sheet's language: "," (English) or ";" (Russian, Armenian…).
  // Write with ",", check the result, and switch to ";" if the Sheet could not read it.
  const put = sep => {
    const fx = f => sep === "," ? f : f.replace(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/g, ";");
    rows.forEach((r, i) => r.forEach((v, c) => { if (isF(v)) out.getRange(i + 1, c + 1).setFormula(fx(v)); }));
    SpreadsheetApp.flush();
    return !/^#/.test(String(out.getRange(5, 3).getDisplayValue())) && !/^#/.test(String(out.getRange(5, 4).getDisplayValue()));
  };
  if (!put(",")) put(";");
  out.getRange(1, 1).setFontSize(18).setFontWeight("bold");
  out.getRange(2, 1, 2, 2).setFontWeight("bold");
  out.getRange(4, 1, 1, 4).setFontWeight("bold");
  out.getRange(rows.length - MARZ.length, 1, 1, 4).setFontWeight("bold");
  out.getRange(5, 4, rows.length - 4, 1).setNumberFormat("0%");
  out.setColumnWidth(1, 240); out.setColumnWidth(2, 300);
}

/* Works both when the script is opened from a Sheet (Расширения → Apps Script)
   and when it was created on script.google.com: then setup() creates the Sheet itself. */
function book() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty("SSID");
  if (id) return SpreadsheetApp.openById(id);
  let ss = SpreadsheetApp.getActive();
  if (!ss) ss = SpreadsheetApp.create("ISD Dental School — հարցում");
  props.setProperty("SSID", ss.getId());
  return ss;
}

function clip(v) { return String(v == null ? "" : v).slice(0, 500); }
function digits(v) { return String(v == null ? "" : v).replace(/\D/g, "").replace(/^(374|0)/, ""); }
function num(v) { const x = Number(v); return isFinite(x) ? x : ""; }
