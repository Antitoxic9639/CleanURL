// ========================================
// Messaging: Send to content.js
// ========================================
export const sendMessageSafe = async (tabId, message) => {
  try {
    await browser.tabs.sendMessage(tabId, message);
  } catch (error) {
    // Ignore errors if the content script is not yet loaded or the tab is not accessible.
    console.error(`[CleanURLExtension] Failed to send message to tab ${tabId}:`, error);
  }
};

// ============================================
// Platform Detection
// ============================================
const userAgent = navigator.userAgent;
const platform = navigator.platform;
const maxTouchPoints = navigator.maxTouchPoints || 0;

const isIPadOS = platform === 'MacIntel' && maxTouchPoints > 1;
const isIOS = /iPhone|iPod/.test(userAgent);
const isMacOS = platform.includes('Mac') && !isIPadOS;
export const platformInfo = {
  isIOS,
  isIPadOS,
  isMacOS
};

export const applyPlatformClass = async () => {
  const body = document.body;

  if (platformInfo.isIOS) {
    body.classList.add('os-ios');
  } else if (platformInfo.isIPadOS) {
    body.classList.add('os-ipados');
  } else if (platformInfo.isMacOS) {
    body.classList.add('os-macos');
  }
};

const getIOSMajorVersion = () => {
  const match = userAgent.match(/OS (\d+)_/);
  return match ? parseInt(match[1], 10) : 0;
};

export const closeWindow = () => {
  window.close();

  // In older iOS versions (<18), reloading the extension helped with some popup issues
  // Might no longer be necessary — safe to remove if no issues found
  if (getIOSMajorVersion() > 0 && getIOSMajorVersion() < 18) {
    setTimeout(() => {
      try {
        browser.runtime.reload();
      } catch (error) {
        console.warn('[CleanURLExtension] Failed to browser.runtime.reload:', error);
      }
    }, 100);
  }
};

// ============================================
// Settings
// ============================================
export const settings = (() => {
  const normalizeParamKeys = (paramKeys) => {
    const normalized = { general: [] };
    if (!paramKeys || typeof paramKeys !== 'object') {
      return normalized;
    }

    Object.entries(paramKeys).forEach(([scope, values]) => {
      if (!Array.isArray(values)) {
        return;
      }

      const normalizedScope = scope === 'general' ? 'general' : scope.trim().toLowerCase();
      if (!normalizedScope) {
        return;
      }

      const unique = [];
      const seen = new Set();
      values.forEach((value) => {
        if (typeof value !== 'string') {
          return;
        }

        const cleanedValue = value.trim();
        if (!cleanedValue || seen.has(cleanedValue)) {
          return;
        }

        seen.add(cleanedValue);
        unique.push(cleanedValue);
      });

      if (unique.length > 0 || normalizedScope === 'general') {
        normalized[normalizedScope] = unique;
      }
    });

    if (!Array.isArray(normalized.general)) {
      normalized.general = [];
    }

    return normalized;
  };

  const cloneParamKeys = (paramKeys) => {
    const normalized = normalizeParamKeys(paramKeys);
    const cloned = {};

    Object.entries(normalized).forEach(([scope, values]) => {
      cloned[scope] = [...values];
    });

    return cloned;
  };

  const DEFAULT_SETTINGS = {
    isCleanURLed: false,
    addParamOptLimit: false,
    addParamOptSharing: false,
  };

  const DEFAULT_PARAM_KEYS = { general: [] };

  const normalizeSettings = (value) => {
    const source = (value && typeof value === 'object') ? value : {};
    return { ...DEFAULT_SETTINGS, ...source };
  };

  let settingsCache = { ...DEFAULT_SETTINGS };
  let paramKeysCache = cloneParamKeys(DEFAULT_PARAM_KEYS);

  const persistSettings = async () => {
    try {
      await browser.storage.local.set({ settings: settingsCache });
    } catch (error) {
      console.error('[CleanURLExtension] Failed to save settings:', error);
    }
  };

  const persistParamKeys = async () => {
    try {
      await browser.storage.local.set({ paramKeys: paramKeysCache });
    } catch (error) {
      console.error('[CleanURLExtension] Failed to save paramKeys:', error);
    }
  };

  const load = async () => {
    try {
      const stored = await browser.storage.local.get(['settings', 'paramKeys']);
      settingsCache = normalizeSettings(stored.settings);
      paramKeysCache = cloneParamKeys(stored.paramKeys);
    } catch (error) {
      console.error('[CleanURLExtension] Failed to load settings:', error);
    }
  };

  const get = (key) => {
    if (key === undefined) {
      return { ...settingsCache, paramKeys: cloneParamKeys(paramKeysCache) };
    }
    if (key === 'paramKeys') {
      return cloneParamKeys(paramKeysCache);
    }
    return settingsCache[key];
  };

  const set = async (key, value) => {
    if (key === 'paramKeys') {
      paramKeysCache = normalizeParamKeys(value);
      await persistParamKeys();
      return;
    }

    settingsCache[key] = value;
    await persistSettings();
  };

  const addParamKeys = async (scopeKey, params) => {
    const normalizedScope = scopeKey === 'general' ? 'general' : `${scopeKey || ''}`.trim().toLowerCase();
    if (!normalizedScope) {
      return;
    }

    const normalizedParams = (Array.isArray(params) ? params : [])
      .filter((value) => typeof value === 'string')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);

    if (normalizedParams.length === 0) {
      return;
    }

    const nextParamKeys = cloneParamKeys(paramKeysCache);
    if (!Array.isArray(nextParamKeys[normalizedScope])) {
      nextParamKeys[normalizedScope] = [];
    }

    const existing = new Set(nextParamKeys[normalizedScope]);
    normalizedParams.forEach((value) => {
      if (existing.has(value)) {
        return;
      }
      existing.add(value);
      nextParamKeys[normalizedScope].push(value);
    });

    paramKeysCache = normalizeParamKeys(nextParamKeys);
    await persistParamKeys();
  };

  browser.storage.onChanged.addListener(async (changes, area) => {
    if (area !== 'local') {
      return;
    }

    if (changes.settings) {
      settingsCache = normalizeSettings(changes.settings.newValue);
    }

    if (changes.paramKeys) {
      paramKeysCache = cloneParamKeys(changes.paramKeys.newValue);
    }
  });

  return { load, get, set, addParamKeys };
})();
