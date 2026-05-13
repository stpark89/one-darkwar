-- =============================================
-- ONE DARK WAR — 전체 스키마 (초기 설치용)
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

-- ATTENDANCE (CT/DB 상태만 저장, 불참은 row 없음)
create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  status text not null check (status in ('CT', 'DB')),
  unique(member_id, event_id)
);

-- SEASONS
create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

-- WAR ROUNDS (ĐỢT)
create table public.war_rounds (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  sort_order integer not null default 0,
  round_date date,
  created_at timestamptz not null default now()
);

-- WAR ENTRIES (멤버별 회차 참가 기록)
create table public.war_entries (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.war_rounds(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  team text not null default '' check (team in ('A', 'B', '')),
  role text not null default '' check (role in ('CT', 'DB', '')),
  unique(round_id, member_id)
);

-- =============================================
-- RLS (인증 추가 전까지 전체 허용)
-- =============================================
alter table public.members enable row level security;
alter table public.events enable row level security;
alter table public.attendance enable row level security;
alter table public.seasons enable row level security;
alter table public.war_rounds enable row level security;
alter table public.war_entries enable row level security;

create policy "public access" on public.members for all using (true) with check (true);
create policy "public access" on public.events for all using (true) with check (true);
create policy "public access" on public.attendance for all using (true) with check (true);
create policy "public access" on public.seasons for all using (true) with check (true);
create policy "public access" on public.war_rounds for all using (true) with check (true);
create policy "public access" on public.war_entries for all using (true) with check (true);
