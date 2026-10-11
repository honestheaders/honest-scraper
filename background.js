// Opens the scraper window for a tab. No host permissions: everything runs
// through activeTab, which Chrome grants when the user clicks the icon or the menu.

const MENU = "scrape-similar";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU,
    title: chrome.i18n.getMessage("menuScrapeSimilar"),
    contexts: ["page", "selection", "link", "image"]
  });
});

async function openFor(tab, start) {
  const url = chrome.runtime.getURL(`scraper.html?tab=${tab.id}`);
  const existing = (await chrome.runtime.getContexts({ contextTypes: ["TAB"] }))
    .find((c) => c.documentUrl === url);
  if (existing) {
    await chrome.windows.update(existing.windowId, { focused: true });
    if (start) chrome.runtime.sendMessage({ type: "start", tabId: tab.id, start }).catch(() => {});
    return;
  }
  const key = `start:${tab.id}`;
  if (start) await chrome.storage.session.set({ [key]: start });
  await chrome.windows.create({ url, type: "popup", width: 760, height: 640 });
}

async function inject(tabId) {
  await chrome.scripting.executeScript({ target: { tabId, frameIds: [0] }, files: ["inject/page.js"] });
}

chrome.action.onClicked.addListener((tab) => openFor(tab, { pick: true }));

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU || !tab) return;
  let found = null;
  try {
    await inject(tab.id);
    const [r] = await chrome.scripting.executeScript({
      target: { tabId: tab.id, frameIds: [0] },
      func: (i) => window.__honestScraper.fromContext(i),
      args: [{ selectionText: info.selectionText || "", linkUrl: info.linkUrl || "", srcUrl: info.srcUrl || "" }]
    });
    found = r?.result || null;
  } catch {
    // Restricted page: the window shows the reason.
  }
  openFor(tab, found ? { found } : { pick: true });
});
