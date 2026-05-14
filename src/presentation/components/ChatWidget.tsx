import { useEffect, useRef, useState } from 'react'
import { MessageCircle, X, Send, Users, Languages, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { cn } from '@/lib/utils'
import i18n from '@/i18n'

// MyMemory API: 무료, API키 불필요, 1000 req/일
const MYMEMORY_LANG: Record<string, string> = {
  ko: 'ko',
  en: 'en',
  vi: 'vi',
  'zh-TW': 'zh-TW',
  zh: 'zh',
}

async function translateText(text: string, targetLang: string): Promise<string> {
  const lang = MYMEMORY_LANG[targetLang] ?? 'en'
  const res = await fetch(
    `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=autodetect|${lang}`,
  )
  const data = await res.json()
  if (data.responseStatus === 200) return data.responseData.translatedText as string
  throw new Error(data.responseDetails ?? 'Translation failed')
}

interface Message {
  id: number
  user_id: string
  in_game_name: string
  content: string
  created_at: string
}

interface OnlineUser {
  user_id: string
  in_game_name: string
}

const LOAD_LIMIT = 50

export const ChatWidget = () => {
  const { user } = useAuthStore()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'chat' | 'online'>('chat')
  const [messages, setMessages] = useState<Message[]>([])
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([])
  const [input, setInput] = useState('')
  const [unread, setUnread] = useState(0)
  const [translatingIds, setTranslatingIds] = useState<Set<number>>(new Set())
  const [translations, setTranslations] = useState<Map<number, string>>(new Map())
  const [connected, setConnected] = useState(false)
  const [reconnectKey, setReconnectKey] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  // stale closure 방지: open 최신값을 ref로 유지
  const openRef = useRef(open)
  useEffect(() => { openRef.current = open }, [open])

  const handleTranslate = async (msg: Message) => {
    // 이미 번역된 경우 토글 (숨기기)
    if (translations.has(msg.id)) {
      setTranslations((prev) => { const next = new Map(prev); next.delete(msg.id); return next })
      return
    }
    setTranslatingIds((prev) => new Set(prev).add(msg.id))
    try {
      const targetLang = i18n.language
      const result = await translateText(msg.content, targetLang)
      setTranslations((prev) => new Map(prev).set(msg.id, result))
    } catch {
      setTranslations((prev) => new Map(prev).set(msg.id, '번역 실패'))
    } finally {
      setTranslatingIds((prev) => { const next = new Set(prev); next.delete(msg.id); return next })
    }
  }

  useEffect(() => {
    if (!user) return

    // 최근 메시지 로드 (재연결 시에도 새로 불러옴)
    supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(LOAD_LIMIT)
      .then(({ data }) => {
        setMessages((data ?? []).reverse())
      })

    setConnected(false)

    // Realtime 채널 (Presence + 새 메시지)
    const channel = supabase.channel(`guild-chat-${Date.now()}`, {
      config: { presence: { key: user.id } },
    })

    let retryTimer: ReturnType<typeof setTimeout> | null = null

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<{ in_game_name: string }>()
        const users = Object.entries(state).map(([user_id, presences]) => ({
          user_id,
          in_game_name: presences[0].in_game_name,
        }))
        setOnlineUsers(users)
      })
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const msg = payload.new as Message
          setMessages((prev) => [...prev, msg])
          // openRef로 최신 open 값 참조 (stale closure 방지)
          setUnread((n) => (openRef.current ? 0 : n + 1))
        },
      )
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          setConnected(true)
          await channel.track({ in_game_name: user.inGameName })
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          // 연결 오류 시 3초 후 자동 재연결
          setConnected(false)
          retryTimer = setTimeout(() => setReconnectKey((k) => k + 1), 3000)
        } else if (status === 'CLOSED') {
          setConnected(false)
        }
      })

    channelRef.current = channel
    return () => {
      if (retryTimer) clearTimeout(retryTimer)
      supabase.removeChannel(channel)
    }
  }, [user, reconnectKey])

  // 채팅창 열 때 unread 초기화 + 스크롤 하단
  useEffect(() => {
    if (open) {
      setUnread(0)
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    }
  }, [open])

  // 새 메시지 오면 채팅창 열려있으면 스크롤
  useEffect(() => {
    if (open && tab === 'chat') {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, open, tab])

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || !user) return
    setInput('')
    const { error } = await supabase.from('messages').insert({
      user_id: user.id,
      in_game_name: user.inGameName,
      content: text,
    })
    if (error) {
      // 전송 실패 시 입력 복원
      setInput(text)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); sendMessage() }
  }

  if (!user) return null

  return (
    <div className="fixed bottom-4 right-3 sm:bottom-5 sm:right-5 z-50 flex flex-col items-end gap-2">
      {/* 채팅 패널 */}
      {open && (
        <div className="w-[calc(100vw-24px)] sm:w-80 h-[70vh] sm:h-[480px] rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] shadow-2xl flex flex-col overflow-hidden">
          {/* 헤더 */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)]">
            <div className="flex gap-1">
              <button
                onClick={() => setTab('chat')}
                className={cn('px-3 py-1 rounded-lg text-xs font-semibold transition-colors', tab === 'chat' ? 'bg-[var(--color-brand)] text-white' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]')}
              >
                채팅
              </button>
              <button
                onClick={() => setTab('online')}
                className={cn('flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold transition-colors', tab === 'online' ? 'bg-[var(--color-brand)] text-white' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]')}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                {onlineUsers.length}명 접속중
              </button>
            </div>
            <div className="flex items-center gap-2">
              {/* 연결 상태 표시 */}
              {!connected && (
                <span className="flex items-center gap-1 text-[10px] text-[var(--color-text-muted)]">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  연결 중…
                </span>
              )}
              <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-[var(--color-border)] text-[var(--color-text-muted)]">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 채팅 탭 */}
          {tab === 'chat' && (
            <>
              <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
                {messages.length === 0 && (
                  <p className="text-center text-xs text-[var(--color-text-muted)] mt-8">첫 메시지를 보내보세요!</p>
                )}
                {messages.map((msg) => {
                  const isMine = msg.user_id === user.id
                  const isTranslating = translatingIds.has(msg.id)
                  const translated = translations.get(msg.id)
                  return (
                    <div key={msg.id} className={cn('flex flex-col gap-0.5 group', isMine && 'items-end')}>
                      {!isMine && (
                        <span className="text-[10px] text-[var(--color-text-muted)] px-1">{msg.in_game_name}</span>
                      )}
                      <div className={cn('flex items-end gap-1.5 max-w-[85%]', isMine && 'flex-row-reverse')}>
                        <div className={cn(
                          'px-3 py-2 rounded-2xl text-sm break-words',
                          isMine
                            ? 'bg-[var(--color-brand)] text-white rounded-br-sm'
                            : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] rounded-bl-sm',
                        )}>
                          {msg.content}
                          {translated && (
                            <div className={cn(
                              'mt-1.5 pt-1.5 text-[11px] leading-relaxed',
                              isMine ? 'border-t border-white/30 text-white/80' : 'border-t border-[var(--color-border-subtle)] text-[var(--color-text-muted)]',
                            )}>
                              {translated}
                            </div>
                          )}
                        </div>
                        {/* 번역 버튼 */}
                        <button
                          onClick={() => handleTranslate(msg)}
                          disabled={isTranslating}
                          className={cn(
                            'flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-all',
                            'opacity-0 group-hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100',
                            // 모바일: 항상 표시
                            'opacity-60 sm:opacity-0',
                            translated
                              ? 'bg-[var(--color-brand)]/20 text-[var(--color-brand)]'
                              : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]',
                          )}
                          title="번역"
                        >
                          {isTranslating
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <Languages className="w-3 h-3" />}
                        </button>
                      </div>
                      <span className="text-[10px] text-[var(--color-text-muted)] px-1">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  )
                })}
                <div ref={bottomRef} />
              </div>
              <div className="px-3 py-3 border-t border-[var(--color-border-subtle)] flex gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="메시지 입력..."
                  className="flex-1 text-sm bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-xl px-3 py-2 outline-none focus:border-[var(--color-brand)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]"
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || !connected}
                  className="w-9 h-9 rounded-xl bg-[var(--color-brand)] flex items-center justify-center text-white disabled:opacity-40 hover:opacity-90 transition-opacity flex-shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </>
          )}

          {/* 접속자 탭 */}
          {tab === 'online' && (
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
              {onlineUsers.length === 0 && (
                <p className="text-center text-xs text-[var(--color-text-muted)] mt-8">접속 중인 유저가 없습니다.</p>
              )}
              {onlineUsers.map((u) => (
                <div key={u.user_id} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-[var(--color-bg-elevated)] transition-colors">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
                  <span className={cn('text-sm font-medium', u.user_id === user.id ? 'text-[var(--color-brand)]' : 'text-[var(--color-text-primary)]')}>
                    {u.in_game_name}
                    {u.user_id === user.id && <span className="text-[10px] ml-1 opacity-60">(나)</span>}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 플로팅 버튼 */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-14 h-14 rounded-full bg-[var(--color-brand)] shadow-lg shadow-[var(--color-brand)]/30 flex items-center justify-center text-white hover:opacity-90 transition-opacity relative"
      >
        {open ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
        {!open && unread > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
        {!open && onlineUsers.length > 0 && unread === 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center w-5 h-5 rounded-full bg-green-500 text-white text-[10px] font-bold">
            <Users className="w-3 h-3" />
          </span>
        )}
      </button>
    </div>
  )
}
