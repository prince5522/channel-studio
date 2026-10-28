/* Channel Studio v14 — shared core.
   One place for: episode workflow stages, scheduled-post status, series progress,
   alert generation and calendar (.ics) export. Every new page uses window.Studio. */
(function () {
  'use strict';
  const S = () => window.StudioStore;
  const get = (k, d) => { try { const v = S().get(k, d); return v === undefined || v === null ? d : v; } catch (e) { return d; } };
  const set = (k, v) => { try { return S().set(k, v); } catch (e) { return false; } };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  const norm = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const wordCount = t => (String(t || '').match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) || []).length;
  const MAX_POSTS_PER_DAY = 4;

  /* ---------- Workflow stages ---------- */
  const STAGES = {
    edit:      { label: 'Edit',          icon: '✏️', tone: 'amber' },
    ready:     { label: 'Ready to Post', icon: '✅', tone: 'teal' },
    scheduled: { label: 'Scheduled',     icon: '🗓️', tone: 'blue' },
    posted:    { label: 'Posted',        icon: '📣', tone: 'green' }
  };
  const meta = () => { const m = get('episodeMeta', {}); return m && typeof m === 'object' && !Array.isArray(m) ? m : {}; };
  const saveMeta = m => set('episodeMeta', m);

  function episodes() {
    const m = meta(), out = [];
    get('episodes', []).forEach((e, i) => {
      if (!e) return;
      const id = e.id || ('legacy' + i), key = 'auto:' + id, mm = m[key] || {};
      const storyTitle = e.storyTitle || e.seasonTitle || 'Untitled story';
      out.push({
        key, src: 'auto', id, index: i, storyTitle, storyKey: norm(storyTitle),
        season: Number(e.seasonNumber) || 1, number: Number(e.episodeNumber) || (i + 1),
        title: e.title || `${storyTitle} — Episode ${e.episodeNumber || i + 1}`,
        text: String(e.content || ''), words: e.wordCount || wordCount(e.content),
        stage: STAGES[mm.stage] ? mm.stage : 'edit', taskId: mm.taskId || '', postedAt: mm.postedAt || ''
      });
    });
    get('readyMadeEpisodes', []).forEach((e, i) => {
      if (!e) return;
      const id = e.id || ('rm' + i), key = 'ready:' + id, mm = m[key] || {};
      const storyTitle = e.story_title || 'Ready-Made Episodes';
      let stage = STAGES[mm.stage] ? mm.stage : (e.status === 'posted' ? 'posted' : e.status === 'scheduled' ? 'scheduled' : 'ready');
      if (e.status === 'posted') stage = 'posted';
      out.push({
        key, src: 'ready', id, index: i, storyTitle, storyKey: norm(storyTitle),
        season: Number(e.season_number) || 1, number: Number(e.episode_number) || (i + 1),
        title: e.episode_name || `Episode ${e.episode_number || i + 1}`,
        subtitle: e.episode_subtitle || '',
        text: String(e.episode_text || ''), words: e.word_count || wordCount(e.episode_text),
        stage, taskId: mm.taskId || '', postedAt: mm.postedAt || e.posted_at || ''
      });
    });
    return out;
  }
  function setMeta(key, patch) { const m = meta(); m[key] = Object.assign({}, m[key] || {}, patch); return saveMeta(m); }
  function setStage(key, stage, extra) { return setMeta(key, Object.assign({ stage }, extra || {})); }

  function updateText(ep, text) {
    const w = wordCount(text);
    if (ep.src === 'auto') {
      const all = get('episodes', []), i = all.findIndex((x, ix) => (x.id || ('legacy' + ix)) === ep.id);
      if (i < 0) return false;
      all[i].content = text; all[i].wordCount = w; all[i].readTime = (w / 220).toFixed(2);
      return set('episodes', all);
    }
    const all = get('readyMadeEpisodes', []), i = all.findIndex((x, ix) => (x.id || ('rm' + ix)) === ep.id);
    if (i < 0) return false;
    all[i].episode_text = text; all[i].word_count = w; all[i].reading_time_min = Math.max(1, Math.round(w / 220));