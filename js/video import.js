/* Channel Studio v14 — Video Import.
   A video file cannot be split into story episodes: there is no text to split. This page gets the
   words first (on-device transcription, a subtitle/transcript file, or pasted text), lets you review
   and correct them, and only then saves a season that the Episode splitter can work on. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = s => Studio.esc(s);
  const MAX_BYTES = 400 * 1024 * 1024, MAX_MINUTES = 60;
  let file = null, worker = null, chunks = [], duration = 0, lastObjectUrl = '';

  /* ---------- transcript helpers ---------- */
  function parseSubtitles(raw) {
    const lines = String(raw).replace(/\r/g, '').split('\n'), out = [];
    for (let l of lines) {
      l = l.trim();
      if (!l || /^WEBVTT/i.test(l) || /^NOTE\b/.test(l) || /^\d+$/.test(l)) continue;
      if (/-->/.test(l)) continue;
      l = l.replace(/<[^>]+>/g, '').replace(/\{\\[^}]*\}/g, '').replace(/^[-–]\s+/, '').trim();
      if (!l || out[out.length - 1] === l) continue;
      out.push(l);
    }
    return out.join(' ');
  }
  function looksSubtitle(raw) { return /-->/.test(raw) && /\d{1,2}:\d{2}/.test(raw); }
  function paragraphize(text, perPara) {
    const flat = String(text).replace(/\s+/g, ' ').trim(); if (!flat) return '';
    const sentences = flat.split(/(?<=[.!?…])\s+(?=[\p{Lu}"“'‘(\d])/u), paras = []; let cur = [];
    sentences.forEach(s => { cur.push(s); if (cur.length >= (perPara || 4)) { paras.push(cur.join(' ')); cur = []; } });
    if (cur.length) paras.push(cur.join(' '));
    return paras.join('\n\n');
  }
  function fromChunks(cs, fallback) {
    if (!cs || !cs.length) return paragraphize(fallback, 4);
    let out = '', prevEnd = null;
    cs.forEach(c => {
      const t = String(c.text || '').trim(); if (!t) return;
      const start = c.timestamp && c.timestamp[0], end = c.timestamp && c.timestamp[1];
      if (out) out += (prevEnd != null && start != null && start - prevEnd > 1.8) ? '\n\n' : ' ';
      out += t; prevEnd = end != null ? end : prevEnd;
    });
    return /\n\n/.test(out) ? out : paragraphize(out, 4);
  }

  /* ---------- UI state ---------- */
  function updateCount() {
    const w = Studio.wordCount($('viText').value);
    $('viCount').textContent = `${w.toLocaleString()} words · about ${Math.max(1, Math.round(w / 275))} episode${Math.round(w / 275) <= 1 ? '' : 's'} at 250–300 words`;
    const ok = w >= 30;
    $('viSave').disabled = !ok;
    $('viGate').textContent = ok ? '' : 'Add a transcript of at least 30 words to continue — a video alone can’t be split into episodes.';
  }
  function setFile(f, fromShare) {
    file = f; chunks = [];
    if (lastObjectUrl) URL.revokeObjectURL(lastObjectUrl);
    if (!f) { $('viPreviewWrap').hidden = true; return; }
    const isAudioVideo = /^(video|audio)\//.test(f.type) || /\.(mp4|mov|m4v|webm|mkv|3gp|mp3|m4a|wav|ogg|opus|aac)$/i.test(f.name);
    if (!isAudioVideo) { Studio.toast('That doesn’t look like a video or audio file. Use “Import a transcript file” for .srt, .vtt or .txt.'); file = null; return; }
    lastObjectUrl = URL.createObjectURL(f);
    const v = $('viPlayer'); v.src = lastObjectUrl; $('viPreviewWrap').hidden = false;
    $('viInfo').textContent = `${f.name} · ${(f.size / 1048576).toFixed(1)} MB`;
    v.onloadedmetadata = () => { duration = v.duration || 0; $('viInfo').textContent = `${f.name} · ${(f.size / 1048576).toFixed(1)} MB · ${Math.floor(duration / 60)}:${String(Math.floor(duration % 60)).padStart(2, '0')}`; if (duration / 60 > MAX_MINUTES) warnLong(); };
    if (!$('viTitle').value.trim()) $('viTitle').value = f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
    if (fromShare) $('viShared').hidden = false;
    $('viRun').disabled = false;
  }
  function warnLong() { $('viStatus').textContent = `This is longer than ${MAX_MINUTES} minutes. On-device transcription may run out of memory — consider importing a transcript or subtitle file instead.`; }

  /* ---------- audio extraction ---------- */