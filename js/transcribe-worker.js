/* Channel Studio v14 — on-device speech-to-text worker (Whisper via Transformers.js).
   Needs internet the first time to download the model; the browser caches it afterwards.
   Audio never leaves the device. */
import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';

env.allowLocalModels = false;
let asr = null, loadedModel = '';

self.onmessage = async (e) => {
  const msg = e.data || {};
  if (msg.type !== 'run') return;
  try {
    if (!asr || loadedModel !== msg.model) {
      self.postMessage({ type: 'status', text: 'Downloading the speech model (first time only)…' });
      asr = await pipeline('automatic-speech-recognition', msg.model, {
        progress_callback: p => self.postMessage({ type: 'download', progress: p })
      });
      loadedModel = msg.model;
    }
    self.postMessage({ type: 'status', text: 'Transcribing… this can take a few minutes for long videos.' });
    const opts = { chunk_length_s: 30, stride_length_s: 5, return_timestamps: true };
    if (!/\.en$/.test(msg.model)) { opts.task = 'transcribe'; if (msg.language && msg.language !== 'auto') opts.language = msg.language; }
    const out = await asr(msg.audio, opts);
    self.postMessage({ type: 'done', text: out.text || '', chunks: out.chunks || [] });
  } catch (err) {
    self.postMessage({ type: 'error', message: String((err && err.message) || err) });
  }
};
