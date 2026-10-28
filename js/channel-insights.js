/* Channel Studio v14 — channel profiles & insights.
   WhatsApp offers no public API that lets a web app read a Channel's followers or profile picture,
   so this page works with what you provide (picture, follower counts you record) and with what
   Channel Studio itself knows (posts you scheduled/published here). Nothing is scraped. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = s => Studio.esc(s);
  const ROLE = { my: 'My channel', source: 'Source / partner', other: 'Other' };
  let editingId = null, pendingAvatar = undefined;

  function channels() { return Studio.get('channels', []); }
  function save(list) { return Studio.set('channels', list); }
  function ensureIds() {
    const list = channels(); let dirty = false;
    list.forEach(c => { if (!c.id) { c.id = Studio.uid(); dirty = true; } if (!Array.isArray(c.followers)) { c.followers = []; dirty = true; } });
    if (dirty) save(list);
    return list;
  }
  const channelId = url => { const m = String(url || '').match(/channel\/([A-Za-z0-9_-]+)/); return m ? m[1] : ''; };

  function stats(c) {
    const posts = Studio.tasks().filter(t => (t.type || 'post') === 'post' && t.channelUrl && t.channelUrl === c.url);
    const done = posts.filter(t => t.done), now = Date.now();
    const last = done.map(t => new Date(t.completedAt || t.date).getTime()).filter(Number.isFinite).sort((a, b) => b - a)[0];
    const upcoming = posts.filter(t => !t.done && new Date(t.date).getTime() > now).length;
    const w4 = done.filter(t => now - new Date(t.completedAt || t.date).getTime() <= 28 * 864e5).length;
    return { done: done.length, last, upcoming, perWeek: w4 / 4 };
  }

  function growth(c) {
    const f = (c.followers || []).slice().sort((a, b) => new Date(a.t) - new Date(b.t));
    if (!f.length) return null;
    const latest = f[f.length - 1]; if (f.length < 2) return { latest, delta: null };
    const weekAgo = new Date(latest.t).getTime() - 7 * 864e5;
    const base = f.slice(0, -1).reverse().find(x => new Date(x.t).getTime() <= weekAgo) || f[f.length - 2];
    const days = Math.max(1, Math.round((new Date(latest.t) - new Date(base.t)) / 864e5));
    return { latest, delta: latest.n - base.n, days };
  }

  function spark(c) {
    const f = (c.followers || []).slice().sort((a, b) => new Date(a.t) - new Date(b.t)).slice(-12);
    if (f.length < 2) return '';
    const W = 220, H = 44, p = 4, min = Math.min(...f.map(x => x.n)), max = Math.max(...f.map(x => x.n)), span = Math.max(1, max - min);
    const pts = f.map((x, i) => [p + i * (W - 2 * p) / (f.length - 1), H - p - (x.n - min) / span * (H - 2 * p)]);
    const path = pts.map((q, i) => (i ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join(' ');
    return `<svg class="ch-spark" viewBox="0 0 ${W} ${H}" role="img" aria-label="Follower trend"><path d="${path} L${pts[pts.length - 1][0].toFixed(1)} ${H} L${pts[0][0].toFixed(1)} ${H} Z" class="ch-spark-fill"/><path d="${path}" class="ch-spark-line"/><circle cx="${pts[pts.length - 1][0].toFixed(1)}" cy="${pts[pts.length - 1][1].toFixed(1)}" r="3"/></svg>`;
  }

  function avatar(c, cls) {
    return c.avatar ? `<img class="${cls}" src="${esc(c.avatar)}" alt="${esc(c.name)} profile picture">` : `<span class="${cls} ${cls}-ini" aria-hidden="true">${esc(String(c.name || '#').trim().slice(0, 1).toUpperCase())}</span>`;
  }

  function insight(c, s, g) {
    const bits = [];
    if (s.done) bits.push(`${s.done} post${s.done === 1 ? '' : 's'} published through Channel Studio${s.perWeek >= .25 ? ` (about ${s.perWeek.toFixed(1)}/week lately)` : ''}`);
    if (s.upcoming) bits.push(`${s.upcoming} more scheduled`);
    if (g && g.delta != null) bits.push(`${g.delta >= 0 ? 'gained' : 'lost'} ${Math.abs(g.delta).toLocaleString()} follower${Math.abs(g.delta) === 1 ? '' : 's'} over ${g.days} day${g.days === 1 ? '' : 's'}`);
    if (c.avgViews && g && g.latest.n) bits.push(`~${Math.round(c.avgViews / g.latest.n * 100)}% of followers view a post`);
    return bits.length ? bits.join(' · ') + '.' : 'Record follower counts to see growth and trends here.';
  }

  function card(c) {
    const s = stats(c), g = growth(c), id = channelId(c.url);
    const gChip = g && g.delta != null ? `<span class="chip tone-${g.delta > 0 ? 'green' : g.delta < 0 ? 'red' : 'grey'}">${g.delta > 0 ? '▲' : g.delta < 0 ? '▼' : '■'} ${Math.abs(g.delta).toLocaleString()}</span>` : '';
    return `<article class="ch-card" data-id="${esc(c.id)}"><div class="ch-top"><button type="button" class="ch-av-btn" data-chact="picture" data-id="${esc(c.id)}" aria-label="Change profile picture">${avatar(c, 'ch-av')}<span class="ch-cam">📷</span></button><div class="ch-title"><h3>${esc(c.name)}</h3><span class="chip tone-${c.role === 'my' ? 'teal' : 'grey'}">${esc(ROLE[c.role] || 'Channel')}</span>${id ? `<span class="small muted ch-id">ID ${esc(id.slice(0, 8))}…</span>` : ''}</div></div>
      ${c.about ? `<p class="small ch-about">${esc(c.about)}</p>` : ''}
      <div class="ch-stats"><div><small>Followers</small><b>${g ? g.latest.n.toLocaleString() : '—'}</b>${gChip}</div><div><small>Posted here</small><b>${s.done}</b></div><div><small>Upcoming</small><b>${s.upcoming}</b></div><div><small>Last post</small><b>${s.last ? new Date(s.last).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '—'}</b></div></div>
      ${spark(c)}<p class="small muted ch-insight">${esc(insight(c, s, g))}</p>