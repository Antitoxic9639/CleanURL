(() => {
  // Pattern-based removal (Prefixes/Patterns)
  const removeParamPatterns = [
    /^utm/i,
    /^ga_/i,
    /^gad_/i,
    /^gcl_/i,
    /^ep[._]/i,
    /^fb_/i,
    /^twclid/i,
    /^twitter_/i,
    /^li_/i,
    /^rdt_/i,
    /^pf_rd_/i,
    /^pd_rd_/i,
    /^shop(ify)?_/i,
    /^cart_/i,
    /^checkout_/i,
    /^ref/i,        // Covers ref, ref_, refRID
    /^hs_/i,
    /^hsa_/i,
    /^mc_/i,
    /^kl_/i,
    /^pi_/i,
    /^mkt_/i,
    /^bd_/i,
    /^hm/i,
    /^naver_/i,
    /^yj_/i,
    /^tc_/i,
    /^ys_/i,
    /^ms_/i,
    /^mp_/i,
    /^amp_/i,
    /^sp_/i,
    /^hp_/i,
    /^gtm_/i,
    /^consent_/i,
    /^gdpr_/i,
    /^ccpa_/i,
    /^cookie_/i,
    /^cpt_/i,
    /^aff_/i,
    /^mv/i,
    /^trc_/i,       // Taboola
    /^s_/i,         // Adobe/Marketing (s_kwcid, etc.)
    /^nft_/i,
    /^dapp_/i,
    /^beacon_/i,
    /^ltm_/i,
    /^social_/i,    // social_id, social_source, etc.
    /^share_/i,     // share_token, share_ref
    /^offer_/i,      // offer_id, offer_code
  ];

  // Exact match removal (Specific keys)
  const removeExactParams = [
    '_gl', '_gac', '_gid', 'gclid', 'gclsrc', 'dclid', 'wbraid', 'gbraid',
    'fbclid', 'tweetid', 'reddit_ad_id', 'reddit_campaign_id', 'tag',
    'linkCode', 'linkId', 'creativeASIN', 'ascsubtag', '_encoding',
    'qid', 'sr', 'keywords', 'sprefix', 'crid', 'dchild', 'dib', 'dib_tag',
    '_hsenc', '_hsmi', 'mkt_tok', 'yjr', 'yjad', 'yjcmp', 'adtag', 'yclid',
    '_openstat', 'msclkid', 'mixpanel_id', 'amplitude_id', 'snowplow_id',
    'heap_id', 'tracking_consent', 'cid', 'rid', 'adid', 'argument',
    'free4', 'dmai', 'sub_rt', 'spid', 'prid', 'aspid', 'mid', 'scadid',
    'source', 'dv', 'date', 'ctg', 'fr', 'sk', 'afSmartRedirect',
    'gatewayAdapt', 'sdid', 'social_share', 'referrer', 'ie',
    'ecid', 'smid', 'content-id', 'camp', 'creative', // Added back from original
    'promo', 'discount', 'coupon' // Added back from original
  ];

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

  const getCustomParams = (paramKeys, hostname) => {
    const normalizedParamKeys = normalizeParamKeys(paramKeys);
    const normalizedHostname = hostname.trim().toLowerCase();
    const targetHostnameParams = normalizedHostname && Array.isArray(normalizedParamKeys[normalizedHostname])
      ? normalizedParamKeys[normalizedHostname]
      : [];

    return new Set([...normalizedParamKeys.general, ...targetHostnameParams]);
  };

  const getCleanUrl = (url, currentConfig) => {
    try {
      const urlObj = new URL(url);
      const params = urlObj.searchParams;
      const allKeys = Array.from(params.keys());
      const customParams = getCustomParams(currentConfig?.paramKeys, urlObj.hostname);
      
      for (const key of allKeys) {
        if (removeExactParams.includes(key) ||
            removeParamPatterns.some((pattern) => pattern.test(key)) ||
            customParams.has(key)) {
          params.delete(key);
        }
      }

      return urlObj.toString();
    } catch (error) {
      console.error('[CleanURLExtension] Invalid URL:', error);
      return url;
    }
  };

  const DEFAULT_SETTINGS = {
    isCleanURLed: false,
    addParamOptLimit: false,
    addParamOptSharing: false,
  };

  const normalizeConfig = (nextConfig) => {
    const source = (nextConfig && typeof nextConfig === 'object') ? nextConfig : {};
    const { paramKeys, ...settingsWithoutParamKeys } = source;

    return {
      ...DEFAULT_SETTINGS,
      ...settingsWithoutParamKeys,
      paramKeys: normalizeParamKeys(paramKeys),
    };
  };

  const loadConfigFromStorage = async () => {
    const stored = await browser.storage.local.get(['settings', 'paramKeys']);
    const storedSettings = (stored.settings && typeof stored.settings === 'object')
      ? stored.settings
      : {};

    return {
      ...storedSettings,
      paramKeys: stored.paramKeys,
    };
  };

  let config = normalizeConfig({});
  let cleanedUrl = getCleanUrl(window.location.href, config);
  let lastUncleanUrl = window.location.href;

  const requestConfigFromBackground = async () => {
    try {
      const response = await browser.runtime.sendMessage({
        type: 'GET_CURRENT_CONFIG'
      });

      if (response?.config) {
        applyConfig(response.config);
      }
    } catch (error) {
      console.error('[CleanURLExtension] Failed to get config from background:', error);
    }
  };

  const updateIconState = () => {
    browser.runtime.sendMessage({ action: 'UPDATE_ICON' });
  };

  const applyConfig = (nextConfig) => {
    config = normalizeConfig(nextConfig);
    const currentUrl = window.location.href;

    if (config.isCleanURLed) {
      cleanedUrl = getCleanUrl(currentUrl, config);
      if (cleanedUrl !== currentUrl) {
        lastUncleanUrl = currentUrl;
        history.replaceState(null, '', cleanedUrl);
      }
    } else {
      const expectedCleanUrl = getCleanUrl(lastUncleanUrl, config);
      if (currentUrl === expectedCleanUrl && currentUrl !== lastUncleanUrl) {
        history.replaceState(null, '', lastUncleanUrl);
      } else {
        lastUncleanUrl = currentUrl;
      }
    }
    updateIconState();
  };

  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState !== 'visible') return;

    try {
      const freshConfig = normalizeConfig(await loadConfigFromStorage());
      applyConfig(freshConfig);
    } catch (error) {
      console.warn('[CleanURLExtension] Failed to refresh storage, fallback to background:', error);
      requestConfigFromBackground();
    }
  });

  // ========================================
  // Config update: Receive from background
  // ========================================
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'CONFIG_UPDATED') {
      applyConfig(message.config);
    }
    return;
  });

  const initializeContent = async () => {
    try {
      applyConfig(await loadConfigFromStorage());
    } catch (error) {
      console.error('[CleanURLExtension] Failed to load config:', error);
      applyConfig(config);
      requestConfigFromBackground();
    }
  };

  if (document.readyState !== 'loading') {
    initializeContent();
  } else {
    document.addEventListener('DOMContentLoaded', initializeContent, { once: true });
  }
})();
