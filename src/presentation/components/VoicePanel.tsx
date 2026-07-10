import { Mic, MicOff, PhoneOff, PhoneCall, AlertCircle } from 'lucide-react'
import type { VoiceUser } from '@/hooks/useVoiceChat'
import { cn } from '@/lib/utils'

interface VoicePanelProps {
  isInVoice: boolean
  isMuted: boolean
  isSpeaking: boolean
  voiceUsers: VoiceUser[]
  micError: string | null
  myId: string
  onJoin: () => void
  onLeave: () => void
  onToggleMute: () => void
}

// userId 기반 일관된 색상 — 같은 사람은 항상 같은 색
const AVATAR_COLORS = [
  ['#3b82f6', '#1d4ed8'], // blue
  ['#8b5cf6', '#6d28d9'], // violet
  ['#ec4899', '#be185d'], // pink
  ['#f59e0b', '#b45309'], // amber
  ['#10b981', '#047857'], // emerald
  ['#06b6d4', '#0e7490'], // cyan
  ['#f97316', '#c2410c'], // orange
  ['#6366f1', '#4338ca'], // indigo
]

const getAvatarColor = (id: string) => {
  const hash = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

const getInitials = (name: string) =>
  name.trim().slice(0, 2).toUpperCase() || '?'

const UserAvatar = ({
  user,
  isMe,
  isMuted,
  isSpeaking,
}: {
  user: VoiceUser
  isMe: boolean
  isMuted: boolean
  isSpeaking: boolean
}) => {
  const [from, to] = getAvatarColor(user.id)
  const speaking = isMe ? isSpeaking && !isMuted : false

  return (
    <div className="flex flex-col items-center gap-2">
      {/* 아바타 링 + 이미지 */}
      <div className="relative">
        {/* 말하는 중 — 바깥 링 pulse */}
        {speaking && (
          <span
            className="absolute inset-0 rounded-full animate-ping"
            style={{ background: 'rgba(74,222,128,0.35)', margin: '-5px' }}
          />
        )}
        {/* 테두리 링 */}
        <div
          className={cn(
            'rounded-full p-[3px] transition-all duration-200',
            speaking
              ? 'shadow-[0_0_0_2px_#4ade80]'
              : isMe
                ? 'shadow-[0_0_0_2px_var(--color-brand)]'
                : 'shadow-[0_0_0_1.5px_rgba(255,255,255,0.12)]',
          )}
        >
          {/* 아바타 원 */}
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm select-none"
            style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
          >
            {getInitials(user.name)}
          </div>
        </div>

        {/* 음소거 오버레이 */}
        {isMe && isMuted && (
          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 flex items-center justify-center shadow-md">
            <MicOff className="w-2.5 h-2.5 text-white" />
          </div>
        )}

        {/* 말하는 중 표시 */}
        {speaking && (
          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-green-500 flex items-center justify-center shadow-md">
            <Mic className="w-2.5 h-2.5 text-white" />
          </div>
        )}
      </div>

      {/* 이름 */}
      <div className="text-center max-w-[72px]">
        <p
          className={cn(
            'text-xs font-semibold truncate',
            speaking
              ? 'text-green-400'
              : isMe
                ? 'text-[var(--color-brand)]'
                : 'text-[var(--color-text-primary)]',
          )}
        >
          {user.name}
        </p>
        {isMe && (
          <p className="text-[9px] text-[var(--color-text-muted)] mt-0.5">나</p>
        )}
      </div>
    </div>
  )
}

export const VoicePanel = ({
  isInVoice,
  isMuted,
  isSpeaking,
  voiceUsers,
  micError,
  myId,
  onJoin,
  onLeave,
  onToggleMute,
}: VoicePanelProps) => {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* 참여자 그리드 */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {voiceUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-3 text-[var(--color-text-muted)]">
            <div className="w-16 h-16 rounded-full bg-[var(--color-bg-elevated)] flex items-center justify-center">
              <Mic className="w-7 h-7 opacity-20" />
            </div>
            <div className="text-center">
              <p className="text-xs font-medium">음성채팅 참여자 없음</p>
              <p className="text-[10px] opacity-50 mt-0.5">아래 버튼을 눌러 참여하세요</p>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-4">
              참여중 {voiceUsers.length}명
            </p>
            <div className="flex flex-wrap gap-5 justify-start">
              {voiceUsers.map((u) => (
                <UserAvatar
                  key={u.id}
                  user={u}
                  isMe={u.id === myId}
                  isMuted={isMuted}
                  isSpeaking={isSpeaking}
                />
              ))}
            </div>
          </div>
        )}

        {micError && (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 mt-4">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-400">{micError}</p>
          </div>
        )}
      </div>

      {/* 컨트롤 */}
      <div className="px-3 py-3 border-t border-[var(--color-border-subtle)] flex gap-2">
        {isInVoice ? (
          <>
            <button
              onClick={onToggleMute}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-colors',
                isMuted
                  ? 'bg-red-500/15 text-red-400 hover:bg-red-500/25'
                  : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] hover:bg-[var(--color-border)]',
              )}
            >
              {isMuted ? <><MicOff className="w-3.5 h-3.5" /> 음소거 해제</> : <><Mic className="w-3.5 h-3.5" /> 마이크</>}
            </button>
            <button
              onClick={onLeave}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors"
            >
              <PhoneOff className="w-3.5 h-3.5" /> 나가기
            </button>
          </>
        ) : (
          <button
            onClick={onJoin}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-green-500/15 text-green-400 hover:bg-green-500/25 transition-colors border border-green-500/20"
          >
            <PhoneCall className="w-4 h-4" /> 음성채팅 참여
          </button>
        )}
      </div>
    </div>
  )
}
