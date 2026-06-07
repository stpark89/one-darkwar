-- =============================================
-- 이주 신청에 신청자 메모(note) 컬럼 추가
--
-- 신청자가 자유롭게 남기는 메모 (admin_message 는 관리자→신청자 방향이라 별개).
-- submit_transfer_group RPC 도 멤버별 note 를 받도록 갱신.
-- (total_power 컬럼도 함께 보장 — 자체완결 마이그레이션)
--
-- Supabase Dashboard → SQL Editor 에서 실행 필요
-- =============================================

ALTER TABLE public.transfer_applications
  ADD COLUMN IF NOT EXISTS total_power text NOT NULL DEFAULT '';

ALTER TABLE public.transfer_applications
  ADD COLUMN IF NOT EXISTS note text NOT NULL DEFAULT '';

CREATE OR REPLACE FUNCTION public.submit_transfer_group(
  p_leader_name text,
  p_leader_uid text,
  p_leader_contact text,
  p_desired_alliance text,
  p_desired_alliance_other text,
  p_members jsonb  -- [{ in_game_name, uid, current_server, country, cp, total_power, note, tier_id }, ...]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group_id uuid;
  v_member jsonb;
BEGIN
  IF p_desired_alliance NOT IN ('ONE', 'NXO', 'NH_D', 'OTHER') THEN
    RAISE EXCEPTION 'invalid alliance: %', p_desired_alliance;
  END IF;
  IF p_members IS NULL OR jsonb_array_length(p_members) = 0 THEN
    RAISE EXCEPTION 'members required';
  END IF;

  INSERT INTO public.application_groups (
    leader_name, leader_uid, leader_contact,
    desired_alliance, desired_alliance_other, member_count
  )
  VALUES (
    TRIM(p_leader_name),
    TRIM(COALESCE(p_leader_uid, '')),
    TRIM(COALESCE(p_leader_contact, '')),
    p_desired_alliance,
    TRIM(COALESCE(p_desired_alliance_other, '')),
    jsonb_array_length(p_members)
  )
  RETURNING id INTO v_group_id;

  FOR v_member IN SELECT * FROM jsonb_array_elements(p_members)
  LOOP
    INSERT INTO public.transfer_applications (
      group_id, in_game_name, uid, current_server, country,
      cp, total_power, note, tier_id, desired_alliance, desired_alliance_other
    )
    VALUES (
      v_group_id,
      TRIM(COALESCE(v_member->>'in_game_name', '')),
      TRIM(COALESCE(v_member->>'uid', '')),
      TRIM(COALESCE(v_member->>'current_server', '')),
      TRIM(COALESCE(v_member->>'country', '')),
      TRIM(COALESCE(v_member->>'cp', '')),
      TRIM(COALESCE(v_member->>'total_power', '')),
      TRIM(COALESCE(v_member->>'note', '')),
      NULLIF(v_member->>'tier_id', '')::uuid,
      p_desired_alliance,
      TRIM(COALESCE(p_desired_alliance_other, ''))
    );
  END LOOP;

  RETURN v_group_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_transfer_group(text, text, text, text, text, jsonb)
  TO anon, authenticated;
