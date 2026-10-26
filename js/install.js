
(function () {
  'use strict';

  let installPrompt = null;
  let popupShown = false;

  // Capture the browser's installation event as early as possible.
  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    installPrompt = event;
  });

  function showInstallPopup() {
    if (popupShown) return;

    const installed =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;

    if (installed || localStorage.getItem('cs_install_dismissed') === '1') {
      return;
    }

    popupShown = true;

    const overlay = document.createElement('div');
    overlay.id = 'csInstallPopup';
    overlay.style.cssText = `
      position:fixed; inset:0; z-index:99999;
      background:rgba(0,0,0,.58); display:flex;
      align-items:center; justify-content:center;
      padding:20px; font-family:system-ui,sans-serif;
    `;

    overlay.innerHTML = `
      <section style="
        width:100%;max-width:360px;background:var(--card-bg,#fff);
        color:var(--text-color,#172033);border-radius:22px;
        padding:25px 22px;text-align:center;
        box-shadow:0 18px 55px rgba(0,0,0,.25)">
        <div style="font-size:38px;margin-bottom:10px">📲</div>
        <h2 style="margin:0 0 10px;font-size:22px">
          Install Channel Studio
        </h2>
        <p style="line-height:1.6;margin:0 0 22px">
          Add Channel Studio to your home screen for quicker access
          and a smoother app-like experience.
        </p>
        <button id="csInstallNow" style="
          width:100%;padding:13px;border:0;border-radius:12px;
          background:#1677ff;color:white;font-weight:700;font-size:15px">
          Install app
        </button>
        <button id="csInstallLater" style="
          width:100%;padding:12px;margin-top:8px;border:0;
          border-radius:12px;background:transparent;color:inherit">
          Not now
        </button>
        <p id="csInstallHelp" style="font-size:12px;line-height:1.5"></p>
      </section>
    `;

    document.body.appendChild(overlay);

    function closePopup() {
      overlay.remove();
    }

    overlay.querySelector('#csInstallLater').addEventListener('click', function () {
      localStorage.setItem('cs_install_dismissed', '1');
      closePopup();
    });

    overlay.querySelector('#csInstallNow').addEventListener('click', async function () {
      if (!installPrompt) {
        overlay.querySelector('#csInstallHelp').textContent =
          'If installation is available, open your browser menu (⋮) and choose “Install app” or “Add to Home screen”.';
        return;
      }

      installPrompt.prompt();
      const result = await installPrompt.userChoice;
      installPrompt = null;

      if (result.outcome === 'accepted') {
        closePopup();
      } else {
        overlay.querySelector('#csInstallHelp').textContent =
          'No problem. You can install it later from your browser menu.';
      }
    });

    window.addEventListener('appinstalled', function () {
      localStorage.removeItem('cs_install_dismissed');
      closePopup();
    }, { once: true });
  }

  function start() {
    // Give the welcome page time to appear before showing the popup.
    setTimeout(showInstallPopup, 1800);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
