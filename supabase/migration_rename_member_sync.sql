-- =============================================
-- 멤버 이름 변경 시 로그인 계정도 함께 동기화하는 RPC
--
-- 배경:
--   members 와 profiles 는 별개 테이블이고 in_game_name 만으로 느슨하게
--   연결됨. 관리자가 members 의 인게임명을 바꿔도 profiles / auth.users
--   는 그대로 → 그 사용자가 옛 이름으로만 로그인 가능한 어색한 상태.
--
-- 이 RPC 는 SECURITY DEFINER 로 auth.users 접근권을 확보해서
-- 한 번의 호출로 세 테이블을 모두 동기화한다.
--
-- Supabase Dashboard → SQL Editor 에서 실행 필요
-- =============================================

CREATE OR REPLACE FUNCTION public.rename_member_with_profile(
  p_member_id uuid,
  p_new_name text,
  p_new_email text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_name text;
  v_profile_id uuid;
  v_conflict boolean;
BEGIN
  -- 1) 호출자 권한 검사 — 관리자만 가능
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'ROLE_ADMIN'
  ) THEN
    RAISE EXCEPTION 'permission denied';
  END IF;

  -- 2) 멤버의 OLD 이름 조회
  SELECT in_game_name INTO v_old_name FROM public.members WHERE id = p_member_id;
  IF v_old_name IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'member_not_found');
  END IF;

  -- 3) 같은 이름이면 처리할 게 없음
  IF v_old_name = p_new_name THEN
    RETURN jsonb_build_object('ok', true, 'profile_updated', false, 'reason', 'no_change');
  END IF;

  -- 4) 멤버 이름 업데이트 (선반영)
  UPDATE public.members SET in_game_name = p_new_name WHERE id = p_member_id;

  -- 5) 옛 이름과 매칭되는 profile 검색 (대소문자/공백 무시)
  SELECT id INTO v_profile_id
  FROM public.profiles
  WHERE LOWER(TRIM(in_game_name)) = LOWER(TRIM(v_old_name))
  LIMIT 1;

  IF v_profile_id IS NULL THEN
    -- 로그인 계정 자체가 없는 멤버 (단순 추적용) — 멤버만 바꿔두고 종료
    RETURN jsonb_build_object('ok', true, 'profile_updated', false, 'reason', 'no_matching_profile');
  END IF;

  -- 6) 새 이메일이 다른 계정과 충돌하는지 검사
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE email = p_new_email AND id != v_profile_id
  ) INTO v_conflict;

  IF v_conflict THEN
    -- 멤버 이름은 이미 바뀐 상태 → 롤백
    UPDATE public.members SET in_game_name = v_old_name WHERE id = p_member_id;
    RETURN jsonb_build_object('ok', false, 'reason', 'email_conflict');
  END IF;

  -- 7) profile + auth.users 일괄 업데이트
  UPDATE public.profiles SET in_game_name = p_new_name WHERE id = v_profile_id;
  UPDATE auth.users SET email = p_new_email, updated_at = NOW() WHERE id = v_profile_id;

  RETURN jsonb_build_object('ok', true, 'profile_updated', true, 'profile_id', v_profile_id);
END;
$$;

-- 로그인된 사용자(관리자 체크는 함수 내부) 만 호출 가능
REVOKE ALL ON FUNCTION public.rename_member_with_profile(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rename_member_with_profile(uuid, text, text) TO authenticated;
