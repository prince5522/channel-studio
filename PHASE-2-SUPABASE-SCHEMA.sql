-- Channel Studio: run this in Supabase SQL Editor.
-- This schema is for System B (ready-made episodes). Anonymous Auth users are in the authenticated role.
-- Never disable RLS or add a public write policy.
create table if not exists public.episodes (
  id text primary key,
  author_id uuid not null references auth.users(id) on delete cascade,
  season_number integer not null check (season_number > 0),
  episode_number integer not null check (episode_number > 0),
  episode_name text not null default '',
  episode_subtitle text not null default '',
  episode_text text not null,
  word_count integer not null default 0 check (word_count >= 0),
  reading_time_min integer not null default 0 check (reading_time_min >= 0),
  content_rating text not null default 'general' check (content_rating in ('general','18+')),
  source text not null default 'manual_ready_made' check (source in ('auto_split','manual_ready_made')),
  scheduled_post_at timestamptz,
  reminder_enabled boolean not null default false,
  reminder_channel_push boolean not null default true,
  reminder_channel_in_app boolean not null default true,
  reminder_channel_whatsapp_sms boolean not null default false,
  reminder_type text not null default 'one_off' check (reminder_type in ('one_off','recurring','smart_cadence')),
  status text not null default 'draft' check (status in ('draft','scheduled','posted')),
  posted_at timestamptz,
  author_approved boolean not null default false,
  auto_post_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.episodes enable row level security;

-- Policies are scoped to the currently authenticated anonymous/user identity.
drop policy if exists "authors manage their episodes" on public.episodes;
drop policy if exists "each owner manages own episodes" on public.episodes;
create policy "each owner manages own episodes"
  on public.episodes for all to authenticated
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

grant select, insert, update, delete on public.episodes to authenticated;
revoke all on public.episodes from anon;
