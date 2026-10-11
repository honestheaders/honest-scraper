// Injected into the page (isolated world) only when the user asks.
// Defines window.__honestScraper once; later calls reuse it.
(() => {
  if (window.__honestScraper) return;

  const MARK = "data-honest-scraper";
  const quote = (s) => (s.includes("'") ? (s.includes('"') ? `concat('${s.split("'").join("', \"'\", '")}')` : `"${s}"`) : `'${s}'`);
  const tagOf = (el) => (el.namespaceURI === "http://www.w3.org/1999/xhtml" ? el.localName : `*[local-name()=${quote(el.localName)}]`);
  const uniqueId = (el) => el.id && /^[A-Za-z][\w:.-]*$/.test(el.id) && document.querySelectorAll(`[id="${CSS.escape(el.id)}"]`).length === 1;

  // Path steps from an anchor (an element with a unique id, or the root) down to el.
  function steps(el) {
    const out = [];
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      if (n !== el && uniqueId(n)) return { anchor: `//*[@id=${quote(n.id)}]`, steps: out.reverse() };
      const same = n.parentElement ? [...n.parentElement.children].filter((c) => c.localName === n.localName) : [n];
      out.push({ el: n, tag: tagOf(n), index: same.indexOf(n) + 1, count: same.length });
    }
    return { anchor: "", steps: out.reverse() };
  }
  const join = (anchor, list) => anchor + list.map((s) => `/${s.tag}${s.count > 1 && s.index ? `[${s.index}]` : ""}`).join("");

  function xpathOf(el) {
    if (uniqueId(el)) return `//*[@id=${quote(el.id)}]`;
    const p = steps(el);
    return join(p.anchor, p.steps);
  }

  function evalNodes(xpath, ctx = document) {
    const r = document.evaluate(xpath, ctx, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
    const out = [];
    for (let i = 0; i < r.snapshotLength; i++) out.push(r.snapshotItem(i));
    return out;
  }

  const clean = (s) => String(s ?? "").replace(/ /g, " ").replace(/[ \t\r\f\v]+/g, " ").replace(/ *\n[\s]*/g, "\n").trim();
  function valueOf(node) {
    if (node.nodeType === 2) {
      const v = node.value;
      if (/^(href|src|action|data|poster|cite)$/i.test(node.name)) {
        try { return new URL(v, document.baseURI).href; } catch { return v; }
      }
      return v;
    }
    if (node.nodeType === 1) return clean(node.innerText ?? node.textContent);
    return clean(node.textContent);
  }
  function column(row, xpath) {
    const r = document.evaluate(xpath, row, null, XPathResult.ANY_TYPE, null);
    switch (r.resultType) {
      case XPathResult.STRING_TYPE: return clean(r.stringValue);
      case XPathResult.NUMBER_TYPE: return String(r.numberValue);
      case XPathResult.BOOLEAN_TYPE: return String(r.booleanValue);
      default: {
        const n = r.iterateNext();
        return n ? valueOf(n) : "";
      }
    }
  }

  // From one picked element, guess "the list it belongs to": rows XPath + columns.
  function similar(el) {
    const tr = el.closest("tr");
    const p = steps(tr || el);
    let cut = -1;
    if (tr) cut = p.steps.length - 1;
    else for (let i = p.steps.length - 1; i >= 0; i--) if (p.steps[i].count > 1) { cut = i; break; }
    if (cut < 0) cut = p.steps.length - 1;
    const rowSteps = p.steps.slice(0, cut + 1).map((s, i) => (i === cut ? { ...s, index: 0 } : s));
    const rowsXPath = join(p.anchor, rowSteps);
    const rowEl = p.steps[cut].el;
    const columns = [];
    if (tr) {
      const cells = [...tr.children].filter((c) => /^(td|th)$/.test(c.localName));
      const table = tr.closest("table");
      const head = table && (table.querySelector("thead tr") || (table.querySelector("tr:first-child th") && table.querySelector("tr")));
      const names = head ? [...head.children].map((c) => clean(c.textContent)) : [];
      cells.forEach((c, i) => columns.push({ name: names[i] || `Column ${i + 1}`, xpath: `./*[${i + 1}]` }));
      // Skip the header row itself when the rows also match it.
      if (head && head.parentElement === tr.parentElement && head !== tr) {
        return { rows: `${rowsXPath}[td]`, columns };
      }
    } else {
      const rel = [];
      for (let n = el; n && n !== rowEl; n = n.parentElement) {
        const same = [...n.parentElement.children].filter((c) => c.localName === n.localName);
        rel.unshift(`${tagOf(n)}${same.length > 1 ? `[${same.indexOf(n) + 1}]` : ""}`);
      }
      columns.push({ name: "Text", xpath: rel.length ? `./${rel.join("/")}` : "." });
      const link = el.closest("a[href]") || (rowEl.matches("a[href]") ? rowEl : rowEl.querySelector("a[href]"));
      if (link && rowEl.contains(link)) columns.push({ name: "Link", xpath: link === rowEl ? "@href" : ".//a/@href" });
      else if (link && link.contains(rowEl)) columns.push({ name: "Link", xpath: "ancestor::a[1]/@href" });
      const img = el.closest("img") || rowEl.querySelector("img[src]");
      if (img && !columns.some((c) => c.name === "Link" && img.closest("a"))) columns.push({ name: "Image", xpath: img === rowEl ? "@src" : ".//img/@src" });
    }
    return { rows: rowsXPath, columns };
  }

  // ---- highlight ----
  const STYLE_ID = "honest-scraper-style";
  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent = `[${MARK}~="hit"]{outline:2px solid #e8590c!important;outline-offset:1px!important;background-color:rgba(232,89,12,.08)!important}
[${MARK}~="hover"]{outline:2px dashed #1971c2!important;outline-offset:1px!important;cursor:crosshair!important}`;
    (document.head || document.documentElement).appendChild(s);
  }
  function addMark(el, m) { el.setAttribute(MARK, ((el.getAttribute(MARK) || "") + " " + m).trim()); }
  function dropMark(m) {
    document.querySelectorAll(`[${MARK}~="${m}"]`).forEach((el) => {
      const v = (el.getAttribute(MARK) || "").split(" ").filter((x) => x && x !== m).join(" ");
      if (v) el.setAttribute(MARK, v); else el.removeAttribute(MARK);
    });
  }
  function highlight(xpath) {
    dropMark("hit");
    if (!xpath) return { count: 0 };
    let nodes;
    try { nodes = evalNodes(xpath); } catch (e) { return { error: e.message }; }
    ensureStyle();
    const els = nodes.map((n) => (n.nodeType === 1 ? n : n.ownerElement || n.parentElement)).filter(Boolean);
    els.slice(0, 2000).forEach((el) => addMark(el, "hit"));
    return { count: nodes.length };
  }

  function scrape(rows, columns, limit = 5000) {
    let nodes;
    try { nodes = evalNodes(rows); } catch (e) { return { error: e.message }; }
    const out = [];
    const bad = new Set();
    for (const n of nodes.slice(0, limit)) {
      out.push(columns.map((c, i) => {
        try { return column(n, c.xpath || "."); } catch { bad.add(i); return ""; }
      }));
    }
    return { rows: out, total: nodes.length, badColumns: [...bad] };
  }

  // ---- element picker ----
  let picking = null;
  function stopPicker() {
    if (!picking) return;
    document.removeEventListener("mouseover", picking.over, true);
    document.removeEventListener("click", picking.click, true);
    document.removeEventListener("keydown", picking.key, true);
    dropMark("hover");
    picking = null;
  }
  function startPicker() {
    stopPicker();
    ensureStyle();
    const over = (e) => { dropMark("hover"); if (e.target.nodeType === 1) addMark(e.target, "hover"); };
    const click = (e) => {
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      const el = e.target;
      stopPicker();
      chrome.runtime.sendMessage({ type: "picked", xpath: xpathOf(el), ...similar(el) });
    };
    const key = (e) => { if (e.key === "Escape") { stopPicker(); chrome.runtime.sendMessage({ type: "pickCancelled" }); } };
    picking = { over, click, key };
    document.addEventListener("mouseover", over, true);
    document.addEventListener("click", click, true);
    document.addEventListener("keydown", key, true);
    return { ok: true };
  }

  // Guess the right-clicked element from what the context menu tells us.
  function fromContext(info) {
    let el = null;
    const sel = getSelection();
    if (info.selectionText && sel && sel.rangeCount) {
      const n = sel.getRangeAt(0).startContainer;
      el = n.nodeType === 1 ? n : n.parentElement;
    }
    if (!el && info.srcUrl) el = [...document.images].find((i) => i.currentSrc === info.srcUrl || i.src === info.srcUrl) || null;
    if (!el && info.linkUrl) el = [...document.links].find((a) => a.href === info.linkUrl) || null;
    if (!el) return null;
    return { xpath: xpathOf(el), ...similar(el) };
  }

  window.__honestScraper = {
    xpathOf, similar, highlight, scrape, startPicker, stopPicker, fromContext,
    clear() { stopPicker(); dropMark("hit"); dropMark("hover"); document.getElementById(STYLE_ID)?.remove(); },
    info: () => ({ title: document.title, url: location.href })
  };
})();
