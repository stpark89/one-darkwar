-- =============================================
-- WAR 구조 개편 마이그레이션
-- Supabase SQL Editor 에서 실행하세요
-- =============================================

-- 기존 테이블 제거
drop table if exists public.war_participants;

-- 시즌
create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

-- 회차 (ĐỢT)
create table public.war_rounds (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  sort_order integer not null default 0,
  round_date date,
  created_at timestamptz not null default now()
);

-- 멤버별 회차 참가 기록
create table public.war_entries (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.war_rounds(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  team text not null default '' check (team in ('A', 'B', '')),
  role text not null default '' check (role in ('CT', 'DB', '')),
  unique(round_id, member_id)
);

-- RLS
alter table public.seasons enable row level security;
alter table public.war_rounds enable row level security;
alter table public.war_entries enable row level security;

create policy "public access" on public.seasons for all using (true) with check (true);
create policy "public access" on public.war_rounds for all using (true) with check (true);
create policy "public access" on public.war_entries for all using (true) with check (true);
