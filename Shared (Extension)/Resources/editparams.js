import { getCurrentLangLabelString, applyRTLSupport } from './localization.js';
import { applyPlatformClass, sendMessageSafe, settings, closeWindow } from './utils.js';

const GENERAL_SCOPE_KEY = 'general';
const GENERAL_SCOPE_KEY_LABEL = `${getCurrentLangLabelString('generalScopeLabel')}`;
const EMPTY_STATE_MESSAGE = 'No saved parameters yet. Add parameters from the popup first.';
const DUPLICATE_BORDER_COLORS = [
  'rgb(245 158 11 / 50%)',
  'rgb(16 185 129 / 50%)',
  'rgb(59 130 246 / 50%)',
  'rgb(239 68 68 / 50%)',
  'rgb(139 92 246 / 50%)',
  'rgb(20 184 166 / 50%)',
];

const normalizeParamKeys = (paramKeys) => {
  const normalized = { [GENERAL_SCOPE_KEY]: [] };
  if (!paramKeys || typeof paramKeys !== 'object') {
    return normalized;
  }

  Object.entries(paramKeys).forEach(([scope, values]) => {
    if (!Array.isArray(values)) {
      return;
    }

    const normalizedScope = scope === GENERAL_SCOPE_KEY ? GENERAL_SCOPE_KEY : scope.trim().toLowerCase();
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

    if (unique.length > 0 || normalizedScope === GENERAL_SCOPE_KEY) {
      normalized[normalizedScope] = unique;
    }
  });

  if (!Array.isArray(normalized[GENERAL_SCOPE_KEY])) {
    normalized[GENERAL_SCOPE_KEY] = [];
  }

  return normalized;
};

const scopeState = new Map();
let scopeOrder = [];
let persistQueue = Promise.resolve();

const hashString = (value) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
};

const getDuplicateColor = (paramName) => {
  const normalized = `${paramName ?? ''}`.trim().toLowerCase();
  const colorIndex = hashString(normalized) % DUPLICATE_BORDER_COLORS.length;
  return DUPLICATE_BORDER_COLORS[colorIndex];
};

const getGlobalDuplicateSet = () => {
  const generalValues = (scopeState.get(GENERAL_SCOPE_KEY) ?? []).map((item) => item.value);
  const generalSet = new Set(generalValues);
  const duplicateSet = new Set();

  scopeOrder
    .filter((scope) => scope !== GENERAL_SCOPE_KEY)
    .forEach((scope) => {
      const items = scopeState.get(scope) ?? [];
      items.forEach((item) => {
        if (generalSet.has(item.value)) {
          duplicateSet.add(item.value);
        }
      });
    });

  return duplicateSet;
};

const renderEmptyState = (list) => {
  list.innerHTML = '';
  const dt = document.createElement('dt');
  const dd = document.createElement('dd');
  const p = document.createElement('p');
  p.textContent = EMPTY_STATE_MESSAGE;
  dd.appendChild(p);
  dt.appendChild(document.createElement('h2')).textContent = GENERAL_SCOPE_KEY_LABEL;
  list.appendChild(dt);
  list.appendChild(dd);
};

const getScopeTitle = (scope) => {
  if (scope === GENERAL_SCOPE_KEY) {
    return GENERAL_SCOPE_KEY_LABEL;
  }
  return scope;
};

const notifyActiveTabConfigUpdated = async () => {
  try {
    const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!activeTab?.id) {
      return;
    }

    await sendMessageSafe(activeTab.id, { type: 'CONFIG_UPDATED', config: settings.get() });
  } catch (error) {
    console.warn('[CleanURLExtension] Failed to notify active tab from options page:', error);
  }
};

const persistScopeState = async () => {
  const nextParamKeys = {};

  scopeOrder.forEach((scope) => {
    const items = scopeState.get(scope) ?? [];
    const enabledParams = items
      .filter((item) => item.enabled)
      .map((item) => item.value);

    if (scope === GENERAL_SCOPE_KEY || enabledParams.length > 0) {
      nextParamKeys[scope] = enabledParams;
    }
  });

  if (!Array.isArray(nextParamKeys[GENERAL_SCOPE_KEY])) {
    nextParamKeys[GENERAL_SCOPE_KEY] = [];
  }

  await settings.set('paramKeys', nextParamKeys);
  await notifyActiveTabConfigUpdated();
};

const queuePersistScopeState = async () => {
  persistQueue = persistQueue
    .then(() => persistScopeState())
    .catch((error) => {
      console.error('[CleanURLExtension] Failed to persist paramKeys from options page:', error);
    });

  await persistQueue;
};

