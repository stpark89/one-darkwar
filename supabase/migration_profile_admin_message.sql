-- =============================================
-- profiles 에 관리자 메시지 컬럼 추가
-- 가입 거절 시 신청자에게 보여줄 안내문 (예: "이미 다른 이름으로 가입된
-- 계정이 있습니다. 그 계정으로 로그인하세요" 등)
--
-- Supabase Dashboard → SQL Editor 에서 실행 필요
-- =============================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS admin_message text NOT NULL DEFAULT '';
