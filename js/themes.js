(function () {
  'use strict';

  const DEFAULTS = { theme: 'system', font: 'modern', motion: 'full' };
  const THEMES = ['system', 'light', 'dark', 'ocean', 'sunset', 'forest'];
  const FONTS = ['modern', 'rounded', 'handwriting', 'serif'];
  const MOTIONS = ['full', 'reduced'];

  function getSetting(key) {
    try {
      const store = window.StudioStore;
      if (store && typeof store.get === 'function') {
        const value = store.get(key, DEFAULTS[key]);
        if (value !== undefined && value !== null && value !== '') return value;
      }
    } catch (error) {}
    try {
      const value = localStorage.getItem('studio_' + key);
      if (value !== null) return value;
    } catch (error) {}
    return DEFAULTS[key];
  }

  function setSetting(key, value) {
    try {
      if (window.StudioStore && typeof window.StudioStore.set === 'function') {
        window.StudioStore.set(key, value);
        return;
      }
    } catch (error) {}
    try { localStorage.setItem('studio_' + key, value); } catch (error) {}
  }

  function normalize(value, allowed, fallback) {
    return allowed.includes(value) ? value : fallback;
  }

  function apply() {
    const savedTheme = normalize(getSetting('theme'), THEMES, 'system');
    const font = normalize(getSetting('font'), FONTS, 'modern');
    let motion = getSetting('motion');
    // Older project versions stored motion as "on"/"off".
    if (motion === 'off' || motion === 'reduced') motion = 'reduced';
    else motion = 'full';
    const actualTheme = savedTheme === 'system'
      ? ((window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light')
      : savedTheme;

    document.documentElement.dataset.theme = actualTheme;
    if (document.body) {
      document.body.dataset.theme = actualTheme;
      document.body.dataset.font = font;
      document.body.dataset.motion = motion;
    }

    const themeSelect = document.getElementById('themeSelect');
    if (themeSelect) themeSelect.value = savedTheme;
    const fontSelect = document.getElementById('fontSelect');
    if (fontSelect) fontSelect.value = font;
    const motionSelect = document.getElementById('motionSelect');
    if (motionSelect) motionSelect.value = motion;

    // Keep the browser's native controls in step with the selected palette.
    document.documentElement.style.colorScheme =
      (actualTheme === 'dark' || actualTheme === 'forest') ? 'dark' : 'light';
  }

  window.applyStudioTheme = apply;
  window.saveStudioAppearance = function (theme, font, motion) {
    setSetting('theme', normalize(theme, THEMES, 'system'));
    setSetting('font', normalize(font, FONTS, 'modern'));
    setSetting('motion', normalize(motion, MOTIONS, 'full'));
    apply();
  };

  document.addEventListener('DOMContentLoaded', apply);
  window.addEventListener('storage', apply);
  if (window.matchMedia) {
    const preference = window.matchMedia('(prefers-color-scheme: dark)');
    if (preference.addEventListener) preference.addEventListener('change', function () {
      if (getSetting('theme') === 'system') apply();
    });
    else if (preference.addListener) preference.addListener(function () {
      if (getSetting('theme') === 'system') apply();
    });
  }
  // If this script is loaded after DOMContentLoaded, apply immediately too.
  if (document.readyState !== 'loading') apply();
})();