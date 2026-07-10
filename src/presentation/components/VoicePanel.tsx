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

export const VoicePanel = ({
  isInVoice, isMuted, isSpeaking, voiceUsers, micError, myId, onJoin, onLeave, onToggleMute,
}: VoicePanelProps) => {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* 참여자 목록 */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
        {voiceUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2 text-[var(--color-text-muted)]">
            <Mic className="w-7 h-7 opacity-25" />
            <p className="text-xs">현재 음성채팅 참여자가 없습니다</p>
            <p className="text-[10px] opacity-60">아래 버튼을 눌러 참여하세요</p>
          </div>
        ) : (
          <>
            <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider px-1 mb-2">
              참여중 {voiceUsers.length}명
            </p>
            {voiceUsers.map((u) => {
              const isMe = u.id === myId
              const speaking = isMe && isSpeaking && !isMuted
              return (
                <div
                  key={u.id}
                  className={cn(
                    'flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all',
                    isMe
                      ? speaking
                        ? 'bg-green-500/15 border border-green-500/40'
                        : 'bg-[var(--color-brand)]/10 border border-[var(--color-brand)]/20'
                      : 'bg-[var(--color-bg-elevated)]',
                  )}
                >
                  {/* 음성 활동 표시 */}
                  <span className="relative flex-shrink-0 w-4 h-4 flex items-center justify-center">
                    {isMe && isMuted ? (
                      <MicOff className="w-3.5 h-3.5 text-red-400" />
                    ) : (
                      <>
                        <span className={cn(
                          'w-2 h-2 rounded-full block',
                          speaking ? 'bg-green-400' : 'bg-green-400/50',
                        )} />
                        {speaking && (
                          <span className="absolute inset-0 w-2 h-2 m-auto rounded-full bg-green-400 animate-ping" />
                        )}
                      </>
                    )}
                  </span>
                  <span className={cn(
                    'text-sm font-medium truncate flex-1',
                    isMe
                      ? speaking ? 'text-green-400' : 'text-[var(--color-brand)]'
                      : 'text-[var(--color-text-primary)]',
                  )}>
                    {u.name}
                    {isMe && <span className="text-[10px] ml-1.5 opacity-60">(나)</span>}
                  </span>
                  {isMe && speaking && (
                    <span className="text-[10px] text-green-400 font-semibold flex-shrink-0">말하는 중</span>
                  )}
                  {isMe && isMuted && (
                    <span className="text-[10px] text-red-400 font-semibold flex-shrink-0">음소거</span>
                  )}
                </div>
              )
            })}
          </>
        )}

        {/* 마이크 오류 */}
        {micError && (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 mt-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-400">{micError}</p>
          </div>
        )}
      </div>

      {/* 컨트롤 버튼 */}
      <div className="px-3 py-3 border-t border-[var(--color-border-subtle)] flex gap-2">
        {isInVoice ? (
          <>
            <button
              onClick={onToggleMute}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-colors',
                isMuted
                  ? 'bg-red-500/15 text-red-400 hover:bg-red-500/25'
                  : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] hover:bg-[var(--color-border)]',
              )}
            >
              {isMuted
                ? <><MicOff className="w-3.5 h-3.5" /> 음소거</>
                : <><Mic className="w-3.5 h-3.5" /> 마이크</>
              }
            </button>
            <button
              onClick={onLeave}
              className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors"
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
