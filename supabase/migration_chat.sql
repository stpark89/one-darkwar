-- 채팅 메시지 테이블
CREATE TABLE IF NOT EXISTS public.messages (
  id        bigserial primary key,
  user_id   uuid references auth.users(id) on delete cascade not null,
  in_game_name text not null,
  content   text not null,
  created_at timestamptz not null default now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "messages_select_all" ON public.messages
  FOR SELECT USING (true);

CREATE POLICY "messages_insert_own" ON public.messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Realtime 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
