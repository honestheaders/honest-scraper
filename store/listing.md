# Chrome Web Store listing – Honest Scraper 1.0.0

## Name
Honest Scraper – Scrape similar & XPath

## Summary (from manifest, 127 chars)
Pick an element, get every similar one as a table. Test XPath, copy to Sheets or CSV. No site access, no tracking, open source.

## Description
Pick one item on a page and get every similar item as a table. Then copy it straight into Google Sheets or Excel, or save a CSV file.

How it works
• Click the Honest Scraper icon, then click an item on the page (a product, a search result, a table row). Or right-click it and choose "Scrape similar".
• Similar items become rows. Useful columns are suggested for you: the text, the link, the image. For tables, each cell becomes a column with the header name.
• Everything is XPath, so you can adjust it: the rows box shows a live match count and highlights the matches on the page. It works as an XPath tester too.
• Columns are XPath relative to each row, for example ./a/@href (link), .//img/@src (image), ./td[2] (second cell) or normalize-space(.//h3).

Export
• Copy for Google Sheets / Excel (tab-separated, paste directly)
• Copy as CSV or JSON
• Save a CSV file (UTF-8, opens correctly in Excel)
• Cells that would run as spreadsheet formulas are made safe with a leading apostrophe.

Private by design
• No host permissions. Honest Scraper reads only the tab where you click its icon or menu (Chrome's activeTab), and only until that tab navigates.
• No data collection, no analytics, no ads, no remote code. It makes no network requests of its own.
• Open source (MIT): https://github.com/honestheaders/honest-scraper

If you used Scraper or XPath Helper before they were removed from the Chrome Web Store, Honest Scraper covers the same everyday tasks with today's Manifest V3.

Limits: reads the top page only (not iframes). Chrome pages and the Chrome Web Store cannot be read by any extension.

English and Japanese.

## Category
Developer Tools

## Language
English

## Single purpose
Turn similar elements on the current page into a table, using XPath, when the user asks.

## Permission justifications
- activeTab: to read the tab where the user clicked the toolbar button or the context menu, only at that time
- scripting: to run the element picker and the table reader in that tab when the user asks
- contextMenus: to add the "Scrape similar" item to the right-click menu
- storage: session storage only, to pass the right-clicked element from the menu to the extension window

## Remote code
No

## Data usage
No user data is collected. All three certifications checked.

## Privacy policy URL
https://github.com/honestheaders/honest-scraper/blob/main/PRIVACY.md
