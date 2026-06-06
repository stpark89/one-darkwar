-- =============================================
-- 이주 신청 v2: 단체 신청 (그룹) + 희망 동맹
--
-- 변경:
--  1. application_groups 테이블 신설 (대표자가 N명을 묶어 신청)
--  2. transfer_applications 에 group_id / desired_alliance 컬럼 추가
--  3. 기존 데이터 backfill (desired_alliance = 'ONE')
--  4. submit_transfer_group RPC — 그룹 + N개 신청을 한 트랜잭션으로
--  5. 게스트 조회용 RLS 정책 — 대기/승인 상태만 anon SELECT 허용
--
-- Supabase Dashboard → SQL Editor 에서 실행 필요
-- =============================================

-- 1) application_groups 테이블
CREATE TABLE IF NOT EXISTS public.application_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  leader_name text NOT NULL,
  leader_uid text NOT NULL DEFAULT '',
  leader_contact text NOT NULL DEFAULT '',
  desired_alliance text NOT NULL DEFAULT 'ONE'
    CHECK (desired_alliance IN ('ONE', 'NXO', 'NH_D', 'OTHER')),
  desired_alliance_other text NOT NULL DEFAULT '',
  member_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS application_groups_alliance_idx
  ON public.application_groups(desired_alliance, created_at DESC);

ALTER TABLE public.application_groups ENABLE ROW LEVEL SECURITY;

-- 누구나 INSERT 가능 (게스트 신청)
DROP POLICY IF EXISTS "group insert anyone" ON public.application_groups;
CREATE POLICY "group insert anyone" ON public.application_groups
  FOR INSERT WITH CHECK (true);

-- 누구나 SELECT 가능 (게스트 조회 페이지에서 사용)
DROP POLICY IF EXISTS "group select anyone" ON public.application_groups;
CREATE POLICY "group select anyone" ON public.application_groups
  FOR SELECT USING (true);

-- 관리자만 UPDATE/DELETE
DROP POLICY IF EXISTS "group update admin" ON public.application_groups;
CREATE POLICY "group update admin" ON public.application_groups
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ROLE_ADMIN')
  );

DROP POLICY IF EXISTS "group delete admin" ON public.application_groups;
CREATE POLICY "group delete admin" ON public.application_groups
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ROLE_ADMIN')
  );

-- 2) transfer_applications 에 컬럼 추가
ALTER TABLE public.transfer_applications
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.application_groups(id) ON DELETE CASCADE;

ALTER TABLE public.transfer_applications
  ADD COLUMN IF NOT EXISTS desired_alliance text NOT NULL DEFAULT 'ONE'
    CHECK (desired_alliance IN ('ONE', 'NXO', 'NH_D', 'OTHER'));

ALTER TABLE public.transfer_applications
  ADD COLUMN IF NOT EXISTS desired_alliance_other text NOT NULL DEFAULT '';

-- 기존 데이터 backfill — 이미 등록된 신청은 desired_alliance 가 default 'ONE' 으로 채워짐
-- (NOT NULL DEFAULT 라 자동 적용. 다른 값으로 수정하려면 운영자가 따로 UPDATE)

CREATE INDEX IF NOT EXISTS transfer_applications_group_id_idx
  ON public.transfer_applications(group_id);
CREATE INDEX IF NOT EXISTS transfer_applications_alliance_idx
  ON public.transfer_applications(desired_alliance, created_at DESC);

-- 3) 게스트 조회용 SELECT 정책 — 대기/승인만 공개, 거절은 비공개
-- 기존 admin SELECT 정책은 유지 (관리자는 모든 상태 조회)
DROP POLICY IF EXISTS "transfer select public (pending/approved)" ON public.transfer_applications;
CREATE POLICY "transfer select public (pending/approved)" ON public.transfer_applications
  FOR SELECT
  USING (status IN ('PENDING', 'APPROVED'));

-- 4) submit_transfer_group RPC — 그룹 + N개 신청 한 번에 INSERT
-- 게스트가 호출 가능. SECURITY DEFINER 로 RLS 우회해서 일관성 있는 트랜잭션.
CREATE OR REPLACE FUNCTION public.submit_transfer_group(
  p_leader_name text,
  p_leader_uid text,
  p_leader_contact text,
  p_desired_alliance text,
  p_desired_alliance_other text,
  p_members jsonb  -- [{ in_game_name, uid, current_server, country, cp, tier_id }, ...]
)
RETURNS uuid  -- 생성된 group id
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group_id uuid;
  v_member jsonb;
  v_count int := 0;
BEGIN
  -- 검증
  IF p_desired_alliance NOT IN ('ONE', 'NXO', 'NH_D', 'OTHER') THEN
    RAISE EXCEPTION 'invalid alliance: %', p_desired_alliance;
  END IF;
  IF p_members IS NULL OR jsonb_array_length(p_members) = 0 THEN
    RAISE EXCEPTION 'members required';
  END IF;

  -- 그룹 생성
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

  -- 멤버별 신청서 생성
  FOR v_member IN SELECT * FROM jsonb_array_elements(p_members)
  LOOP
    INSERT INTO public.transfer_applications (
      group_id,
      in_game_name,
      uid,
      current_server,
      country,
      cp,
      tier_id,
      desired_alliance,
      desired_alliance_other
    )
    VALUES (
      v_group_id,
      TRIM(COALESCE(v_member->>'in_game_name', '')),
      TRIM(COALESCE(v_member->>'uid', '')),
      TRIM(COALESCE(v_member->>'current_server', '')),
      TRIM(COALESCE(v_member->>'country', '')),
      TRIM(COALESCE(v_member->>'cp', '')),
      NULLIF(v_member->>'tier_id', '')::uuid,
      p_desired_alliance,
      TRIM(COALESCE(p_desired_alliance_other, ''))
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_group_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_transfer_group(text, text, text, text, text, jsonb)
  TO anon, authenticated;
