-- =============================================
-- 이주 신청에 '초대 완료' 표시 컬럼 추가 (관리자 전용 추적)
--
-- 관리자가 초대 메일을 보낸 신청자를 표시하기 위한 컬럼.
-- invited_at 이 NULL 이면 미초대, 값이 있으면 초대 완료(그 시각).
-- 게스트 조회(loadPublic)에는 노출하지 않는다 (관리자 내부 추적용).
--
-- Supabase Dashboard → SQL Editor 에서 실행 필요
-- =============================================

ALTER TABLE public.transfer_applications
  ADD COLUMN IF NOT EXISTS invited_at timestamptz;
