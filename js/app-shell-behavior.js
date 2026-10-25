/* Channel Studio mobile shell behavior: lock page scaling and return to welcome on app re-entry. */
(function () {
  'use strict';
  try {
    var path = window.location.pathname || '';
    var isWelcome = /(?:^|\/)index\.html$/.test(path) || /\/$/.test(path);
    var internalKey = 'cs_internal_navigation';
    var returnKey = 'cs_return_to_welcome';
    var navEntries = window.performance && performance.getEntriesByType ? performance.getEntriesByType('navigation') : [];
    var isReload = navEntries.length > 0 && navEntries[0].type === 'reload';
    if (isReload) sessionStorage.removeItem(returnKey);
    var internalNavigation = sessionStorage.getItem(internalKey) === '1';
    if (internalNavigation) {
      sessionStorage.removeItem(internalKey);
      sessionStorage.removeItem(returnKey);
    } else if (!isWelcome && sessionStorage.getItem(returnKey) === '1') {
      sessionStorage.removeItem(returnKey);
      window.location.replace('index.html');
      return;
    }

    document.addEventListener('click', function (event) {
      var link = event.target && event.target.closest ? event.target.closest('a[href]') : null;
      if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target === '_blank' || link.hasAttribute('download')) return;
      try {
        var target = new URL(link.href, window.location.href);
        var base = new URL('.', window.location.href);
        if (target.origin === window.location.origin && target.pathname.indexOf(base.pathname) === 0) {
          sessionStorage.setItem(internalKey, '1');
          sessionStorage.removeItem(returnKey);
        }
      } catch (_) {}
    }, true);

    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') {
        if (sessionStorage.getItem(internalKey) !== '1') sessionStorage.setItem(returnKey, '1');
      } else if (document.visibilityState === 'visible' && !isWelcome && sessionStorage.getItem(returnKey) === '1' && sessionStorage.getItem(internalKey) !== '1') {
        sessionStorage.removeItem(returnKey);
        window.location.replace('index.html');
      }
    });
    window.addEventListener('pagehide', function () {
      if (sessionStorage.getItem(internalKey) === '1') {
        sessionStorage.removeItem(internalKey);
      } else {
        sessionStorage.setItem(returnKey, '1');
      }
    });
  } catch (_) { /* If storage is unavailable, the app still works normally. */ }
})();
