/* Channel Studio v14 — global alerts.
   Runs on every page: alert banner, bell badge, due-post notifications (via the service worker
   when possible), and a snapshot of upcoming posts handed to the service worker for
   best-effort background checks. A web app CANNOT guarantee alarms while fully closed —
   see Alerts → Reliability for the honest status and the calendar-alarm export. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  let timer = null;

  function seen() { try { return JSON.parse(localStorage.getItem('channelStudioDuePostAlarms') || '{}'); } catch (e) { return {}; } }
  function saveSeen(o) { try { localStorage.setItem('channelStudioDuePostAlarms', JSON.stringify(o)); } catch (e) {} }

  async function showNotification(title, body, tag) {
    try { window.StudioNotify && window.StudioNotify.playTone && window.StudioNotify.playTone(false); } catch (e) {}
    if (!('Notification' in window) || Notification.permission !== 'granted') return false;
    const opts = { body, tag, icon: 'assets/icons/icon-192.png', badge: 'assets/icons/icon-192.png', requireInteraction: true, data: { url: 'schedule.html' } };
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg && reg.showNotification) { await reg.showNotification(title, opts); return true; }
      }
    } catch (e) {}
    try { const n = new Notification(title, opts); n.onclick = () => { try { window.focus(); } catch (e) {} location.href = 'schedule.html'; n.close(); }; return true; } catch (e) { return false; }
  }

  function checkNotify() {
    if (!window.Studio) return;
    const now = Date.now(), cfg = Studio.alertSettings(), s = seen(); let dirty = false;
    Studio.tasks().forEach(t => {
      if ((t.type || 'post') !== 'post' || t.done || !t.date) return;
      const when = new Date(t.date).getTime(); if (!Number.isFinite(when)) return;
      const base = String(t.id || t.title) + '|' + t.date;
      const label = t.title || 'Planned post';
      const lead = Math.max(cfg.soonMinutes, Number(t.reminderMinutes) || 0) * 60000;
      if (when <= now) {
        if (!s[base]) { s[base] = Date.now(); dirty = true; showNotification('⏰ Time to post', `${label}${t.channelName ? ' → ' + t.channelName : ''}. Tap to copy and publish.`, 'cs-due-' + base); Studio.toast('⏰ Posting time: ' + label); }
      } else if (when - now <= lead && !s[base + '|soon']) {
        s[base + '|soon'] = Date.now(); dirty = true;
        showNotification('🔔 Post coming up ' + Studio.relTime(when - now), `${label}${t.channelName ? ' → ' + t.channelName : ''}`, 'cs-soon-' + base);
      }
    });
    if (dirty) saveSeen(s);
  }

  function pushSnapshotToWorker() {
    try {
      if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) return;
      const list = Studio.tasks().filter(t => !t.done && t.date).map(t => ({ id: t.id, title: t.title || 'Planned post', date: t.date, channelName: t.channelName || '' }));
      navigator.serviceWorker.controller.postMessage({ type: 'cs-tasks', tasks: list, lead: Studio.alertSettings().soonMinutes });
    } catch (e) {}
  }

  async function registerPeriodicSync() {
    try {
      const reg = await navigator.serviceWorker.ready;
      if (!reg.periodicSync) return false;
      const perm = await navigator.permissions.query({ name: 'periodic-background-sync' });
      if (perm.state !== 'granted') return false;
      await reg.periodicSync.register('cs-due-check', { minInterval: 15 * 60 * 1000 });
      return true;
    } catch (e) { return false; }
  }

  function ensureChrome() {
    const actions = document.querySelector('.topbar-actions');
    if (actions && !$('studioBell')) {
      const a = document.createElement('a'); a.id = 'studioBell'; a.className = 'icon-button bell-button'; a.href = 'notifications.html'; a.setAttribute('aria-label', 'Alerts');
      a.innerHTML = '<span aria-hidden="true">🔔</span><b class="bell-badge" hidden>0</b>';