-- =============================================
-- 신청자 본인이 이주 신청서를 수정할 수 있는 RPC 추가
--
-- 배경:
--   transfer_applications 테이블의 UPDATE 정책은 관리자 전용이라
--   anon(비로그인) 사용자는 직접 .update() 호출이 RLS 에 막힌다.
--   get_my_transfer 와 동일하게 SECURITY DEFINER RPC 로 우회.
--
-- 보안:
--   - p_uid 가 비어있으면 즉시 예외
--   - applications.uid = p_uid 일치 확인 후에만 UPDATE
--   - status 가 PENDING 또는 REJECTED 일 때만 수정 허용
--     (APPROVED 된 신청서는 수정 불가)
--
-- Supabase Dashboard → SQL Editor 에서 실행 필요
-- =============================================

CREATE OR REPLACE FUNCTION public.update_my_transfer(
  p_id          uuid,
  p_uid         text,   -- 본인 확인용 UID
  p_in_game_name        text,
  p_uid_new     text,   -- 수정할 UID 값
  p_current_server      text,
  p_country             text,
  p_cp                  text,
  p_total_power         text,
  p_note                text,
  p_tier_id             uuid,
  p_desired_alliance    text,
  p_desired_alliance_other text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current record;
BEGIN
  -- UID 필수 검증
  IF TRIM(p_uid) = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'uid_required');
  END IF;

  -- 신청서 조회 + 소유자 검증
  SELECT id, uid, status INTO v_current
  FROM public.transfer_applications
  WHERE id = p_id
    AND TRIM(uid) = TRIM(p_uid);

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  -- APPROVED 는 수정 불가
  IF v_current.status = 'APPROVED' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_approved');
  END IF;

  -- 수정 + 상태 PENDING 재설정
  UPDATE public.transfer_applications
  SET
    in_game_name          = TRIM(p_in_game_name),
    uid                   = TRIM(p_uid_new),
    current_server        = TRIM(p_current_server),
    country               = TRIM(p_country),
    cp                    = TRIM(p_cp),
    total_power           = TRIM(p_total_power),
    note                  = TRIM(p_note),
    tier_id               = p_tier_id,
    desired_alliance      = p_desired_alliance,
    desired_alliance_other = TRIM(p_desired_alliance_other),
    status                = 'PENDING',
    reviewed_at           = NULL,
    reviewed_by           = NULL
  WHERE id = p_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_my_transfer(
  uuid, text, text, text, text, text, text, text, text, uuid, text, text
) TO anon, authenticated;
