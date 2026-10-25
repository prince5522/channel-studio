/* Channel Studio cloud sync: Supabase Auth anonymous session + owner-scoped RLS.
   This file contains only the project URL and publishable key, which are intended for browser apps.
   Never place a Supabase secret/service_role key in this file. */
(function () {
  'use strict';
  const PROJECT_URL = 'https://fkyihttehxinegibcwws.supabase.co';
  const PUBLISHABLE_KEY = 'sb_publishable_N54NlBxYHQgpiKr7oy2oRQ_yfe_E1dV';
  const statusEl = () => document.getElementById('cloudStatus');
  function status(text, online) {
    const el = statusEl();
    if (el) { el.textContent = text; el.dataset.online = online ? 'true' : 'false'; }
  }
  const originalSet = window.StudioStore.set.bind(window.StudioStore);
  let client = null, ownerId = null, initialized = false, queue = Promise.resolve();
  function toRow(ep) {
    return {
      id: String(ep.id), author_id: ownerId,
      season_number: Number(ep.season_number) || 1,
      episode_number: Number(ep.episode_number) || 1,
      episode_name: String(ep.episode_name || ''),
      episode_subtitle: String(ep.episode_subtitle || ''),
      episode_text: String(ep.episode_text || ''),
      word_count: Number(ep.word_count) || 0,
      reading_time_min: Number(ep.reading_time_min) || 0,
      content_rating: ep.content_rating === '18+' ? '18+' : 'general',
      source: 'manual_ready_made',
      scheduled_post_at: ep.scheduled_post_at || null,
      reminder_enabled: !!ep.reminder_enabled,
      reminder_channel_push: ep.reminder_channel ? ep.reminder_channel.push !== false : true,
      reminder_channel_in_app: ep.reminder_channel ? ep.reminder_channel.in_app !== false : true,
      reminder_channel_whatsapp_sms: !!(ep.reminder_channel && ep.reminder_channel.whatsapp_sms),
      reminder_type: ['one_off','recurring','smart_cadence'].includes(ep.reminder_type) ? ep.reminder_type : 'one_off',
      status: ['draft','scheduled','posted'].includes(ep.status) ? ep.status : 'draft',
      posted_at: ep.posted_at || null,
      author_approved: !!ep.author_approved,
      auto_post_enabled: false,
      created_at: ep.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }
  function fromRow(row) {
    return {
      id: row.id, season_number: row.season_number, episode_number: row.episode_number,
      episode_name: row.episode_name || '', episode_subtitle: row.episode_subtitle || '',
      episode_text: row.episode_text || '', word_count: row.word_count || 0,
      reading_time_min: row.reading_time_min || 0, content_rating: row.content_rating || 'general',
      source: 'manual_ready_made', scheduled_post_at: row.scheduled_post_at || null,
      reminder_enabled: !!row.reminder_enabled,
      reminder_channel: {push: row.reminder_channel_push !== false, in_app: row.reminder_channel_in_app !== false, whatsapp_sms: !!row.reminder_channel_whatsapp_sms},
      reminder_type: row.reminder_type || 'one_off', status: row.status || 'draft',
      posted_at: row.posted_at || null, author_approved: !!row.author_approved,
      auto_post_enabled: false, reminder_sent_at: null, created_at: row.created_at || new Date().toISOString()
    };
  }
  async function syncChanges(before, after) {
    if (!initialized || !client || !ownerId) return;
    const oldItems = Array.isArray(before) ? before : [];
    const newItems = Array.isArray(after) ? after : [];
    const newIds = new Set(newItems.map(x => String(x.id)));
    const removed = oldItems.map(x => String(x.id)).filter(id => !newIds.has(id));
    try {
      if (newItems.length) {
        const { error } = await client.from('episodes').upsert(newItems.map(toRow), { onConflict: 'id' });
        if (error) throw error;
      }
      if (removed.length) {
        const { error } = await client.from('episodes').delete().eq('author_id', ownerId).in('id', removed);
        if (error) throw error;
      }
      status('Cloud synced ✓', true);
    } catch (e) {
      console.error('Channel Studio cloud save failed:', e);
      status('Cloud save failed · local copy kept', false);
      window.dispatchEvent(new CustomEvent('channelstudio:cloud-error', {detail: String(e.message || e)}));
    }
  }
  window.StudioStore.set = function (key, value) {
    const before = key === 'readyMadeEpisodes' ? window.StudioStore.get(key, []) : null;
    const ok = originalSet(key, value);
    if (key === 'readyMadeEpisodes' && Array.isArray(value)) {
      queue = queue.then(() => syncChanges(before, value));
    }
    return ok;
  };
  async function init() {
    status('Connecting to Supabase…', false);
    if (!window.supabase || !window.supabase.createClient) {
      status('Cloud library unavailable · local mode', false); return {online:false};
    }
    try {
      client = window.supabase.createClient(PROJECT_URL, PUBLISHABLE_KEY, {
        auth: {persistSession:true, autoRefreshToken:true, detectSessionInUrl:false}
      });
      let {data:{session}, error:sessionError} = await client.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session) {
        const result = await client.auth.signInAnonymously();
        if (result.error) throw result.error;
        session = result.data.session;
      }
      ownerId = session && session.user ? session.user.id : null;
      if (!ownerId) throw new Error('Supabase did not return a user identity.');
      const {data, error} = await client.from('episodes').select('*').eq('author_id', ownerId).order('season_number').order('episode_number');
      if (error) throw error;
      const local = window.StudioStore.get('readyMadeEpisodes', []);
      if (data && data.length) {
        const cloudItems = data.map(fromRow);
        const cloudIds = new Set(cloudItems.map(x => String(x.id)));
        const localOnly = (Array.isArray(local) ? local : []).filter(x => !cloudIds.has(String(x.id)));
        const merged = cloudItems.concat(localOnly);
        originalSet('readyMadeEpisodes', merged);
        if (localOnly.length) {
          const {error:uploadError} = await client.from('episodes').upsert(localOnly.map(toRow), {onConflict:'id'});
          if (uploadError) throw uploadError;
        }
      } else if (Array.isArray(local) && local.length) {
        const {error:uploadError} = await client.from('episodes').upsert(local.map(toRow), {onConflict:'id'});
        if (uploadError) throw uploadError;
      }
      initialized = true;
      status('Cloud connected ✓', true);
      window.dispatchEvent(new CustomEvent('channelstudio:cloud-ready'));
      return {online:true, userId:ownerId};
    } catch (e) {
      console.error('Channel Studio Supabase setup failed:', e);
      status('Cloud setup needed · local copy kept', false);
      window.dispatchEvent(new CustomEvent('channelstudio:cloud-error', {detail:String(e.message || e)}));
      return {online:false, error:String(e.message || e)};
    }
  }
  window.ChannelStudioCloud = {ready: init(), getClient:()=>client};
})();
