-- =============================================
-- S2 승인·대기 신청서를 s7 겨울이주로 이관 (2026-11-08 실행)
--
-- 배경: 2026-11-08 00:17 KST 관리자(Jo Ju)가 「새 시즌」으로 s7 겨울이주를 열어
--       S2 가 닫혔다. 목록이 시즌별이라 S2 승인 41·대기 1 이 사라진 것처럼 보였다.
--       s7 은 등급표 0개로 열렸다(openNewTransferSeason 은 등급을 복사하지 않는다).
-- 결정: s7 이 새 겨울 이주가 맞고, S2 승인·대기분은 s7 에 합친다(사용자 확정).
--
-- 바꾸는 것은 season_id 뿐 — 상태·승인자·승인시각·전투력·단체·UID·행 id 그대로.
-- 트리거·웹훅 없음 확인(pg_trigger 0행) — 알림 발송 없음.
--
-- 되돌리기: backup 스키마의 *_20261108 테이블에서 season_id 를 복원한다(맨 아래).
-- =============================================

-- 1) 백업 — backup 스키마는 PostgREST 에 노출되지 않는다
CREATE SCHEMA IF NOT EXISTS backup;
CREATE TABLE backup.transfer_applications_20261108 AS SELECT * FROM public.transfer_applications;
CREATE TABLE backup.application_groups_20261108   AS SELECT * FROM public.application_groups;
CREATE TABLE backup.transfer_tiers_20261108       AS SELECT * FROM public.transfer_tiers;
CREATE TABLE backup.transfer_seasons_20261108     AS SELECT * FROM public.transfer_seasons;

-- 2) 이관 — 검증 실패 시 예외로 전체 롤백
DO $$
DECLARE
  s2 uuid; s7 uuid; n_before int; n_ok int;
BEGIN
  SELECT id INTO s2 FROM public.transfer_seasons WHERE name = 'S2 (신규 이주)';
  SELECT id INTO s7 FROM public.transfer_seasons WHERE name = 's7 겨울이주';
  IF s2 IS NULL OR s7 IS NULL THEN RAISE EXCEPTION 'season not found'; END IF;

  CREATE TEMP TABLE s2_before ON COMMIT DROP AS
    SELECT id, status, reviewed_by, reviewed_at, total_power, group_id, uid, tier_id
    FROM public.transfer_applications
    WHERE season_id = s2 AND status IN ('APPROVED', 'PENDING');
  SELECT count(*) INTO n_before FROM s2_before;
  IF n_before <> 42 THEN RAISE EXCEPTION 'expected 42 rows, got %', n_before; END IF;

  -- 등급표: s7 에 하나도 없을 때만 S2 것을 복제
  IF NOT EXISTS (SELECT 1 FROM public.transfer_tiers WHERE season_id = s7) THEN
    INSERT INTO public.transfer_tiers (name, color, min_cp, max_cp, capacity, sort_order, season_name, season_id)
    SELECT name, color, min_cp, max_cp, capacity, sort_order, season_name, s7
    FROM public.transfer_tiers WHERE season_id = s2;
  END IF;

  -- 단체를 먼저 — 안 옮기면 단체 소속 승인자가 s7 목록에서 안 그려진다
  UPDATE public.application_groups SET season_id = s7
  WHERE id IN (SELECT group_id FROM s2_before WHERE group_id IS NOT NULL);

  UPDATE public.transfer_applications SET season_id = s7
  WHERE id IN (SELECT id FROM s2_before);

  SELECT count(*) INTO n_ok
  FROM s2_before b JOIN public.transfer_applications a USING (id)
  WHERE a.season_id = s7
    AND a.status = b.status
    AND a.reviewed_by IS NOT DISTINCT FROM b.reviewed_by
    AND a.reviewed_at IS NOT DISTINCT FROM b.reviewed_at
    AND a.total_power IS NOT DISTINCT FROM b.total_power
    AND a.group_id    IS NOT DISTINCT FROM b.group_id
    AND a.tier_id     IS NOT DISTINCT FROM b.tier_id
    AND a.uid = b.uid;
  IF n_ok <> n_before THEN RAISE EXCEPTION 'verify failed: % / %', n_ok, n_before; END IF;
END $$;

-- 3) 되돌리기 (필요할 때만)
-- UPDATE public.transfer_applications a SET season_id = b.season_id
--   FROM backup.transfer_applications_20261108 b WHERE a.id = b.id;
-- UPDATE public.application_groups g SET season_id = b.season_id
--   FROM backup.application_groups_20261108 b WHERE g.id = b.id;
-- DELETE FROM public.transfer_tiers WHERE id NOT IN (SELECT id FROM backup.transfer_tiers_20261108);
