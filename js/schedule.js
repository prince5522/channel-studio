/* Channel Studio v14 — Schedule view. Renders into #scheduleView (schedule.html and planner.html). */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = s => Studio.esc(s);
  const state = { filter: 'all', channel: 'all', day: '' };
  let root = null;

  const isPost = t => (t.type || 'post') === 'post';

  function avatar(url, name) {
    const c = Studio.channelByUrl(url);
    if (c && c.avatar) return `<img class="sch-av" src="${esc(c.avatar)}" alt="">`;
    const ini = String(name || (c && c.name) || '#').trim().slice(0, 1).toUpperCase();
    return `<span class="sch-av sch-av-ini">${esc(ini)}</span>`;
  }

  function filtered() {
    const now = Date.now();
    return Studio.tasks().map(t => Object.assign({}, t, { _st: Studio.taskStatus(t, now) })).filter(isPost).filter(t => {
      if (state.channel !== 'all' && (t.channelUrl || '') !== state.channel) return false;
      if (state.day && (!t.date || Studio.dayKey(t.date) !== state.day)) return false;
      if (state.filter === 'action') return t._st === 'due' || t._st === 'overdue';
      if (state.filter === 'upcoming') return t._st === 'scheduled' || t._st === 'soon';
      if (state.filter === 'posted') return t._st === 'posted';
      return true;
    });
  }

  function countdown(next) {
    if (!next) return '<div class="sch-next empty"><span>🛌</span><div><b>No upcoming posts</b><p class="muted small">Schedule episodes from the workflow board or plan a custom post.</p></div><a class="button primary small-button" href="workflow.html">Open workflow</a></div>';
    const ms = new Date(next.date).getTime() - Date.now();
    return `<div class="sch-next"><span class="sch-next-ico">⏱️</span><div><p class="eyebrow">NEXT POST</p><b>${esc(next.title || 'Planned post')}</b><p class="muted small">${esc(Studio.fmtWhen(next.date))} · ${esc(Studio.relTime(ms))}${next.channelName ? ' · ' + esc(next.channelName) : ''}</p></div></div>`;
  }

  function dayStrip() {
    const posts = Studio.tasks().filter(isPost), today = new Date(); today.setHours(0, 0, 0, 0);
    let h = '';
    for (let i = 0; i < 14; i++) {
      const d = new Date(today); d.setDate(d.getDate() + i); const k = Studio.dayKey(d);
      const items = posts.filter(t => t.date && Studio.dayKey(t.date) === k);
      const pending = items.filter(t => !t.done).length, done = items.length - pending;
      const dots = Array.from({ length: Studio.MAX_POSTS_PER_DAY }, (_, j) => `<i class="${j < done ? 'd-done' : j < items.length ? 'd-on' : ''}"></i>`).join('');
      h += `<button type="button" class="sch-day ${state.day === k ? 'active' : ''} ${i === 0 ? 'today' : ''}" data-day="${k}" aria-label="${d.toDateString()}, ${items.length} posts"><small>${i === 0 ? 'Today' : d.toLocaleDateString([], { weekday: 'short' })}</small><b>${d.getDate()}</b><span class="sch-dots">${dots}</span></button>`;
    }
    return `<div class="sch-strip" role="group" aria-label="Next 14 days">${h}</div>`;
  }

  function card(t) {
    const S = Studio.TASK_STATUS[t._st] || Studio.TASK_STATUS.draft;
    const hot = t._st === 'due' || t._st === 'overdue' || t._st === 'soon';
    const time = t.date ? new Date(t.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--';
    const epTag = t.storyTitle ? `<span class="sch-tag">📖 ${esc(t.storyTitle)} · S${String(t.seasonNumber || 1).padStart(2, '0')}E${String(t.episodeNumber || 0).padStart(2, '0')}</span>` : '<span class="sch-tag">📝 Custom post</span>';
    const a = (act, label, cls) => `<button type="button" class="button ${cls || 'ghost'} small-button" data-sact="${act}" data-id="${esc(t.id)}">${label}</button>`;
    let actions;
    if (t._st === 'posted') actions = a('undo', '↩︎ Undo posted') + a('del', 'Delete');
    else if (hot) actions = a('open', '📋 Copy & open channel', 'primary') + a('done', '✅ I’ve posted it') + a('resched', '🕒 Reschedule');
    else actions = a('open', '📋 Copy & open') + a('resched', '🕒 Reschedule') + a('ics', '⏰ Phone alarm') + a('del', 'Delete');
    return `<article class="sch-item st-${t._st} ${hot ? 'hot' : ''}"><div class="sch-time"><b>${esc(time)}</b><span class="chip tone-${S.tone}">${S.label}</span></div><div class="sch-body"><div class="sch-head">${avatar(t.channelUrl, t.channelName)}<div><h4>${esc(t.title || 'Planned post')}</h4><p class="small muted">${esc(t.channelName || 'No channel selected')} ${t.reminderMinutes ? '· 🔔 ' + t.reminderMinutes + ' min before' : ''}</p></div></div>${epTag}<div class="item-actions">${actions}</div></div></article>`;
  }

  function groupHeading(k) {
    const d = new Date(k + 'T00:00'), t = new Date(); t.setHours(0, 0, 0, 0);
    const diff = Math.round((d - t) / 864e5);
    const name = diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : diff === -1 ? 'Yesterday' : d.toLocaleDateString([], { weekday: 'long' });
    return `<div class="sch-day-head"><b>${name}</b><span class="muted small">${d.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}</span></div>`;
  }

  function render() {