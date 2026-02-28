import { sendMessageSafe, settings } from './utils.js';

// ========================================
// Icon Handlings
// ========================================
const updateToolbarIcon = async (tabId = null) => {
  const newIconState = await settings.get('isCleanURLed');
  const iconPath = newIconState ? './images/toolbar-icon-on.svg' : './images/toolbar-icon.svg';

  if (tabId === null) {
    const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
    tabId = activeTab?.id;
  }

  browser.action.setIcon({ path: iconPath, tabId: tabId });
};

// ========================================
// Event Listeners
// ========================================
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    updateToolbarIcon(tab.id);
  }
});

browser.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === browser.windows.WINDOW_ID_NONE) return;

  const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!activeTab?.id) return;

  sendMessageSafe(activeTab.id, { type: 'CONFIG_UPDATED', config: settings.get() });

  updateToolbarIcon(activeTab.id);
});

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_CURRENT_CONFIG') {
    sendResponse({ config: settings.get() });
    return true;
  }
  
  if (message.action === 'UPDATE_ICON') {
    updateToolbarIcon(sender.tab?.id);
    return;
  }
});

// ========================================
// Initialization
// ========================================
(async () => {
  try {
    await settings.load();
    updateToolbarIcon();
  } catch (error) {
    console.error('[CleanURLExtension] Failed to initialize:', error);
  }
})();
