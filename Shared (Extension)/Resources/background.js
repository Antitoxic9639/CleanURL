import { getCleanUrl } from './cleanurl.js';

/* Messaging */
const sendMessageSafe = async (tabId, message) => {
  try {
    await browser.tabs.sendMessage(tabId, message);
  } catch (error) {
    // Ignore errors if the content script is not yet loaded or the tab is not accessible.
    console.warn('[CleanURLExtension] Failed to load content.js:', error);
  }
};

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

  const get = (key) => {
    if (key === undefined) return { ...cache };
    return cache[key];
  };

  const set = async (key, value) => {
    cache[key] = value;
    try {
      await browser.storage.local.set({ settings: cache });
    } catch (error) {
      console.error('[CleanURLExtension] Failed to save settings:', error);
    }
  };

  browser.storage.onChanged.addListener(async (changes, area) => {
    if (area === 'local' && changes.settings) {
      cache = { ...DEFAULT_SETTINGS, ...changes.settings.newValue };

      const tabs = await browser.tabs.query({ active: true });

      for (const tab of tabs) {
        sendMessageSafe(tab.id, { type: 'CONFIG_UPDATED', config: cache });
      }
    }
  });

  return { load, get, set };
})();

const updateToolbarIcon = async (tabId) => {
  const iconPath = await settings.get('isCleanURLed') ? './images/toolbar-icon-on.svg' : './images/toolbar-icon.svg';
  if (!tabId) {
    const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
    tabId = activeTab.id;
  }
  browser.action.setIcon({ path: iconPath, tabId: tabId });
};

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    updateToolbarIcon(tab.id);
  }
});

browser.tabs.onActivated.addListener(async (activeInfo) => {
  updateToolbarIcon(activeInfo.tabId);
});

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Get current config
  if (message.type === 'GET_CURRENT_CONFIG') {
    sendResponse({ config: settings.get() });
    return true;
  }
});

browser.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === browser.windows.WINDOW_ID_NONE) return;

  const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
  sendMessageSafe(activeTab.id, { type: 'CONFIG_UPDATED', config: settings.get() });
  //  updateTabState(activeTab);
  updateToolbarIcon(activeTab.id);
});

browser.action.onClicked.addListener(async (tab) => {
  const newState = !settings.get('isCleanURLed');
  await settings.set('isCleanURLed', newState);

  updateToolbarIcon(tab.id);
});

/* Init */
await settings.load();

