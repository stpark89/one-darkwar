-- =============================================
-- 점령 순번 — 주차 날짜 (week_date)
--
-- 주차(8슬롯 한 줄)마다 날짜를 표시하기 위해 각 순번 행에 날짜를 둔다.
-- 같은 주차의 행들은 같은 날짜를 갖는다(주차 단위로 일괄 지정).
-- 기존 행은 NULL — 화면에 「—」로 보이고 관리자가 지정한다.
--
-- Supabase Dashboard → SQL Editor 에서 실행 필요
-- =============================================

ALTER TABLE public.occupation_turns
  ADD COLUMN IF NOT EXISTS week_date date;
