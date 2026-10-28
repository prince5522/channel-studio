/* Channel Studio v14 — Episode Workflow board.
   Stages: Edit → Ready to Post → Scheduled → Posted. Folders: Story → Season. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const E = s => Studio.esc(s);
  const STAGE_ORDER = ['ready', 'edit', 'scheduled', 'posted'];
  const state = { stage: 'ready', q: '', story: 'all', closed: new Set(), dialogEp: null, bulk: null };

  function counts(eps) { const c = { all: eps.length, edit: 0, ready: 0, scheduled: 0, posted: 0 }; eps.forEach(e => c[e.stage]++); return c; }

  function chip(stage) { const s = Studio.STAGES[stage]; return `<span class="chip tone-${s.tone}">${s.icon} ${s.label}</span>`; }

  function renderTabs(eps) {
    const c = counts(eps);
    $('wfTabs').innerHTML = STAGE_ORDER.map(k => `<button type="button" class="wf-tab tone-${Studio.STAGES[k].tone} ${state.stage === k ? 'active' : ''}" data-stage="${k}" role="tab" aria-selected="${state.stage === k}"><span>${Studio.STAGES[k].icon}</span><b>${Studio.STAGES[k].label}</b><i>${c[k]}</i></button>`).join('') +
      `<button type="button" class="wf-tab ${state.stage === 'all' ? 'active' : ''}" data-stage="all" role="tab" aria-selected="${state.stage === 'all'}"><span>🗂️</span><b>All</b><i>${c.all}</i></button>`;
  }

  function renderStoryFilter(sr) {
    const sel = $('wfStory'), cur = state.story;
    sel.innerHTML = '<option value="all">All stories</option>' + sr.map(s => `<option value="${E(s.key)}">${E(s.title)}</option>`).join('');
    sel.value = [...sel.options].some(o => o.value === cur) ? cur : 'all';
    state.story = sel.value;
  }

  function matches(ep) {
    if (state.stage !== 'all' && ep.stage !== state.stage) return false;
    if (state.q) { const q = state.q; if (![ep.title, ep.storyTitle, ep.text.slice(0, 4000)].some(v => String(v).toLowerCase().includes(q))) return false; }
    return true;
  }

  function taskFor(ep) { return ep.taskId ? Studio.tasks().find(t => String(t.id) === String(ep.taskId)) : null; }

  function epCard(ep) {
    const t = ep.stage === 'scheduled' ? taskFor(ep) : null;
    const st = t ? Studio.taskStatus(t) : null;
    const when = t ? `<p class="wf-when ${st === 'due' || st === 'overdue' ? 'hot' : ''}">🗓️ ${E(Studio.fmtWhen(t.date))}${t.channelName ? ' · ' + E(t.channelName) : ''}${st === 'due' ? ' · <b>due now</b>' : st === 'overdue' ? ' · <b>overdue</b>' : ''}</p>` : (ep.stage === 'posted' && ep.postedAt ? `<p class="wf-when">📣 Posted ${E(new Date(ep.postedAt).toLocaleString())}</p>` : '');
    const a = (act, label, cls) => `<button type="button" class="button ${cls || 'ghost'} small-button" data-act="${act}" data-key="${E(ep.key)}">${label}</button>`;
    let actions = '';
    if (ep.stage === 'edit') actions = a('edit', '✏️ Edit text') + a('ready', '✅ Mark ready', 'primary');
    else if (ep.stage === 'ready') actions = a('schedule', '🗓️ Schedule', 'primary') + a('copy', '📋 Copy') + a('post', '📣 Mark posted') + a('edit', '✏️ Edit') ;
    else if (ep.stage === 'scheduled') actions = a('open', '📋 Copy & open channel', 'primary') + a('post', '📣 Mark posted') + a('resched', '🕒 Reschedule') + a('unsched', 'Unschedule');
    else actions = a('read', '📖 Read') + a('undo', '↩︎ Undo posted');
    if (ep.stage === 'ready') actions += a('backedit', '↩︎ Back to Edit');
    return `<article class="wf-ep stage-${ep.stage}"><div class="wf-ep-no">E${String(ep.number).padStart(2, '0')}</div><div class="wf-ep-main"><div class="wf-ep-top"><h4>${E(ep.title)}</h4>${chip(ep.stage)}</div>${ep.subtitle ? `<p class="small muted">${E(ep.subtitle)}</p>` : ''}<p class="small muted">${ep.words.toLocaleString()} words · ${(ep.words / 220).toFixed(1)} min read${ep.src === 'ready' ? ' · ready-made' : ''}</p>${when}<p class="wf-excerpt">${E(ep.text.slice(0, 150))}${ep.text.length > 150 ? '…' : ''}</p><div class="item-actions">${actions}</div></div></article>`;
  }

  function seasonActions(se) {
    const ready = se.eps.filter(e => e.stage === 'ready'), edit = se.eps.filter(e => e.stage === 'edit');
    let h = '';
    if (state.stage === 'edit' && edit.length) h += `<button type="button" class="button ghost small-button" data-sact="allready" data-s="${E(se.sk)}">✅ Mark all ${edit.length} ready</button>`;
    if ((state.stage === 'ready' || state.stage === 'all') && ready.length) h += `<button type="button" class="button primary small-button" data-sact="bulk" data-s="${E(se.sk)}">🗓️ Schedule ${ready.length} ready…</button>`;
    return h ? `<div class="wf-season-actions">${h}</div>` : '';
  }

  function render() {
    const all = Studio.episodes();
    const sr = Studio.series();
    renderTabs(all); renderStoryFilter(sr);
    const tree = $('wfTree');
    if (!all.length) { tree.innerHTML = '<div class="empty-state">No episodes yet. <a class="text-link" href="stories.html">Import a story</a> and split it in <a class="text-link" href="episodes.html">Episodes</a>, or add finished episodes in <a class="text-link" href="ready-made.html">Ready-Made</a>.</div>'; return; }
    let html = '', shown = 0;
    sr.filter(s => state.story === 'all' || s.key === state.story).forEach(st => {
      let seasonHtml = '';
      st.seasons.forEach(se => {
        se.sk = st.key + '#' + se.number;
        const vis = se.eps.filter(matches);
        if (!vis.length) return;