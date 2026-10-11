// Usage: node test/e2e.mjs <unpacked copy with host_permissions <all_urls>>
import { chromium } from "playwright";
import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import assert from "node:assert/strict";

const dir = process.argv[2];
const extId = [...crypto.createHash("sha256").update(path.resolve(dir)).digest("hex").slice(0, 32)]
  .map((h) => String.fromCharCode(97 + parseInt(h, 16))).join("");
const shots = process.env.SHOTS || os.tmpdir();

const PAGE = `<!doctype html><html><head><title>Test shop</title></head><body>
<h1>Products</h1>
<ul class="products">
  <li><a href="/p/1"><h3>Blue mug</h3></a><span class="price">$12</span><img src="/img/1.png" alt=""></li>
  <li><a href="/p/2"><h3>Red mug</h3></a><span class="price">$14</span><img src="/img/2.png" alt=""></li>
  <li><a href="/p/3"><h3>=cmd|calc</h3></a><span class="price">-</span><img src="/img/3.png" alt=""></li>
</ul>
<table id="t"><thead><tr><th>Name</th><th>Qty</th></tr></thead>
<tbody><tr><td>Apple</td><td>3</td></tr><tr><td>Pear</td><td>5</td></tr></tbody></table>
</body></html>`;
const server = http.createServer((req, res) => { res.setHeader("Content-Type", "text/html"); res.end(PAGE); });
await new Promise((r) => server.listen(8766, "127.0.0.1", r));

const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), "hs-")), {
  headless: true,
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: [`--disable-extensions-except=${dir}`, `--load-extension=${dir}`, "--headless=new"],
  viewport: { width: 760, height: 640 }
});
try {
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"]);
  const site = await ctx.newPage();
  await site.goto("http://127.0.0.1:8766/");
  const ui = await ctx.newPage();
  await ui.goto(`chrome-extension://${extId}/scraper.html`);
  const tabId = await ui.evaluate(async () => (await chrome.tabs.query({ url: "http://127.0.0.1:8766/*" }))[0].id);
  await ui.goto(`chrome-extension://${extId}/scraper.html?tab=${tabId}`);
  await ui.waitForFunction(() => document.getElementById("site").textContent.includes("127.0.0.1"));

  // 1) Pick a product title -> rows are the list items.
  await ui.click("#pick");
  await site.bringToFront();
  await site.waitForFunction(() => !!window.document);
  await site.click("text=Red mug");
  await ui.waitForSelector("#pickedBox:not([hidden])");
  assert.equal(await ui.inputValue("#rows"), "/html/body/ul/li");
  assert.match(await ui.textContent("#pickedXp"), /\/html\/body\/ul\/li\[2\]\/a\/h3/);
  await ui.waitForFunction(() => document.querySelectorAll("#table tbody tr").length === 3);
  const cols = await ui.$$eval(".col", (els) => els.map((e) => [e.querySelector(".name").value, e.querySelector(".xp").value]));
  assert.deepEqual(cols, [["Text", "./a/h3"], ["Link", ".//a/@href"], ["Image", ".//img/@src"]]);
  const first = await ui.$$eval("#table tbody tr:first-child td", (tds) => tds.map((td) => td.textContent));
  assert.deepEqual(first, ["1", "Blue mug", "http://127.0.0.1:8766/p/1", "http://127.0.0.1:8766/img/1.png"]);
  assert.match(await ui.textContent("#count"), /3/);
  // highlighted on the page
  assert.equal(await site.locator('[data-honest-scraper~="hit"]').count(), 3);
  // the click did not navigate
  assert.equal(site.url(), "http://127.0.0.1:8766/");
  await ui.screenshot({ path: path.join(shots, "list.png") });
  console.log("ok: pick list");

  // 2) Copy for Sheets (TSV) with formula guard.
  await ui.bringToFront();
  await ui.selectOption("#exportSel", "tsv");
  await ui.waitForSelector("#toast:not([hidden])");
  const tsv = await ui.evaluate(() => navigator.clipboard.readText());
  assert.equal(tsv.split("\n")[0], "Text\tLink\tImage");
  assert.match(tsv, /'=cmd\|calc/);
  console.log("ok: tsv");

  // 3) Table row -> rows of tbody, columns from header.
  await ui.click("#pick");
  await site.bringToFront();
  await site.click("text=Pear");
  await ui.waitForFunction(() => document.querySelectorAll("#table tbody tr").length === 2);
  assert.equal(await ui.inputValue("#rows"), '//*[@id=\'t\']/tbody/tr');
  const tcols = await ui.$$eval(".col .name", (els) => els.map((e) => e.value));
  assert.deepEqual(tcols, ["Name", "Qty"]);
  const r2 = await ui.$$eval("#table tbody tr:last-child td", (tds) => tds.map((td) => td.textContent));
  assert.deepEqual(r2, ["2", "Pear", "5"]);
  console.log("ok: pick table");

  // 4) Typed XPath (XPath Helper use): live count and error.
  await ui.fill("#rows", "//h3");
  await ui.waitForFunction(() => /3/.test(document.getElementById("count").textContent));
  await ui.fill("#rows", "//h3[");
  await ui.waitForSelector("#rowsErr:not([hidden])");
  console.log("ok: xpath box");

  // 5) Esc cancels picking without scraping.
  await ui.fill("#rows", "//li");
  await ui.click("#pick");
  await site.bringToFront();
  await site.keyboard.press("Escape");
  await ui.waitForFunction(() => !/Esc/.test(document.getElementById("pickHint").textContent));
  await site.click("text=Blue mug");
  await site.waitForURL("**/p/1");
  console.log("ok: esc");

  // 6) Restricted page shows a clear message.
  const restricted = await ctx.newPage();
  await restricted.goto("chrome://version");
  const ui2 = await ctx.newPage();
  await ui2.goto(`chrome-extension://${extId}/scraper.html`);
  const rid = await ui2.evaluate(async () => (await chrome.tabs.query({ url: "chrome://version/*" }))[0]?.id);
  await ui2.goto(`chrome-extension://${extId}/scraper.html?tab=${rid}`);
  await ui2.waitForSelector("#banner:not([hidden])");
  console.log("ok: restricted:", await ui2.textContent("#banner"));
} finally {
  await ctx.close();
  server.close();
}
