-- 회원 승인 기능: profiles 테이블에 status 컬럼 추가
-- 기존 사용자는 모두 APPROVED 처리
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'APPROVED';

-- 신규 가입자는 PENDING으로 기본값 변경 (기존 데이터는 그대로 APPROVED)
ALTER TABLE public.profiles
  ALTER COLUMN status SET DEFAULT 'PENDING';
