/* Messaging */
const sendMessageSafe = async (tabId, message) => {
  try {
    await browser.tabs.sendMessage(tabId, message);
  } catch (error) {
    // Ignore errors if the content script is not yet loaded or the tab is not accessible.
    console.warn('[CleanURLExtension] Failed to send message to content.js:', error);
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

// Icon Handlings
const activeTabs = new Set();

const getAllTabIds = async () => {
  try {
    const tabs = await browser.tabs.query({});
    tabs.forEach(tab => activeTabs.add(tab.id));
  } catch (error) {
    console.error('[CleanURLExtension] Failed to initialize tabs:', error);
  }
};

const setIconForAllTabs = async (iconPath) => {
  if (activeTabs.size === 0) {
    await getAllTabIds();
  }
  
  const promises = Array.from(activeTabs).map(async (tabId) => {
    try {
      await browser.action.setIcon({
        path: iconPath,
        tabId: tabId
      });
    } catch (error) {
      console.warn(`[CleanURLExtension] Failed to set icon for tab ${tabId}:`, error);
      activeTabs.delete(tabId);
    }
  });
  
  await Promise.all(promises);
};

const updateToolbarIcon = async (tabId = null, iconState) => {
  const newIconState = iconState ?? await settings.get('isCleanURLed');
  const iconPath = newIconState ? './images/toolbar-icon-on.svg' : './images/toolbar-icon.svg';

  if (tabId === null) {
    setIconForAllTabs(iconPath);
  } else {
    browser.action.setIcon({ path: iconPath, tabId: tabId });
  }

  browser.action.setIcon({ path: iconPath, tabId: tabId });
};

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  activeTabs.add(tab.id);

  if (changeInfo.status === 'complete') {
    updateToolbarIcon(tab.id, settings.get('isCleanURLed'));
  }
});

browser.tabs.onCreated.addListener((tab) => {
  // Prevent duplicate event handling for setIcon
  if (tab.index === 0) return; // for itself
  if (Number.isNaN(tab.index)) return; // for iOS/iPadOS

  updateToolbarIcon(tab.id, settings.get('isCleanURLed'));
});

browser.tabs.onRemoved.addListener((tabId) => {
  activeTabs.delete(tabId);
});

// Get Message Listeners
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_CURRENT_CONFIG') {
    sendResponse({ config: settings.get() });
    return true;
  }
});

browser.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === browser.windows.WINDOW_ID_NONE) return;

  const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
  sendMessageSafe(activeTab.id, { type: 'CONFIG_UPDATED', config: settings.get() });

  updateToolbarIcon(activeTab.id, settings.get('isCleanURLed'));
});

browser.action.onClicked.addListener(async (tab) => {
  const newState = !settings.get('isCleanURLed');
  await settings.set('isCleanURLed', newState);

  updateToolbarIcon(tab.id, settings.get('isCleanURLed'));
});

/* Init */
await settings.load();

