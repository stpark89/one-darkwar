-- =============================================
-- 멤버 병종(troop_type) 컬럼 추가
--
-- 파이터(fighter) / 슈터(shooter) / 라이더(rider) 중 하나. 빈 문자열 = 미지정.
-- 표시 라벨은 앱에서 다국어(i18n)로 처리하므로 DB 에는 코드값만 저장.
--
-- Supabase Dashboard → SQL Editor 에서 실행 필요
-- =============================================

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS troop_type text NOT NULL DEFAULT '';
