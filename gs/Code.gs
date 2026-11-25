/**
 * ISD Dental School — сбор анонимной анкеты и счётчиков из приложений «Պորտֆոլիո» и «Ֆոտոարձանագրություն».
 *
 * Установка (5 минут):
 *  1. Создайте пустую Google Таблицу → Расширения → Apps Script → вставьте этот файл целиком → Сохранить.
 *  2. Выберите функцию setup → Выполнить → разрешите доступ (один раз).
 *  3. Развернуть → Новое развертывание → тип «Веб-приложение»; Выполнять как: «Я»; Доступ: «Все» → Развернуть.
 *  4. Скопируйте URL веб-приложения (…/exec) и вставьте в assets/js/config.js → endpoint.
 *
 * Что приходит: ответы на 12 вопросов и счётчики (кол-во кейсов, серий фото, направления).
 * Чего здесь нет и не может быть: имён врачей, контактов, данных пациентов, фотографий.
 */

const SH_SURVEY = "Հարցում";
const SH_STATS = "Օգտագործում";
const SH_SUMMARY = "Ամփոփում";

// Keep in sync with assets/js/survey.js
const Q = [
  ["role", "Մասնագիտացում", ["Ուսանող", "Օրդինատոր", "Ընդհանուր (ընտանեկան) ստոմատոլոգ", "Թերապևտ", "Օրթոպեդ", "Վիրաբույժ, իմպլանտոլոգ", "Պարոդոնտոլոգ", "Օրթոդոնտ", "Մանկական ստոմատոլոգ", "Այլ"]],
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
  const def = ss.getSheetByName("Sheet1") || ss.getSheetByName("Лист1") || ss.getSheetByName("Թերթ1");
  if (def && ss.getSheets().length > 3) ss.deleteSheet(def);
  refreshSummary();
  Logger.log("Таблица: " + ss.getUrl());
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(15000);
  try {
    const d = JSON.parse(e.postData.contents);
    const ss = book();
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
  const out = ss.getSheetByName(SH_SUMMARY) || ss.insertSheet(SH_SUMMARY, 0);
  const src = "'" + SH_SURVEY + "'!";
  const col = i => { let n = i, s = ""; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
  const lit = t => '"' + String(t).replace(/"/g, '""') + '"';
  const rows = [
    ["Հայ ստոմատոլոգները թվերով", "", "", ""],
    ["Պատասխանողներ", "=COUNTA(" + src + "A2:A)", "", ""],
    ["", "", "", ""],
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
  out.clear();
  const isF = v => typeof v === "string" && v.charAt(0) === "=";
  out.getRange(1, 1, rows.length, 4).setValues(rows.map(r => r.map(v => isF(v) ? "" : v)));
  // Formula argument separator depends on the Sheet's language: "," (English) or ";" (Russian, Armenian…).
  // Write with ",", check the result, and switch to ";" if the Sheet could not read it.
  const put = sep => {
    const fx = f => sep === "," ? f : f.replace(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/g, ";");
    out.getRange(2, 2).setFormula(rows[1][1]);
    out.getRange(5, 3, rows.length - 4, 2).setFormulas(rows.slice(4).map(r => [fx(r[2]), fx(r[3])]));
    SpreadsheetApp.flush();
    return !/^#/.test(String(out.getRange(5, 3).getDisplayValue())) && !/^#/.test(String(out.getRange(5, 4).getDisplayValue()));
  };
  if (!put(",")) put(";");
  out.getRange(1, 1).setFontSize(18).setFontWeight("bold");
  out.getRange(2, 1, 1, 2).setFontWeight("bold");
  out.getRange(4, 1, 1, 4).setFontWeight("bold");
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
function num(v) { const x = Number(v); return isFinite(x) ? x : ""; }
