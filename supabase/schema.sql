-- =============================================
-- ONE DARK WAR — Supabase Schema
-- Supabase SQL Editor 에서 전체 실행하세요
-- =============================================

-- MEMBERS
create table public.members (
  id uuid primary key default gen_random_uuid(),
  in_game_name text not null,
  zalo_name text not null default '',
  cp text not null default '',
  house_level text not null default '',
  note text not null default '',
  created_at timestamptz not null default now()
);

-- EVENTS
create table public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  event_date date,
  created_at timestamptz not null default now()
);

-- ATTENDANCE (CT/DB 상태인 것만 저장, 불참은 row 없음)
create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  status text not null check (status in ('CT', 'DB')),
  unique(member_id, event_id)
);

-- WAR PARTICIPANTS
create table public.war_participants (
  id uuid primary key default gen_random_uuid(),
  in_game_name text not null,
  zalo_name text not null default '',
  cp text not null default '',
  r1_team text not null default '',
  r1_role text not null default '',
  r1_note text not null default '',
  r2_team text not null default '',
  r2_role text not null default '',
  r2_note text not null default '',
  r3_team text not null default '',
  r3_role text not null default '',
  r3_note text not null default '',
  r4_team text not null default '',
  r4_role text not null default '',
  r4_note text not null default '',
  created_at timestamptz not null default now()
);

-- =============================================
-- RLS (인증 추가 전까지 전체 허용)
-- =============================================
alter table public.members enable row level security;
alter table public.events enable row level security;
alter table public.attendance enable row level security;
alter table public.war_participants enable row level security;

create policy "public access" on public.members for all using (true) with check (true);
create policy "public access" on public.events for all using (true) with check (true);
create policy "public access" on public.attendance for all using (true) with check (true);
create policy "public access" on public.war_participants for all using (true) with check (true);
