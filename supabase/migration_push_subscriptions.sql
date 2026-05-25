-- =============================================
-- 웹 푸시 알림 구독 테이블
-- 관리자가 본인 디바이스의 푸시 구독을 저장 → 새 이주 신청 시 알림 발송
--
-- Supabase Dashboard → SQL Editor 에서 실행 필요
-- =============================================

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- PushSubscription.endpoint (구독별 고유)
  endpoint text NOT NULL UNIQUE,
  -- 암호화용 키 (PushSubscription.keys)
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx
  ON public.push_subscriptions(user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- 본인 구독만 INSERT
DROP POLICY IF EXISTS "push insert own" ON public.push_subscriptions;
CREATE POLICY "push insert own" ON public.push_subscriptions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 본인 구독만 SELECT
DROP POLICY IF EXISTS "push select own" ON public.push_subscriptions;
CREATE POLICY "push select own" ON public.push_subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

-- 본인 구독만 DELETE
DROP POLICY IF EXISTS "push delete own" ON public.push_subscriptions;
CREATE POLICY "push delete own" ON public.push_subscriptions
  FOR DELETE
  USING (auth.uid() = user_id);

-- Vercel Serverless Function 은 service_role 키로 접근 → RLS 우회 가능
-- 관리자 구독 일괄 조회 시 service_role 사용
