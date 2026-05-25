import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Eye, EyeOff, Loader2, UserX } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuthStore, PENDING_APPROVAL_ERROR, REJECTED_ERROR } from '@/infrastructure/stores/authStore'
import { Input } from '@/presentation/components/ui/input'
import { Button } from '@/presentation/components/ui/button'
import { LangSelector } from '@/presentation/components/ui/lang-selector'
import { getSessionAvatar } from '@/lib/avatars'

export const SignInPage = () => {
  const { t } = useTranslation()
  const { signIn, guestLogin, rejectMessage, clearRejectMessage } = useAuthStore()
  const navigate = useNavigate()

  const handleGuestLogin = () => {
    guestLogin()
    navigate('/', { replace: true })
  }

  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !password) return
    setLoading(true)
    setError(null)
    clearRejectMessage()
    try {
      const err = await signIn(name, password)
      if (err) {
        if (err === PENDING_APPROVAL_ERROR) {
          setError(t('auth.pending_login_error'))
        } else if (err === REJECTED_ERROR) {
          // 거절 메시지는 별도 영역에 표시 (rejectMessage 스토어 상태 사용)
          setError(t('auth.rejected_login_error'))
        } else {
          setError(t('auth.sign_in_error'))
        }
        return
      }
      navigate('/', { replace: true })
    } catch (e) {
      console.error('[SignIn] exception:', e)
      setError(t('auth.sign_in_error'))
    } finally {
      // 어떤 경로로 끝나도 spinner 풀림
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen min-h-dvh bg-[var(--color-bg-base)] flex items-center justify-center p-4">
      <div className="absolute top-4 right-4">
        <LangSelector />
      </div>
      <div className="w-full max-w-sm">
        {/* 로고 */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl overflow-hidden mb-4 shadow-xl shadow-[var(--color-brand)]/30 bg-[var(--color-bg-elevated)]">
            <img src={getSessionAvatar()} alt="ONE" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-2xl font-black text-[var(--color-text-primary)]">ONE DARK WAR</h1>
        </div>

        <form onSubmit={handleSubmit} className="bg-[var(--color-bg-surface)] rounded-2xl border border-[var(--color-border-subtle)] p-6 space-y-4">
          <div>
            <label className="text-xs font-semibold text-[var(--color-text-muted)] mb-1.5 block">{t('auth.in_game_name_label')}</label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={t('auth.in_game_name_placeholder')}
              autoFocus
              autoComplete="username"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-[var(--color-text-muted)] mb-1.5 block">{t('auth.password_label')}</label>
            <div className="relative">
              <Input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={t('auth.password_placeholder')}
                autoComplete="current-password"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-xs text-[var(--color-danger)] bg-[var(--color-danger)]/10 px-3 py-2 rounded-lg break-keep">{error}</p>
          )}

          {/* 거절 메시지 — 관리자가 거절 시 적은 안내문 */}
          {rejectMessage && (
            <div className="bg-yellow-400/10 border border-yellow-400/30 px-3 py-2.5 rounded-lg">
              <p className="text-[11px] font-semibold text-yellow-300 mb-1">{t('auth.admin_message_label')}</p>
              <p className="text-xs text-[var(--color-text-primary)] whitespace-pre-wrap leading-relaxed break-keep break-words">
                {rejectMessage}
              </p>
            </div>
          )}

          <Button type="submit" size="full" disabled={loading || !name.trim() || !password}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : t('auth.sign_in_btn')}
          </Button>
        </form>

        <p className="text-center text-sm text-[var(--color-text-muted)] mt-4">
          {t('auth.no_account')}{' '}
          <Link to="/sign-up" className="text-[var(--color-brand)] hover:underline font-medium">{t('auth.sign_up_link')}</Link>
        </p>

        <div className="relative my-4 flex items-center gap-3">
          <div className="flex-1 h-px bg-[var(--color-border-subtle)]" />
          <span className="text-xs text-[var(--color-text-muted)]">또는</span>
          <div className="flex-1 h-px bg-[var(--color-border-subtle)]" />
        </div>

        <button
          onClick={handleGuestLogin}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--color-border-subtle)] text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-bg-surface)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          <UserX className="w-4 h-4" />
          {t('auth.guest_login')}
        </button>
      </div>
    </div>
  )
}
