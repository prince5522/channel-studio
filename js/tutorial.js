/* Channel Studio v14 — guided tour. Works on any page because every page has the same sidebar.
   Start it from the sidebar (“Tutorial”), Settings, the welcome screen (?tour=1) or the first-run prompt on Home. */
(function () {
  'use strict';
  const STEPS = [
    { title: 'Welcome to Channel Studio ✨', text: 'A one-minute tour of how a story goes from a file to a finished, scheduled series. You can replay it any time from the sidebar.' },
    { sel: 'a[href="stories.html"]', title: '1 · Stories', text: 'Import a PDF or text (or paste it). Seasons with the same title are grouped together, with their seasons listed underneath.' },
    { sel: 'a[href="video.html"]', title: '2 · Video Import', text: 'Got a forwarded video? A video can’t be split into episodes on its own — first get its words: transcribe on your device, import subtitles, or paste a transcript. Then review and save it as a season.' },
    { sel: 'a[href="episodes.html"]', title: '3 · Episodes', text: 'Split a season into 250–300-word episodes at natural breaks. The app checks that no text is lost, and fills folders of up to 13 episodes per season.' },
    { sel: 'a[href="workflow.html"]', title: '4 · Workflow', text: 'Move each episode through Edit → Ready to Post → Scheduled → Posted. Folders are organised by story, then season, with completed and remaining counts.' },
    { sel: 'a[href="schedule.html"]', title: '5 · Schedule', text: 'A clean agenda with clear status badges: Scheduled, Due soon, Due now, Overdue, Posted. When a post is due, copy it and open your channel in one tap.' },
    { sel: 'a[href="planner.html"]', title: '6 · Planner', text: 'Plan a custom post that isn’t an episode. Up to 4 posts per day.' },
    { sel: 'a[href="notifications.html"]', title: '7 · Alerts', text: 'See due posts, posting progress, and warnings when a season is nearly finished or your schedule is running low. It also shows honestly what your device can and can’t do while the app is closed — and exports phone-calendar alarms for reliable reminders.' },
    { sel: 'a[href="channels.html"]', title: '8 · Channels', text: 'Add a profile picture and record follower counts to see growth over time. WhatsApp doesn’t let apps read these automatically, so you enter them — Channel Studio adds its own posting stats.' },
    { sel: 'a[href="backup.html"]', title: '9 · Backup', text: 'Everything is stored on this device. Export a backup regularly, especially before clearing browser data or changing phones.' },
    { title: 'You’re set 🎉', text: 'Posting itself always happens in WhatsApp — Channel Studio gets everything ready and reminds you. Replay this tour from the sidebar whenever you like.' }
  ];
  let i = 0, ui = null, openedSidebar = false;

  const isMobile = () => window.matchMedia && matchMedia('(max-width: 900px)').matches;
  const side = () => document.querySelector('.sidebar');

  function build() {
    ui = document.createElement('div'); ui.className = 'tour'; ui.setAttribute('role', 'dialog'); ui.setAttribute('aria-modal', 'true'); ui.setAttribute('aria-labelledby', 'tourTitle');
    ui.innerHTML = '<div class="tour-spot" id="tourSpot"></div><div class="tour-card" id="tourCard"><p class="eyebrow" id="tourStep"></p><h3 id="tourTitle"></h3><p id="tourText"></p><div class="tour-dots" id="tourDots"></div><div class="tour-actions"><button type="button" class="button ghost small-button" id="tourSkip">Skip</button><span></span><button type="button" class="button ghost small-button" id="tourBack">Back</button><button type="button" class="button primary small-button" id="tourNext">Next</button></div></div>';
    document.body.appendChild(ui);
    ui.querySelector('#tourSkip').onclick = () => end(true);
    ui.querySelector('#tourBack').onclick = () => go(i - 1);
    ui.querySelector('#tourNext').onclick = () => (i >= STEPS.length - 1 ? end(true) : go(i + 1));
    ui.addEventListener('click', e => { if (e.target === ui) end(false); });
    window.addEventListener('resize', place); window.addEventListener('keydown', key);
  }
  function key(e) { if (!ui) return; if (e.key === 'Escape') end(false); else if (e.key === 'ArrowRight') (i < STEPS.length - 1) && go(i + 1); else if (e.key === 'ArrowLeft') go(i - 1); }

  function go(n) {
    i = Math.max(0, Math.min(STEPS.length - 1, n));
    const s = STEPS[i], target = s.sel ? document.querySelector(s.sel) : null;
    if (target && target.closest('.sidebar') && isMobile() && side() && !side().classList.contains('open')) { side().classList.add('open'); openedSidebar = true; }
    if (!target && openedSidebar && side()) { side().classList.remove('open'); openedSidebar = false; }
    $('tourStep').textContent = `STEP ${i + 1} OF ${STEPS.length}`; $('tourTitle').textContent = s.title; $('tourText').textContent = s.text;
    $('tourBack').style.visibility = i === 0 ? 'hidden' : 'visible'; $('tourNext').textContent = i === STEPS.length - 1 ? 'Finish' : 'Next';
    $('tourDots').innerHTML = STEPS.map((_, k) => `<i class="${k === i ? 'on' : k < i ? 'done' : ''}"></i>`).join('');
    if (target && target.scrollIntoView) target.scrollIntoView({ block: 'nearest' });
    setTimeout(place, 60); $('tourNext').focus({ preventScroll: true });
  }
  const $ = id => document.getElementById(id);

  function place() {
    if (!ui) return;
    const s = STEPS[i], target = s.sel ? document.querySelector(s.sel) : null, spot = $('tourSpot'), card = $('tourCard');
    card.style.cssText = '';
    if (!target) { spot.style.cssText = 'left:50%;top:50%;width:0;height:0'; card.classList.add('center'); return; }
    card.classList.remove('center');
    const r = target.getBoundingClientRect(), pad = 6;
    spot.style.cssText = `left:${r.left - pad}px;top:${r.top - pad}px;width:${r.width + pad * 2}px;height:${r.height + pad * 2}px`;
    if (isMobile()) { card.style.cssText = 'left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));top:auto'; return; }
    const cw = Math.min(360, innerWidth - 24); let left = r.right + 20, top = r.top - 10;
    if (left + cw > innerWidth - 12) left = Math.max(12, r.left - cw - 20);
    top = Math.max(12, Math.min(top, innerHeight - card.offsetHeight - 12));
    card.style.cssText = `left:${left}px;top:${top}px;width:${cw}px`;
  }

  function end(done) {
    if (!ui) return;
    if (openedSidebar && side()) side().classList.remove('open'); openedSidebar = false;
    window.removeEventListener('resize', place); window.removeEventListener('keydown', key);
    ui.remove(); ui = null;
    if (done && window.Studio) Studio.set('tutorialDone', true);
  }
