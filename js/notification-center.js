/* Channel Studio v14 — Alerts page: planner notifications, posting progress, reliability status. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = s => Studio.esc(s);

  function tiles() {
    const now = Date.now(), posts = Studio.tasks().filter(t => (t.type || 'post') === 'post');
    const st = t => Studio.taskStatus(t, now);
    const due = posts.filter(t => st(t) === 'due').length, over = posts.filter(t => st(t) === 'overdue').length;
    const next24 = posts.filter(t => { const d = new Date(t.date).getTime(); return !t.done && d > now && d - now <= 864e5; }).length;
    const wk = new Date(); wk.setDate(wk.getDate() - 6); wk.setHours(0, 0, 0, 0);
    const doneWeek = posts.filter(t => t.done && new Date(t.completedAt || t.date) >= wk).length;
    const T = (n, label, tone, ico) => `<article class="nc-tile tone-${tone}" data-tilt><span>${ico}</span><b>${n}</b><small>${label}</small></article>`;
    $('ncTiles').innerHTML = T(due + over, 'Need posting now', due + over ? 'amber' : 'grey', '⏰') + T(next24, 'Next 24 hours', 'blue', '🗓️') + T(over, 'Overdue', over ? 'red' : 'grey', '🚨') + T(doneWeek, 'Posted this week', 'green', '📣');
  }

  function feed() {
    const list = Studio.alerts();
    $('ncFeed').innerHTML = list.length ? list.map(a => `<a class="nc-alert lvl-${a.level}" href="${esc(a.href)}"><span class="nc-alert-ico">${a.icon}</span><div><b>${esc(a.title)}</b><p>${esc(a.text)}</p></div><span class="nc-go">›</span></a>`).join('') : '<div class="empty-state">🌿 All clear — nothing due and no seasons ending soon.</div>';
  }

  function progress() {
    const sr = Studio.series();
    if (!sr.length) { $('ncProgress').innerHTML = '<div class="empty-state">No episodes yet. Split a story or add ready-made episodes to track posting progress.</div>'; return; }
    $('ncProgress').innerHTML = sr.map(st => {
      const cfg = Studio.alertSettings();
      return `<article class="nc-series"><div class="nc-series-head"><div><b>📚 ${esc(st.title)}</b><span class="small muted">${st.posted} posted · ${st.remaining} remaining of ${st.total}</span></div><span class="wf-pct">${st.pct}%</span></div><div class="progress-track"><span style="width:${st.pct}%"></span></div>
        <div class="nc-seasons">${st.seasons.map(se => {
          const c = se.counts, ending = se.remaining > 0 && se.posted > 0 && se.remaining <= cfg.endThreshold, finished = se.total > 0 && se.remaining === 0;
          return `<div class="nc-season ${ending ? 'ending' : ''} ${finished ? 'finished' : ''}"><div class="nc-season-top"><b>Season ${se.number}</b><span class="small">${finished ? '🏁 Complete' : ending ? `⏳ ${se.remaining} left` : `${se.remaining} left`}</span></div><div class="nc-bar"><i class="b-posted" style="width:${se.total ? c.posted / se.total * 100 : 0}%"></i><i class="b-sched" style="width:${se.total ? c.scheduled / se.total * 100 : 0}%"></i><i class="b-ready" style="width:${se.total ? c.ready / se.total * 100 : 0}%"></i><i class="b-edit" style="width:${se.total ? c.edit / se.total * 100 : 0}%"></i></div><p class="small muted">📣 ${c.posted} · 🗓️ ${c.scheduled} · ✅ ${c.ready} · ✏️ ${c.edit}${se.next ? ` · next: E${String(se.next.number).padStart(2, '0')}` : ''}</p></div>`;
        }).join('')}</div></article>`;
    }).join('') + '<p class="small muted nc-legend"><span><i class="b-posted"></i>Posted</span><span><i class="b-sched"></i>Scheduled</span><span><i class="b-ready"></i>Ready</span><span><i class="b-edit"></i>Edit</span></p>';
  }

  function settings() {
    const c = Studio.alertSettings();
    $('ncEnd').value = String(c.endThreshold); $('ncSoon').value = String(c.soonMinutes); $('ncRunway').value = String(c.runwayPosts);
    $('ncSave').onclick = () => {
      Studio.set('alertSettings', { endThreshold: Number($('ncEnd').value), soonMinutes: Number($('ncSoon').value), runwayPosts: Number($('ncRunway').value) });
      Studio.toast('Alert settings saved.'); Studio.changed();
    };
  }

  async function reliability() {
    const s = window.StudioAlerts ? await StudioAlerts.status() : {};
    const row = (state, title, text) => `<li class="nc-rel ${state}"><span>${state === 'ok' ? '✅' : state === 'warn' ? '⚠️' : '❌'}</span><div><b>${title}</b><p class="small muted">${text}</p></div></li>`;
    const perm = s.notifications;
    const rows = [
      row(perm === 'granted' ? 'ok' : perm === 'denied' ? 'bad' : 'warn', 'Notifications', perm === 'granted' ? 'Allowed. Alerts appear while Channel Studio is open or running in the background.' : perm === 'denied' ? 'Blocked in browser settings. Re-enable them for this site.' : perm === 'unsupported' ? 'This browser does not support notifications.' : 'Not enabled yet — tap “Allow notifications”.'),
      row(s.standalone ? 'ok' : 'warn', 'Installed app', s.standalone ? 'Running as an installed app.' : 'Install to your home screen (browser menu → Add to Home screen) for the most dependable behaviour.'),
      row(s.periodic === 'registered' ? 'ok' : 'warn', 'Background check (best effort)', s.periodic === 'registered' ? 'Registered. Android Chrome may check for due posts every so often, but timing is up to the browser and is not guaranteed.' : s.periodic === 'available' ? 'Supported but not registered yet (needs notification permission and an installed app).' : 'Not supported on this browser.'),
      row('bad', 'Guaranteed alarm while fully closed', 'A web app can’t promise this. Use the phone-calendar alarm below (reliable), or a native Android build for true Clock-style alarms.')
    ];
    $('ncRel').innerHTML = rows.join('');
  }

  function init() {
    if (!$('ncTiles')) return;
    const all = () => { tiles(); feed(); progress(); };
    all(); settings(); reliability();
    document.addEventListener('studio:changed', all);
    setInterval(all, 30000);
    $('ncPerm').addEventListener('click', async () => {
      const r = await (window.StudioNotify ? StudioNotify.request() : Promise.resolve('unsupported'));
      Studio.toast(typeof r === 'string' && r !== 'granted' && r !== 'denied' && r !== 'default' ? r : 'Notification permission: ' + r);
      if (r === 'granted' && window.StudioAlerts) await StudioAlerts.registerPeriodicSync();
      reliability();
    });