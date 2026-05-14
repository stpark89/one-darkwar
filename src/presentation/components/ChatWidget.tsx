import { useEffect, useRef, useState } from 'react'
import { MessageCircle, X, Send, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { cn } from '@/lib/utils'

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
  const bottomRef = useRef<HTMLDivElement>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    if (!user) return

    // 최근 메시지 로드
    supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(LOAD_LIMIT)
      .then(({ data }) => {
        setMessages((data ?? []).reverse())
      })

    // Realtime 채널 (Presence + 새 메시지)
    const channel = supabase.channel('guild-chat', {
      config: { presence: { key: user.id } },
    })

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
          setUnread((n) => (open ? 0 : n + 1))
        },
      )
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ in_game_name: user.inGameName })
        }
      })

    channelRef.current = channel
    return () => { supabase.removeChannel(channel) }
  }, [user])

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
    await supabase.from('messages').insert({
      user_id: user.id,
      in_game_name: user.inGameName,
      content: text,
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  if (!user) return null

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2">
      {/* 채팅 패널 */}
      {open && (
        <div className="w-80 h-[480px] rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] shadow-2xl flex flex-col overflow-hidden">
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
            <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-[var(--color-border)] text-[var(--color-text-muted)]">
              <X className="w-4 h-4" />
            </button>
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
                  return (
                    <div key={msg.id} className={cn('flex flex-col gap-0.5', isMine && 'items-end')}>
                      {!isMine && (
                        <span className="text-[10px] text-[var(--color-text-muted)] px-1">{msg.in_game_name}</span>
                      )}
                      <div className={cn(
                        'px-3 py-2 rounded-2xl text-sm max-w-[75%] break-words',
                        isMine
                          ? 'bg-[var(--color-brand)] text-white rounded-br-sm'
                          : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] rounded-bl-sm',
                      )}>
                        {msg.content}
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
                  disabled={!input.trim()}
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