const bindCloseButtonEvents = (editParamCloseBtn) => {
  if (!editParamCloseBtn || editParamCloseBtn.dataset.boundCloseEvents === 'true') {
    return;
  }

  editParamCloseBtn.addEventListener('click', async () => {
    closeWindow();
  });

  editParamCloseBtn.addEventListener('touchstart', () => editParamCloseBtn.classList.add('active'));
  editParamCloseBtn.addEventListener('touchend', () => editParamCloseBtn.classList.remove('active'));
  editParamCloseBtn.addEventListener('touchcancel', () => editParamCloseBtn.classList.remove('active'));
  editParamCloseBtn.dataset.boundCloseEvents = 'true';
};

const buildList = (list) => {
  const editParamTitle = document.getElementById('editParamTitle');
  const editParamCloseBtn = document.getElementById('editParamCloseBtn');
  const editParamHelpText = document.getElementById('editParamHelpText');
  
  editParamTitle.textContent = `${getCurrentLangLabelString('editParamTitle')}`;
  editParamCloseBtn.textContent = `${getCurrentLangLabelString('editParamCloseBtn')}`;
  editParamHelpText.textContent = `${getCurrentLangLabelString('editParamHelpText')}`;
  bindCloseButtonEvents(editParamCloseBtn);
  
  list.innerHTML = '';
  const visibleScopes = scopeOrder.filter((scope) => (scopeState.get(scope) ?? []).length > 0);
  const globalDuplicateSet = getGlobalDuplicateSet();
  
  if (visibleScopes.length === 0) {
    renderEmptyState(list);
    return;
  }
  
  visibleScopes.forEach((scope, scopeIndex) => {
    const dt = document.createElement('dt');
    const heading = document.createElement('h2');
    heading.textContent = getScopeTitle(scope);
    dt.appendChild(heading);
    list.appendChild(dt);
    
    const dd = document.createElement('dd');
    const ul = document.createElement('ul');
    dd.appendChild(ul);
    
    const items = scopeState.get(scope) ?? [];
    items.forEach((item, itemIndex) => {
      const li = document.createElement('li');
      const div = document.createElement('div');
      const input = document.createElement('input');
      const checkmark = document.createElement('span');
      const label = document.createElement('label');
      
      const checkboxId = `scope-${scopeIndex}-param-${itemIndex}`;
      input.type = 'checkbox';
      input.id = checkboxId;
      input.checked = item.enabled;

      if (globalDuplicateSet.has(item.value)) {
        li.classList.add('is-duplicated');
        li.style.setProperty('--dup-color', getDuplicateColor(item.value));
      }
      
      checkmark.className = 'checkmark';
      checkmark.addEventListener('click', () => {
        input.click();
      });
      
      label.htmlFor = checkboxId;
      label.textContent = item.value;
      
      input.addEventListener('change', async () => {
        const targetItems = scopeState.get(scope) ?? [];
        const target = targetItems.find((entry) => entry.value === item.value);
        if (!target) {
          return;
        }
        
        target.enabled = input.checked;
        await queuePersistScopeState();
      });
      
      div.appendChild(input);
      div.appendChild(checkmark);
      div.appendChild(label);
      li.appendChild(div);
      ul.appendChild(li);
    });
    
    list.appendChild(dd);
    
    if (scopeIndex < visibleScopes.length - 1) {
      list.appendChild(document.createElement('hr'));
    }
  });

};

document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState !== 'visible') return;

  try {
    initializeEditParamsPage();
  } catch (error) {
    console.warn('[CleanURLExtension] Failed to refresh page:', error);
  }
});

const initializeScopeState = (paramKeys) => {
  const normalized = normalizeParamKeys(paramKeys);
  scopeState.clear();

  const allScopes = Object.keys(normalized);
  scopeOrder = allScopes.includes(GENERAL_SCOPE_KEY)
    ? [GENERAL_SCOPE_KEY, ...allScopes.filter((scope) => scope !== GENERAL_SCOPE_KEY)]
    : [...allScopes];

  scopeOrder.forEach((scope) => {
    const values = normalized[scope] ?? [];
    scopeState.set(
      scope,
      values.map((value) => ({
        value,
        enabled: true,
      }))
    );
  });
};

const initializeEditParamsPage = async () => {
  applyPlatformClass();
  applyRTLSupport();

  const list = document.getElementById('editParamList');
  if (!list) return;

  await settings.load();
  initializeScopeState(settings.get('paramKeys'));
  buildList(list);
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeEditParamsPage, { once: true });
} else {
  initializeEditParamsPage();
}
