# Honest Scraper

Pick one element on a page and get every similar one as a table. Test XPath expressions with a live match count.
An open-source, Manifest V3 replacement for **Scraper** and **XPath Helper**, which disappeared from the Chrome Web Store when Manifest V2 extensions were removed (August 2026).

- **Pick an element** (or right-click → *Scrape similar*): similar items become rows, and useful columns are suggested (text, link, image; table cells with their header names)
- **Rows XPath box** with a live match count and on-page highlight, so it also works as an XPath tester
- **Columns** are XPath relative to each row: `.`, `./a/@href`, `.//img/@src`, `./td[2]`, `normalize-space(.//h3)`
- **Copy for Google Sheets / Excel** (tab-separated), copy as CSV or JSON, or save a CSV file (UTF-8, opens in Excel)
- Cells that would run as spreadsheet formulas (`=`, `+`, `@`, …) are prefixed with `'`
- English and Japanese

## No site access until you click

Honest Scraper has **no host permissions**. It uses `activeTab`: Chrome lets it read only the tab where you clicked the icon or the menu,
and only until that tab navigates. Nothing runs on pages in the background.

- **No data collection, no analytics, no ads, no remote code.** The extension makes no network requests of its own.

## Files

| File | What it does |
|---|---|
| `background.js` | Toolbar button and right-click menu; opens the scraper window |
| `inject/page.js` | Runs in the page only when asked: element picker, XPath building, highlighting, reading rows |
| `scraper.*` | The scraper window |
| `lib/format.js` | TSV / CSV / JSON output (no Chrome APIs; tested in `test/format.test.mjs`) |

## Permissions

- `activeTab` – read the tab you clicked on, only then
- `scripting` – run the picker and the reader in that tab
- `contextMenus` – the *Scrape similar* right-click item
- `storage` – hand the right-clicked element to the window (session storage, cleared when the browser closes)

## Limits

Reads the top page only (not iframes). Chrome pages and the Chrome Web Store cannot be read by any extension.

## Privacy

See [PRIVACY.md](PRIVACY.md).

## Tests

```
node test/format.test.mjs
node test/e2e.mjs <unpacked copy with host_permissions <all_urls> and "tabs">   # needs Playwright
```

## License

MIT
