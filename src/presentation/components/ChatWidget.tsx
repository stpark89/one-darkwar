import { useEffect, useRef, useState } from 'react'
import { MessageCircle, X, Send, Users, Languages, Loader2, Bot } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { useMemberStore } from '@/infrastructure/stores/memberStore'
import { useEventStore } from '@/infrastructure/stores/eventStore'
import type { Member } from '@/domain/entities/Member'
import type { EventAttendance } from '@/domain/entities/Event'
import { cn } from '@/lib/utils'
import i18n from '@/i18n'

const MYMEMORY_LANG: Record<string, string> = {
  ko: 'ko', en: 'en', vi: 'vi', 'zh-TW': 'zh-TW', zh: 'zh',
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
const BOT_ID = '__bot__'

const parseCp = (cp: string): number => {
  const v = parseFloat(cp)
  if (isNaN(v)) return 0
  if (cp.toUpperCase().includes('G')) return v * 1000
  if (cp.toUpperCase().includes('M')) return v
  return v
}

const getAttendCount = (memberId: string, attendance: EventAttendance[]) => {
  const rec = attendance.find((a) => a.memberId === memberId)
  if (!rec) return 0
  return Object.values(rec.records).filter((s) => s === 'CT' || s === 'DB').length
}

const COMMAND_KEYS = [
  { cmdKey: 'bot.cmd_ranking', descKey: 'bot.cmd_ranking_desc' },
  { cmdKey: 'bot.cmd_member', descKey: 'bot.cmd_member_desc' },
  { cmdKey: 'bot.cmd_count', descKey: 'bot.cmd_count_desc' },
  { cmdKey: 'bot.cmd_help', descKey: 'bot.cmd_help_desc' },
] as const

// 언어별 명령어 → 동일 기능의 영어 canonical 명령어로 매핑
const CMD_ALIASES: Record<string, string> = {
  '/랭킹': '/ranking', '/멤버': '/member', '/인원': '/count', '/도움말': '/help',
  '/xephang': '/ranking', '/thanh-vien': '/member', '/tong': '/count',
  '/排名': '/ranking', '/成員': '/member', '/人數': '/count', '/說明': '/help',
}

function normalizeCmd(cmd: string): string {
  const lower = cmd.toLowerCase()
  return CMD_ALIASES[lower] ?? CMD_ALIASES[cmd] ?? lower
}

function handleBotCommand(text: string, members: Member[], attendance: EventAttendance[]): string | null {
  const t = i18n.t.bind(i18n)
  const [cmd, ...args] = text.trim().split(/\s+/)
  // 현재 언어의 명령어도 aliases에 추가해 인식
  const localRanking = t('bot.cmd_ranking').toLowerCase()
  const localMember = t('bot.cmd_member').toLowerCase()
  const localCount = t('bot.cmd_count').toLowerCase()
  const localHelp = t('bot.cmd_help').toLowerCase()
  const normalized = normalizeCmd(cmd) === cmd.toLowerCase()
    ? ([localRanking, '/ranking'].includes(cmd.toLowerCase()) ? '/ranking'
      : [localMember, '/member'].includes(cmd.toLowerCase()) ? '/member'
      : [localCount, '/count'].includes(cmd.toLowerCase()) ? '/count'
      : [localHelp, '/help'].includes(cmd.toLowerCase()) ? '/help'
      : normalizeCmd(cmd))
    : normalizeCmd(cmd)

  if (normalized === '/help') {
    const rows = COMMAND_KEYS.map((c) => `${t(c.cmdKey).padEnd(10)} — ${t(c.descKey)}`)
    return [t('bot.help_title'), '', ...rows].join('\n')
  }

  if (normalized === '/ranking') {
    const n = Math.min(Math.max(parseInt(args[0] ?? '5') || 5, 1), 20)
    const sorted = [...members].sort((a, b) => parseCp(b.cp) - parseCp(a.cp)).slice(0, n)
    if (sorted.length === 0) return t('bot.ranking_empty')
    const rows = sorted.map((m, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${String(i + 1).padStart(2)}.`
      const cp = m.cp ? m.cp.padStart(7) : '      -'
      const evCount = getAttendCount(m.id, attendance)
      const ev = evCount > 0 ? ` · ${t('bot.ranking_event', { count: evCount })}` : ''
      return `${medal} ${m.inGameName}  ${cp}${ev}`
    })
    return [t('bot.ranking_title', { n }), '', ...rows].join('\n')
  }

  if (normalized === '/member') {
    const query = args.join(' ').toLowerCase()
    if (!query) return t('bot.member_usage')
    const found = members.filter((m) => m.inGameName.toLowerCase().includes(query))
    if (found.length === 0) return t('bot.member_not_found', { name: args.join(' ') })
    return found.slice(0, 3).map((m) => {
      const evCount = getAttendCount(m.id, attendance)
      return [
        `👤 ${m.inGameName}`,
        `  ${t('bot.member_cp').padEnd(8)}: ${m.cp || '-'}`,
        `  ${t('bot.member_house').padEnd(8)}: ${m.houseLevel || '-'}`,
        `  ${t('bot.member_event').padEnd(8)}: ${t('bot.member_event_count', { count: evCount })}`,
        m.zaloName ? `  ${t('bot.member_uid').padEnd(8)}: ${m.zaloName}` : '',
        m.note ? `  ${t('bot.member_note').padEnd(8)}: ${m.note}` : '',
      ].filter(Boolean).join('\n')
    }).join('\n\n')
  }

  if (normalized === '/count') {
    return t('bot.count_result', { count: members.length })
  }

  if (text.startsWith('/')) {
    return t('bot.unknown_cmd')
  }

  return null
}

function makeBotMessage(content: string): Message {
  return {
    id: -Date.now(),
    user_id: BOT_ID,
    in_game_name: i18n.t('bot.name'),
    content,
    created_at: new Date().toISOString(),
  }
}

function renderContent(content: string, myName: string, isMine: boolean) {
  const parts = content.split(/(@\S+)/g)
  return parts.map((part, i) => {
    if (part.startsWith('@')) {
      const isMe = part.slice(1) === myName
      return (
        <span
          key={i}
          className={cn(
            'font-semibold rounded px-0.5',
            isMe
              ? 'bg-yellow-400/30 text-yellow-300'
              : isMine
                ? 'bg-white/20 text-white'
                : 'text-[var(--color-brand)]',
          )}
        >
          {part}
        </span>
      )
    }
    return <span key={i}>{part}</span>
  })
}

export const ChatWidget = () => {
  const { user, isGuest } = useAuthStore()
  const { members, loadMembers } = useMemberStore()
  const { attendance, loadData: loadEvents } = useEventStore()
  const t = i18n.t.bind(i18n)
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

  const [mentionSearch, setMentionSearch] = useState<string | null>(null)
  const [mentionIndex, setMentionIndex] = useState(0)
  const [showHint, setShowHint] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const openRef = useRef(open)
  useEffect(() => { openRef.current = open }, [open])

  useEffect(() => { if (user) { loadMembers(); loadEvents() } }, [user, loadMembers, loadEvents])


  const mentionCandidates =
    mentionSearch !== null
      ? members.filter((m) =>
          m.inGameName.toLowerCase().startsWith(mentionSearch.toLowerCase()),
        )
      : []

  const handleTranslate = async (msg: Message) => {
    if (translations.has(msg.id)) {
      setTranslations((prev) => { const next = new Map(prev); next.delete(msg.id); return next })
      return
    }
    setTranslatingIds((prev) => new Set(prev).add(msg.id))
    try {
      const result = await translateText(msg.content, i18n.language)
      setTranslations((prev) => new Map(prev).set(msg.id, result))
    } catch {
      setTranslations((prev) => new Map(prev).set(msg.id, '번역 실패'))
    } finally {
      setTranslatingIds((prev) => { const next = new Set(prev); next.delete(msg.id); return next })
    }
  }

  useEffect(() => {
    if (!user) return

    supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(LOAD_LIMIT)
      .then(({ data }) => { setMessages((data ?? []).reverse()) })

    setConnected(false)

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
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const msg = payload.new as Message
        setMessages((prev) => [...prev, msg])
        setUnread((n) => (openRef.current ? 0 : n + 1))
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          setConnected(true)
          await channel.track({ in_game_name: user.inGameName })
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
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

  useEffect(() => {
    if (open) {
      setUnread(0)
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    }
  }, [open])

  useEffect(() => {
    if (open && tab === 'chat') {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, open, tab])

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || !user) return
    setInput('')
    setMentionSearch(null)

    const botReply = handleBotCommand(text, members, attendance)
    if (botReply !== null) {
      setMessages((prev) => [...prev, makeBotMessage(botReply)])
      return
    }

    const { error } = await supabase.from('messages').insert({
      user_id: user.id,
      in_game_name: user.inGameName,
      content: text,
    })
    if (error) setInput(text)
  }

  const insertMention = (name: string) => {
    const el = inputRef.current
    const cursor = el?.selectionStart ?? input.length
    const before = input.slice(0, cursor)
    const after = input.slice(cursor)
    const match = before.match(/@[\w가-힣]*$/)
    if (!match) return
    const start = cursor - match[0].length
    const newText = input.slice(0, start) + `@${name} ` + after
    setInput(newText)
    setMentionSearch(null)
    setTimeout(() => {
      if (el) {
        el.focus()
        const pos = start + name.length + 2
        el.setSelectionRange(pos, pos)
      }
    }, 0)
  }

  const insertCommand = (cmd: string) => {
    setInput(cmd + ' ')
    setShowHint(false)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setInput(val)
    if (val) setShowHint(false)
    const cursor = e.target.selectionStart ?? val.length
    const before = val.slice(0, cursor)
    const match = before.match(/@([\w가-힣]*)$/)
    if (match) {
      setMentionSearch(match[1])
      setMentionIndex(0)
    } else {
      setMentionSearch(null)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (mentionSearch !== null && mentionCandidates.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIndex((i) => Math.min(i + 1, mentionCandidates.length - 1)); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIndex((i) => Math.max(i - 1, 0)); return }
      if (e.key === 'Tab' || (e.key === 'Enter' && !e.nativeEvent.isComposing)) {
        e.preventDefault()
        insertMention(mentionCandidates[mentionIndex].inGameName)
        return
      }
      if (e.key === 'Escape') { setMentionSearch(null); return }
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      sendMessage()
    }
  }

  if (!user || isGuest) return null

  return (
    <div className="fixed bottom-4 right-3 sm:bottom-5 sm:right-5 z-50 flex flex-col items-end gap-2">
      {open && (
        <div className="w-[calc(100vw-24px)] sm:w-80 h-[70vh] sm:h-[480px] rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] shadow-2xl flex flex-col overflow-hidden">
          {/* 헤더 */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)]">
            <div className="flex gap-1">
              <button
                onClick={() => setTab('chat')}
                className={cn('px-3 py-1 rounded-lg text-xs font-semibold transition-colors', tab === 'chat' ? 'bg-[var(--color-brand)] text-white' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]')}
              >
                {t('chat.tab_chat')}
              </button>
              <button
                onClick={() => setTab('online')}
                className={cn('flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold transition-colors', tab === 'online' ? 'bg-[var(--color-brand)] text-white' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]')}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                {t('chat.online_count', { n: onlineUsers.length })}
              </button>
            </div>
            <div className="flex items-center gap-2">
              {!connected && (
                <span className="flex items-center gap-1 text-[10px] text-[var(--color-text-muted)]">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {t('chat.connecting')}
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
                  <p className="text-center text-xs text-[var(--color-text-muted)] mt-8">{t('chat.empty')}</p>
                )}
                {messages.map((msg) => {
                  const isBot = msg.user_id === BOT_ID
                  const isMine = msg.user_id === user.id
                  const isTranslating = translatingIds.has(msg.id)
                  const translated = translations.get(msg.id)
                  const isMentioned = msg.content.includes(`@${user.inGameName}`)

                  if (isBot) {
                    return (
                      <div key={msg.id} className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5 px-1">
                          <div className="w-4 h-4 rounded-full bg-[var(--color-brand)]/20 flex items-center justify-center flex-shrink-0">
                            <Bot className="w-2.5 h-2.5 text-[var(--color-brand)]" />
                          </div>
                          <span className="text-[10px] text-[var(--color-brand)] font-semibold">{t('bot.name')}</span>
                        </div>
                        <div className="max-w-[92%] px-3 py-2.5 rounded-2xl rounded-tl-sm bg-[var(--color-brand)]/8 border border-[var(--color-brand)]/20 text-xs text-[var(--color-text-primary)] whitespace-pre-wrap leading-relaxed font-mono">
                          {msg.content}
                        </div>
                        <span className="text-[10px] text-[var(--color-text-muted)] px-1">
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    )
                  }

                  return (
                    <div key={msg.id} className={cn('flex flex-col gap-0.5 group', isMine && 'items-end')}>
                      {!isMine && <span className="text-[10px] text-[var(--color-text-muted)] px-1">{msg.in_game_name}</span>}
                      <div className={cn('flex items-end gap-1.5 max-w-[85%]', isMine && 'flex-row-reverse')}>
                        <div className="flex flex-col gap-1">
                          <div className={cn(
                            'px-3 py-2 rounded-2xl text-sm break-words',
                            isMine ? 'bg-[var(--color-brand)] text-white rounded-br-sm' : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] rounded-bl-sm',
                            !isMine && isMentioned && 'ring-1 ring-yellow-400/50',
                          )}>
                            {renderContent(msg.content, user.inGameName, isMine)}
                          </div>
                          {translated && (
                            <div className={cn(
                              'px-3 py-2 rounded-xl text-[11px] leading-relaxed border',
                              isMine
                                ? 'bg-white/10 text-white border-white/20 rounded-tr-sm self-end'
                                : 'bg-[var(--color-bg-base)] text-[var(--color-text-secondary)] border-[var(--color-border-subtle)] rounded-tl-sm',
                            )}>
                              <span className="text-[9px] opacity-60 mr-1">🌐</span>
                              {translated}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => handleTranslate(msg)}
                          disabled={isTranslating}
                          className={cn(
                            'flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-all',
                            'opacity-60 sm:opacity-0 sm:group-hover:opacity-100',
                            translated ? 'bg-[var(--color-brand)]/20 text-[var(--color-brand)]' : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]',
                          )}
                          title={t('chat.translate_btn')}
                        >
                          {isTranslating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Languages className="w-3 h-3" />}
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

              {/* 입력 영역 */}
              <div className="relative px-3 py-3 border-t border-[var(--color-border-subtle)]">

                {/* 명령어 힌트 팝업 — 봇 버튼 클릭 시 토글 */}
                {showHint && (
                  <div className="absolute bottom-full left-3 right-3 mb-1 bg-[var(--color-bg-elevated)] border border-[var(--color-brand)]/30 rounded-xl shadow-lg overflow-hidden z-10">
                    <div className="flex items-center gap-1.5 px-3 py-2 border-b border-[var(--color-border-subtle)]">
                      <Bot className="w-3 h-3 text-[var(--color-brand)]" />
                      <span className="text-[10px] font-semibold text-[var(--color-brand)]">{t('bot.hint_label')}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-px bg-[var(--color-border-subtle)]">
                      {COMMAND_KEYS.map((c) => (
                        <button
                          key={c.cmdKey}
                          onClick={() => insertCommand(t(c.cmdKey))}
                          className="flex flex-col items-start px-3 py-2.5 bg-[var(--color-bg-elevated)] hover:bg-[var(--color-brand)]/10 transition-colors text-left"
                        >
                          <span className="text-[11px] font-semibold text-[var(--color-text-primary)]">{t(c.cmdKey)}</span>
                          <span className="text-[10px] text-[var(--color-text-muted)] leading-tight mt-0.5">{t(c.descKey)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 멘션 드롭다운 */}
                {mentionSearch !== null && mentionCandidates.length > 0 && (
                  <div className="absolute bottom-full left-3 right-3 mb-1 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-xl shadow-lg overflow-hidden z-10">
                    {mentionCandidates.map((m, i) => {
                      const isOnline = onlineUsers.some((o) => o.in_game_name === m.inGameName)
                      return (
                        <button
                          key={m.id}
                          onMouseDown={(e) => { e.preventDefault(); insertMention(m.inGameName) }}
                          className={cn(
                            'w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors',
                            i === mentionIndex ? 'bg-[var(--color-brand)]/15 text-[var(--color-brand)]' : 'text-[var(--color-text-primary)] hover:bg-[var(--color-bg-surface)]',
                          )}
                        >
                          <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', isOnline ? 'bg-green-500' : 'bg-[var(--color-border)]')} />
                          <span className="font-medium">{m.inGameName}</span>
                          {isOnline && <span className="ml-auto text-[10px] text-green-500 opacity-70">{t('chat.online_badge')}</span>}
                        </button>
                      )
                    })}
                  </div>
                )}

                <div className="flex gap-2">
                  {/* 봇 명령어 토글 버튼 */}
                  <button
                    onClick={() => setShowHint((v) => !v)}
                    className={cn(
                      'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors',
                      showHint
                        ? 'bg-[var(--color-brand)] text-white'
                        : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] hover:text-[var(--color-brand)]',
                    )}
                    title={t('bot.hint_label')}
                  >
                    <Bot className="w-4 h-4" />
                  </button>
                  <input
                    ref={inputRef}
                    value={input}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    placeholder={t('chat.placeholder')}
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
              </div>
            </>
          )}

          {/* 접속자 탭 */}
          {tab === 'online' && (
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
              {onlineUsers.length === 0 && (
                <p className="text-center text-xs text-[var(--color-text-muted)] mt-8">{t('chat.no_online')}</p>
              )}
              {onlineUsers.map((u) => (
                <div key={u.user_id} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-[var(--color-bg-elevated)] transition-colors">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
                  <span className={cn('text-sm font-medium', u.user_id === user.id ? 'text-[var(--color-brand)]' : 'text-[var(--color-text-primary)]')}>
                    {u.in_game_name}
                    {u.user_id === user.id && <span className="text-[10px] ml-1 opacity-60">{t('chat.me')}</span>}
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
