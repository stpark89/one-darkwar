-- 이주 신청에 국가(country) 컬럼 추가
ALTER TABLE public.transfer_applications
  ADD COLUMN IF NOT EXISTS country text NOT NULL DEFAULT '';
