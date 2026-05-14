-- 이벤트 숨김 기능
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false;
