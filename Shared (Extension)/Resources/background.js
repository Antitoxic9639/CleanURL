import { getCleanUrl } from './cleanurl.js';

const settings = (() => {
  const DEFAULT_SETTINGS = {
    isCleanURLed: false,
  };

  let cache = { ...DEFAULT_SETTINGS };

  const load = async () => {
    try {
      const { settings: stored } = await browser.storage.local.get('settings');
      cache = { ...DEFAULT_SETTINGS, ...stored };
    } catch (error) {
      console.error('[CleanURLExtension] Failed to load settings:', error);
    }
  };

  const get = (key) => cache[key];

  const set = async (key, value) => {
    cache[key] = value;
    try {
      await browser.storage.local.set({ settings: cache });
    } catch (error) {
      console.error('[CleanURLExtension] Failed to save settings:', error);
    }
  };

  return { load, get, set };
})();

/* State  */
const originalUrlMap = new Map();

/* Core logic */
const updateTabState = async (tab) => {
  if (!tab?.id || !tab.url?.startsWith('http')) return;

  const isEnabled = settings.get('isCleanURLed');
  
  const iconPath = isEnabled ? './images/toolbar-icon-on.svg' : './images/toolbar-icon.svg';
  browser.action.setIcon({ path: iconPath, tabId: tab.id });

  if (isEnabled) {
    if (!originalUrlMap.has(tab.id)) originalUrlMap.set(tab.id, tab.url);
    const cleaned = getCleanUrl(tab.url, true);
    if (cleaned && cleaned !== tab.url) {
      sendMessageSafe(tab.id, { action: 'APPLY_CLEAN_URL', cleanedUrl: cleaned });
    }
  } else if (originalUrlMap.has(tab.id)) {
    const original = originalUrlMap.get(tab.id);
    sendMessageSafe(tab.id, { action: 'RESTORE_ORIGINAL_URL', originalUrl: original });
    originalUrlMap.delete(tab.id);
  }
};

/* Messaging */
const sendMessageSafe = async (tabId, message) => {
  try {
    await browser.tabs.sendMessage(tabId, message);
  } catch (error) {
    // Ignore errors if the content script is not yet loaded or the tab is not accessible.
  }
};

/* Event listeners */
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url?.startsWith('http')) {
    updateTabState(tab);
  }
});

browser.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId !== browser.windows.WINDOW_ID_NONE) {
    const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
    updateTabState(activeTab);
  }
});

browser.action.onClicked.addListener(async (tab) => {
  const newState = !settings.get('isCleanURLed');
  await settings.set('isCleanURLed', newState);
  
  const tabs = await browser.tabs.query({ url: '*://*/*' });
  for (const t of tabs) {
    updateTabState(t);
  }
});

browser.tabs.onRemoved.addListener((tabId) => {
  originalUrlMap.delete(tabId)
});

/* Init */
await settings.load();
