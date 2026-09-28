-- 되돌리기 — migration_transfer_season.sql
-- 신청 데이터는 지우지 않는다. season_id 컬럼과 시즌 테이블만 제거한다.
-- ⚠️ 새 시즌에 복제된 등급 행(transfer_tiers)은 남는다 — 필요하면 직접 지운다.

-- UID 조회 RPC 를 시즌 필터 없는 이전 버전으로 되돌린다
CREATE OR REPLACE FUNCTION public.get_my_transfer(p_name text, p_uid text)
RETURNS SETOF public.transfer_applications
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT * FROM public.transfer_applications
  WHERE TRIM(uid) = TRIM(p_uid) AND TRIM(p_uid) <> ''
  ORDER BY created_at DESC;
$$;

ALTER TABLE public.transfer_applications DROP COLUMN IF EXISTS season_id;
ALTER TABLE public.application_groups DROP COLUMN IF EXISTS season_id;
ALTER TABLE public.transfer_tiers DROP COLUMN IF EXISTS season_id;

DROP FUNCTION IF EXISTS public.active_transfer_season();
DROP TABLE IF EXISTS public.transfer_seasons;
