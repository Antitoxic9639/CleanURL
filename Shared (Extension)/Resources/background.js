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

await settings.load();
let isCleanURLed = settings.get('isCleanURLed');

const originalUrlMap = new Map();

const applyCleanUrl = async (tab) => {
  if (!tab || !tab.url?.startsWith('http')) return;

  const tabId = tab.id;
  const currentUrl = tab.url;

  if (isCleanURLed) {
    if (!originalUrlMap.has(tabId)) {
      originalUrlMap.set(tabId, currentUrl);
    }

    const cleaned = getCleanUrl(currentUrl, true);

    if (cleaned && cleaned !== currentUrl) {
      try {
        await browser.tabs.sendMessage(tabId, {
          action: 'APPLY_CLEAN_URL',
          cleanedUrl: cleaned
        });
      } catch (error) {
        console.warn('[CleanURLExtension] Failed to send clean URL to content script:', error);
      }
    }

  } else {
    if (originalUrlMap.has(tabId)) {
      const original = originalUrlMap.get(tabId);

      if (original && original !== currentUrl) {
        try {
          await browser.tabs.sendMessage(tabId, {
            action: 'RESTORE_ORIGINAL_URL',
            originalUrl: original
          });
        } catch (error) {
          console.warn('[CleanURLExtension] Failed to send restore URL to content script:', error);
        }
      }

      originalUrlMap.delete(tabId);
    }
  }
};

const setAppIcon = async (tab) => {
  const tabId = tab?.id;
  const iconPath = isCleanURLed
    ? './images/toolbar-icon-on.svg'
    : './images/toolbar-icon.svg';

  await browser.action.setIcon({ path: iconPath, tabId });
};

const updateAllTabIcons = async () => {
  const tabs = await browser.tabs.query({});
  for (const tab of tabs) {
    if (tab.url?.startsWith('http')) {
      setAppIcon(tab);
    }
  }
};

browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    setAppIcon(tab);
    applyCleanUrl(tab);
  }
});

const processTab = async (tab) => {
  if (!tab || !tab.id || !tab.url?.startsWith('http')) return;
  await setAppIcon(tab);
  await applyCleanUrl(tab);
};

browser.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId !== browser.windows.WINDOW_ID_NONE) {
    const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (activeTab) {
      processTab(activeTab);
    }
  }
});

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'CONTENT_SCRIPT_READY') {
    processTab(sender.tab);
  }
});

browser.action.onClicked.addListener(async (tab) => {
  isCleanURLed = !isCleanURLed;
  await settings.set('isCleanURLed', isCleanURLed);

  updateAllTabIcons();
  processTab(tab);
});

updateAllTabIcons();
