// Turning scraped rows into text. No Chrome APIs; tested in test/format.test.mjs.

// A cell starting with = + @ (or - that is not a number) would run as a formula
// in spreadsheet apps, so it gets a leading apostrophe.
export const noFormula = (v) => {
  const s = String(v ?? "");
  return /^[=+@\t\r]/.test(s) || (/^-/.test(s) && !/^-[\d.,\s]+$/.test(s)) ? `'${s}` : s;
};
const tsvCell = (v) => {
  const s = noFormula(v);
  return /[\t\n\r"]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csvCell = (v) => {
  const s = noFormula(v);
  return /[",\n\r]/.test(s) || s.startsWith("'") ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toTSV(names, rows) {
  return [names, ...rows].map((r) => r.map(tsvCell).join("\t")).join("\n");
}

export function toCSV(names, rows) {
  return [names, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

export function toJSON(names, rows) {
  const keys = uniqueNames(names);
  return JSON.stringify(rows.map((r) => Object.fromEntries(keys.map((k, i) => [k, r[i] ?? ""]))), null, 2);
}

export function uniqueNames(names) {
  const seen = new Map();
  return names.map((n, i) => {
    const base = String(n || "").trim() || `Column ${i + 1}`;
    const c = seen.get(base) || 0;
    seen.set(base, c + 1);
    return c ? `${base} (${c + 1})` : base;
  });
}

export function fileName(title, ext) {
  const base = String(title || "scrape").replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 60) || "scrape";
  return `${base}.${ext}`;
}
