import { getCurrentLangLabelString, applyRTLSupport } from './localization.js';
import { sendMessageSafe, applyPlatformClass, settings, closeWindow } from './utils.js';

const DEFAULT_DISABLED_MESSAGE = `${getCurrentLangLabelString('noParamMsg')}`;

const getActiveTabContext = async () => {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url) {
    return null;
  }

  try {
    const url = new URL(tab.url);
    const urlKeys = [...new Set([...url.searchParams.keys()])];
    return {
      tabId: tab.id,
      hostname: url.hostname.trim().toLowerCase(),
      urlKeys,
    };
  } catch (error) {
    console.warn('[CleanURLExtension] Failed to parse active tab URL:', error);
    return null;
  }
};

const buildPopup = async (settings) => {
  applyPlatformClass();
  applyRTLSupport();

  const paramList = document.getElementById('paramList');
  const paramListLabel = document.getElementById('paramListLabel');
  const paramListOption = document.getElementById('paramListOption');
  const addParamBtn = document.getElementById('addParamBtn');
  const editParamBtn = document.getElementById('editParamBtn');

  paramListLabel.textContent = `${getCurrentLangLabelString('paramListLabel')}`;
  addParamBtn.textContent = `${getCurrentLangLabelString('addParamBtn')}`;
  editParamBtn.textContent = `${getCurrentLangLabelString('editParamBtn')}`;

  const configCheckboxes = [
    { key: 'isCleanURLed', label: `${getCurrentLangLabelString('configEnabled')}` },
    { key: 'addParamOptLimit', label: `${getCurrentLangLabelString('addParamOptLimit')}` },
    { key: 'addParamOptSharing', label: `${getCurrentLangLabelString('addParamOptSharing')}` },
  ];

  let activeTabContext = null;

  const hasAnyParamKeys = (paramKeys) => {
    if (!paramKeys || typeof paramKeys !== 'object') {
      return false;
    }

    return Object.values(paramKeys).some((values) => Array.isArray(values) && values.length > 0);
  };

  const updateEditParamBtnVisibility = () => {
    const visible = hasAnyParamKeys(settings.get('paramKeys'));
    editParamBtn.style.display = visible ? 'block' : 'none';
  };

  const applyDisabledState = (message = DEFAULT_DISABLED_MESSAGE) => {
    updateEditParamBtnVisibility();
    paramListOption.style.display = 'none';
    addParamBtn.style.display = 'none';
    paramList.innerHTML = '';
    const li = document.createElement('li');
    const div = document.createElement('div');
    const p = document.createElement('p');
    p.textContent = message;
    div.appendChild(p);
    li.appendChild(div);
    paramList.appendChild(li);
  };

  const renderParamList = async () => {
    updateEditParamBtnVisibility();

    const isConfigEnabled = settings.get('isCleanURLed');
    if (isConfigEnabled) {
      paramListOption.style.display = 'block';
      addParamBtn.style.display = 'block';
      activeTabContext = await getActiveTabContext();
      if (!activeTabContext || activeTabContext.urlKeys.length === 0) {
        applyDisabledState();
        return;
      }

      const paramKeys = settings.get('paramKeys') ?? {};
      const generalParams = Array.isArray(paramKeys.general) ? paramKeys.general : [];
      const hostnameParams = Array.isArray(paramKeys[activeTabContext.hostname])
        ? paramKeys[activeTabContext.hostname]
        : [];
      const registeredParams = new Set([...generalParams, ...hostnameParams]);

      paramList.innerHTML = '';
      activeTabContext.urlKeys.forEach((param) => {
        const li = document.createElement('li');
        const div = document.createElement('div');

        const label = document.createElement('label');
        label.htmlFor = `param-${param}`;
        label.textContent = param;

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `param-${param}`;
        checkbox.value = param;
        checkbox.checked = !registeredParams.has(param);
        checkbox.className = 'toggle-disabled';

        const toggleSpan = document.createElement('span');
        toggleSpan.className = 'toggle';
        toggleSpan.addEventListener('click', () => {
          checkbox.click();
        });

        checkbox.addEventListener('change', async () => {
          checkbox.classList.remove('toggle-disabled');
        });

        div.appendChild(label);
        div.appendChild(checkbox);
        div.appendChild(toggleSpan);
        li.appendChild(div);
        paramList.appendChild(li);
      });
      return;
    }

    applyDisabledState();
  };

  const toggleConfigEnabled = async () => {
    updateEditParamBtnVisibility();

    const isConfigEnabled = settings.get('isCleanURLed');
    if (isConfigEnabled) {
      await renderParamList();
    } else {
      applyDisabledState();
    }
  };

  const renderCheckboxes = () => {
    configCheckboxes.forEach(({ key, label }) => {
      const checkbox = document.getElementById(key);
      const labelElement = document.querySelector(`label[for="${key}"]`);
      if (!checkbox || !labelElement) return;

      labelElement.textContent = label;
      checkbox.checked = settings.get(key);

      checkbox.addEventListener('click', (event) => {
        event.target.classList.remove('toggle-disabled');
      });

      const toggleSpan = checkbox.nextElementSibling;
      if (toggleSpan) {
        toggleSpan.addEventListener('click', () => {
          checkbox.click();
        });
      }

      checkbox.addEventListener('change', async () => {
        checkbox.classList.remove('toggle-disabled');
        await settings.set(key, checkbox.checked);

        const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
        if (activeTab?.id) {
          await sendMessageSafe(activeTab.id, { type: 'CONFIG_UPDATED', config: settings.get() });
        }

        if (key === 'isCleanURLed' || key === 'addParamOptLimit') {
          await toggleConfigEnabled();
        }
      });
    });
  };

  addParamBtn.addEventListener('click', async () => {
    const isConfigEnabled = settings.get('isCleanURLed');
    if (!isConfigEnabled) return;

    if (!activeTabContext) {
      await renderParamList();
    }

    if (!activeTabContext?.tabId) return;

    const selectedParams = [...paramList.querySelectorAll('input[type="checkbox"]')]
      .filter((checkbox) => checkbox.checked)
      .map((checkbox) => checkbox.value.trim())
      .filter((value) => value.length > 0);

    if (selectedParams.length === 0) return;

    const scope = settings.get('addParamOptLimit') ? activeTabContext.hostname : 'general';
    await settings.addParamKeys(scope, selectedParams);
    await sendMessageSafe(activeTabContext.tabId, { type: 'CONFIG_UPDATED', config: settings.get() });
    await renderParamList();
    
    closeWindow();
  });

  addParamBtn.addEventListener('touchstart', (event)   => addParamBtn.classList.add('active'));
  addParamBtn.addEventListener('touchend', (event)     => addParamBtn.classList.remove('active'));
  addParamBtn.addEventListener('touchcancel', (event)  => addParamBtn.classList.remove('active'));

  editParamBtn.addEventListener('click', async () => {
    browser.runtime.openOptionsPage();
    closeWindow();
  });

  editParamBtn.addEventListener('touchstart', (event)   => editParamBtn.classList.add('active'));
  editParamBtn.addEventListener('touchend', (event)     => editParamBtn.classList.remove('active'));
  editParamBtn.addEventListener('touchcancel', (event)  => editParamBtn.classList.remove('active'));

  renderCheckboxes();
  await toggleConfigEnabled();

};

let isInitialized = false;
const initializePopup = async () => {
  if (isInitialized) return;
  isInitialized = true;
  
  await settings.load();
  try {
    await buildPopup(settings);
  } catch (error) {
    console.error('[CleanURLExtension] Fail to initialize to build the popup:', error);
    isInitialized = false;
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializePopup, { once: true });
} else {
  initializePopup();
}
