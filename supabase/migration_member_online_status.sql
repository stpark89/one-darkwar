-- =============================================
-- 멤버 주말 이벤트 참여 여부(online_status) 컬럼 추가
--
-- 값: 'yes' | 'no' | 'none'(기본, 미지정/이벤트 없음)
-- 관리자·본인이 멤버 관리에서 참여 여부를 관리한다.
--
-- Supabase Dashboard → SQL Editor 에서 실행 필요
-- =============================================

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS online_status text NOT NULL DEFAULT 'none';
