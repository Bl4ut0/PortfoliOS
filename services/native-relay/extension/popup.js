/**
 * PortfoliOS Native Game Relay - Popup Controller
 */

document.addEventListener('DOMContentLoaded', () => {
  const hostStatusText = document.getElementById('host-status-text');
  const hostStatusPill = document.getElementById('host-status-pill');
  const webStatusText = document.getElementById('web-status-text');
  const webStatusPill = document.getElementById('web-status-pill');
  const overallDot = document.getElementById('overall-status-dot');

  const btnDesktop = document.getElementById('btn-desktop');
  const btnMobile = document.getElementById('btn-mobile');
  const btnRecheck = document.getElementById('btn-recheck');

  let hostOnline = false;
  let webOnline = false;

  function updateOverallDot() {
    overallDot.className = 'dot';
    if (hostOnline && webOnline) {
      overallDot.classList.add('dot-online');
    } else if (!hostOnline && !webOnline) {
      overallDot.classList.add('dot-offline');
    } else {
      overallDot.classList.add('dot-checking');
    }
  }

  // 1. Check Native Host Status via background script
  function checkNativeHost() {
    hostStatusText.textContent = 'Pinging native host…';
    hostStatusPill.className = 'pill pill-checking';
    hostStatusPill.textContent = 'Checking';

    chrome.runtime.sendMessage({ type: 'checkStatus' }, (res) => {
      if (chrome.runtime.lastError || !res || !res.online) {
        hostOnline = false;
        hostStatusText.textContent = 'Offline (Run register-host.ps1)';
        hostStatusPill.className = 'pill pill-offline';
        hostStatusPill.textContent = 'Offline';
      } else {
        hostOnline = true;
        hostStatusText.textContent = 'UDP & TCP Relay Active';
        hostStatusPill.className = 'pill pill-online';
        hostStatusPill.textContent = 'Ready';
      }
      updateOverallDot();
    });
  }

  // 2. Check PortfoliOS Web Reachability
  async function checkWebService() {
    webStatusText.textContent = 'Checking os.bl4ut0.dev…';
    webStatusPill.className = 'pill pill-checking';
    webStatusPill.textContent = 'Checking';

    const testEndpoints = [
      'https://os.bl4ut0.dev/manifest.webmanifest',
      'https://os.bl4ut0.com/manifest.webmanifest'
    ];

    let foundDomain = null;
    for (const endpoint of testEndpoints) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        await fetch(endpoint, {
          method: 'HEAD',
          mode: 'no-cors',
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        foundDomain = new URL(endpoint).host;
        break;
      } catch (_) {}
    }

    if (foundDomain) {
      webOnline = true;
      webStatusText.textContent = `Online (${foundDomain})`;
      webStatusPill.className = 'pill pill-online';
      webStatusPill.textContent = 'Online';
    } else {
      webOnline = false;
      webStatusText.textContent = 'Unreachable or Offline';
      webStatusPill.className = 'pill pill-offline';
      webStatusPill.textContent = 'Offline';
    }

    updateOverallDot();
  }

  function runChecks() {
    checkNativeHost();
    checkWebService();
  }

  // 3. Navigation Helper
  function navigateTo(targetView) {
    // Check current active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (activeTabs) => {
      const activeTab = activeTabs && activeTabs[0];
      if (activeTab && activeTab.url) {
        try {
          const activeUrl = new URL(activeTab.url);
          if (activeUrl.host === 'os.bl4ut0.dev' || activeUrl.host === 'os.bl4ut0.com' || activeUrl.host === 'localhost' || activeUrl.host === '127.0.0.1') {
            activeUrl.searchParams.set('view', targetView);
            chrome.tabs.update(activeTab.id, { url: activeUrl.toString() });
            window.close();
            return;
          }
        } catch (_) {}
      }

      // Look for any existing os.bl4ut0.dev or os.bl4ut0.com tab
      chrome.tabs.query({ url: ['*://os.bl4ut0.dev/*', '*://os.bl4ut0.com/*'] }, (tabs) => {
        if (tabs && tabs.length > 0) {
          const tab = tabs[0];
          const tabUrl = new URL(tab.url);
          tabUrl.searchParams.set('view', targetView);
          chrome.tabs.update(tab.id, { active: true, url: tabUrl.toString() });
          chrome.windows.update(tab.windowId, { focused: true });
          window.close();
        } else {
          // Open fresh tab on os.bl4ut0.dev
          chrome.tabs.create({ url: `https://os.bl4ut0.dev/?view=${targetView}` });
          window.close();
        }
      });
    });
  }

  // Bind Buttons
  btnDesktop.addEventListener('click', () => navigateTo('desktop'));
  btnMobile.addEventListener('click', () => navigateTo('mobile'));
  btnRecheck.addEventListener('click', () => runChecks());

  // Initial Run
  runChecks();
});
