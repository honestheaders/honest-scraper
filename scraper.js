import { toTSV, toCSV, toJSON, uniqueNames, fileName } from "./lib/format.js";

const $ = (id) => document.getElementById(id);
const t = (key, subs) => chrome.i18n.getMessage(key, subs) || key;
const tabId = Number(new URLSearchParams(location.search).get("tab"));
const PREVIEW = 300;

let result = null; // { names, rows, total }
let pageTitle = "";

for (const el of document.querySelectorAll("[data-i18n]")) el.textContent = t(el.dataset.i18n);
for (const el of document.querySelectorAll("[data-i18n-placeholder]")) el.placeholder = t(el.dataset.i18nPlaceholder);
document.documentElement.lang = chrome.i18n.getUILanguage();

function banner(msg) { $("banner").textContent = msg; $("banner").hidden = !msg; }
let toastTimer;
function toast(msg) {
  $("toast").textContent = msg; $("toast").hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { $("toast").hidden = true; }, 2200);
}

// Runs window.__honestScraper[name](...args) in the page.
async function call(name, ...args) {
  await chrome.scripting.executeScript({ target: { tabId, frameIds: [0] }, files: ["inject/page.js"] });
  const [r] = await chrome.scripting.executeScript({
    target: { tabId, frameIds: [0] },
    func: (n, a) => window.__honestScraper[n](...a),
    args: [name, args]
  });
  return r?.result;
}

function explain(e) {
  const m = String(e?.message || e);
  if (/Cannot access|cannot be scripted|chrome:\/\/|webstore|extensions gallery/i.test(m)) return t("errRestricted");
  if (/No tab with id/i.test(m)) return t("errTabGone");
  if (/permission|activeTab|host/i.test(m)) return t("errNoAccess");
  return m;
}
async function safe(fn) {
  try { banner(""); return await fn(); } catch (e) { banner(explain(e)); return undefined; }
}

// ---- columns ----
function addColumn(c = { name: "", xpath: "." }) {
  const row = document.createElement("div");
  row.className = "col";
  const name = Object.assign(document.createElement("input"), { value: c.name, placeholder: t("colName"), spellcheck: false });
  name.className = "name";
  const xp = Object.assign(document.createElement("input"), { value: c.xpath, placeholder: t("colXPath"), spellcheck: false });
  xp.className = "xp";
  const del = Object.assign(document.createElement("button"), { textContent: "×", title: t("removeColumn") });
  del.className = "icon";
  del.addEventListener("click", () => { row.remove(); if (!$("columns").children.length) addColumn(); });
  row.append(name, xp, del);
  $("columns").append(row);
}
function columns() {
  return [...$("columns").children].map((r) => ({ name: r.querySelector(".name").value.trim(), xpath: r.querySelector(".xp").value.trim() || "." }));
}
function setColumns(list) {
  $("columns").replaceChildren();
  (list?.length ? list : [{ name: "Text", xpath: "." }]).forEach(addColumn);
}

// ---- rows XPath with live count + highlight ----
let countTimer;
async function updateCount() {
  const xp = $("rows").value.trim();
  const r = await safe(() => call("highlight", xp));
  const c = $("count");
  $("rowsErr").hidden = true;
  if (!r) { c.textContent = ""; return; }
  if (r.error) { $("rowsErr").textContent = t("errXPath", [r.error]); $("rowsErr").hidden = false; c.textContent = ""; return; }
  c.textContent = t("matches", [String(r.count)]);
  c.classList.toggle("zero", r.count === 0);
}
$("rows").addEventListener("input", () => { clearTimeout(countTimer); countTimer = setTimeout(updateCount, 250); });

function applyFound(f) {
  if (!f) return;
  $("pickedXp").textContent = f.xpath;
  $("pickedBox").hidden = false;
  $("rows").value = f.rows;
  setColumns(f.columns);
  updateCount().then(runScrape);
}

