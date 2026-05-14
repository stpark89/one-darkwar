-- =============================================
-- ONE DARK WAR — 인증 스키마
-- Supabase SQL Editor 에서 실행하세요
-- =============================================

-- PROFILES (auth.users 와 1:1 연결)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  in_game_name text not null,
  role text not null default 'ROLE_USER' check (role in ('ROLE_USER', 'ROLE_ADMIN')),
  created_at timestamptz not null default now()
);

-- RLS
alter table public.profiles enable row level security;

-- 모든 유저가 프로필 조회 가능
create policy "profiles select" on public.profiles for select using (true);

-- 본인 프로필만 삽입 가능
create policy "profiles insert own" on public.profiles for insert with check (auth.uid() = id);

-- 본인 프로필만 수정 가능 (role 변경은 서비스 키로만 가능)
create policy "profiles update own" on public.profiles for update using (auth.uid() = id);

-- =============================================
-- 참고: Supabase 대시보드에서 아래 설정 필요
-- Authentication > Email > Confirm email: OFF (개발 편의)
-- =============================================
