-- 이주 신청에 UID(게임 내 고유 ID) 컬럼 추가
ALTER TABLE public.transfer_applications
  ADD COLUMN IF NOT EXISTS uid text NOT NULL DEFAULT '';