// ---- picking ----
async function startPick() {
  const r = await safe(() => call("startPicker"));
  if (r?.ok) {
    $("pickHint").textContent = t("pickActive");
    chrome.tabs.update(tabId, { active: true }).catch(() => {});
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (tab) chrome.windows.update(tab.windowId, { focused: true }).catch(() => {});
  }
}
$("pick").addEventListener("click", startPick);

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type === "start" && msg.tabId === tabId) handleStart(msg.start);
  if (sender.tab?.id !== tabId) return;
  if (msg.type === "picked") {
    $("pickHint").textContent = t("pickHint");
    applyFound(msg);
    chrome.windows.getCurrent().then((w) => chrome.windows.update(w.id, { focused: true })).catch(() => {});
  }
  if (msg.type === "pickCancelled") $("pickHint").textContent = t("pickHint");
});

$("copyPicked").addEventListener("click", async () => {
  await navigator.clipboard.writeText($("pickedXp").textContent);
  toast(t("copied"));
});

// ---- scrape + table ----
function render() {
  const table = $("table");
  table.replaceChildren();
  $("empty").hidden = !!result?.rows.length;
  if (!result) { $("resultInfo").textContent = ""; return; }
  const head = table.createTHead().insertRow();
  head.append(Object.assign(document.createElement("th"), { textContent: "#", className: "n" }));
  for (const n of result.names) head.append(Object.assign(document.createElement("th"), { textContent: n }));
  const body = table.createTBody();
  result.rows.slice(0, PREVIEW).forEach((r, i) => {
    const tr = body.insertRow();
    tr.append(Object.assign(document.createElement("td"), { textContent: String(i + 1), className: "n" }));
    for (const v of r) tr.append(Object.assign(document.createElement("td"), { textContent: v, title: v }));
  });
  $("resultInfo").textContent = result.total > result.rows.length
    ? t("rowsCapped", [String(result.rows.length), String(result.total)])
    : result.rows.length > PREVIEW ? t("rowsPreview", [String(PREVIEW), String(result.rows.length)])
    : t("rowsCount", [String(result.rows.length)]);
}

async function runScrape() {
  const rows = $("rows").value.trim();
  if (!rows) { banner(t("errNoRows")); return; }
  const cols = columns();
  const r = await safe(() => call("scrape", rows, cols));
  if (!r) return;
  if (r.error) { $("rowsErr").textContent = t("errXPath", [r.error]); $("rowsErr").hidden = false; return; }
  [...$("columns").children].forEach((el, i) => el.classList.toggle("bad", r.badColumns.includes(i)));
  if (r.badColumns.length) banner(t("errColumns"));
  result = { names: uniqueNames(cols.map((c) => c.name)), rows: r.rows, total: r.total };
  render();
}
$("scrape").addEventListener("click", runScrape);
$("addCol").addEventListener("click", () => addColumn({ name: "", xpath: "." }));

// ---- export ----
$("exportSel").addEventListener("change", async (e) => {
  const kind = e.target.value;
  e.target.value = "";
  if (!kind) return;
  if (!result?.rows.length) { banner(t("errNothing")); return; }
  const { names, rows } = result;
  if (kind === "csvFile") {
    const blob = new Blob(["﻿" + toCSV(names, rows)], { type: "text/csv" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: fileName(pageTitle, "csv") });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    return;
  }
  const text = kind === "tsv" ? toTSV(names, rows) : kind === "csv" ? toCSV(names, rows) : toJSON(names, rows);
  await navigator.clipboard.writeText(text);
  toast(kind === "tsv" ? t("copiedTsv") : t("copied"));
});

// ---- start ----
async function handleStart(start) {
  if (start?.found) applyFound(start.found);
  else if (start?.pick) startPick();
}

addEventListener("pagehide", () => { call("clear").catch(() => {}); });

(async () => {
  setColumns();
  render();
  if (!Number.isInteger(tabId)) { banner(t("errTabGone")); return; }
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (!tab) { banner(t("errTabGone")); return; }
  const info = await safe(() => call("info"));
  if (!info) { $("pick").disabled = true; return; }
  pageTitle = info.title;
  try { $("site").textContent = new URL(info.url).host; } catch { $("site").textContent = info.url; }
  const key = `start:${tabId}`;
  const stored = (await chrome.storage.session.get(key))[key];
  await chrome.storage.session.remove(key);
  handleStart(stored);
})();
