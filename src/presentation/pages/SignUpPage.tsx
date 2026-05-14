import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Swords, Eye, EyeOff, Loader2, Clock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { Input } from '@/presentation/components/ui/input'
import { Button } from '@/presentation/components/ui/button'
import { LangSelector } from '@/presentation/components/ui/lang-selector'

export const SignUpPage = () => {
  const { t } = useTranslation()
  const { signUp } = useAuthStore()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [pending, setPending] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !password) return
    if (password !== confirm) { setError(t('auth.password_mismatch')); return }
    if (password.length < 6) { setError(t('auth.password_too_short')); return }
    setLoading(true)
    setError(null)
    const err = await signUp(name, password)
    setLoading(false)
    if (err) { setError(err); return }
    setPending(true)
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-base)] flex items-center justify-center p-4">
      <div className="absolute top-4 right-4">
        <LangSelector />
      </div>
      <div className="w-full max-w-sm">
        {/* 승인 대기 화면 */}
        {pending && (
          <div className="bg-[var(--color-bg-surface)] rounded-2xl border border-[var(--color-border-subtle)] p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-[var(--color-brand)]/15 flex items-center justify-center mx-auto mb-4">
              <Clock className="w-7 h-7 text-[var(--color-brand)]" />
            </div>
            <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-2">{t('auth.pending_title')}</h2>
            <p className="text-sm text-[var(--color-text-muted)] leading-relaxed mb-6">{t('auth.pending_desc')}</p>
            <Link
              to="/sign-in"
              className="inline-block px-6 py-2.5 rounded-xl bg-[var(--color-brand)] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              {t('auth.sign_in_link')}
            </Link>
          </div>
        )}

        {/* 로고 + 폼 */}
        {!pending && <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-[var(--color-brand)] flex items-center justify-center mb-3 shadow-lg shadow-[var(--color-brand)]/30">
            <Swords className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-black text-[var(--color-text-primary)]">ONE DARK WAR</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">{t('auth.sign_up_subtitle')}</p>
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
            <p className="text-[10px] text-[var(--color-text-muted)] mt-1">{t('auth.in_game_name_hint')}</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-[var(--color-text-muted)] mb-1.5 block">{t('auth.password_label')}</label>
            <div className="relative">
              <Input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={t('auth.password_min')}
                autoComplete="new-password"
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
          <div>
            <label className="text-xs font-semibold text-[var(--color-text-muted)] mb-1.5 block">{t('auth.confirm_password_label')}</label>
            <Input
              type={showPw ? 'text' : 'password'}
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder={t('auth.confirm_password_placeholder')}
              autoComplete="new-password"
            />
          </div>

          {error && (
            <p className="text-xs text-[var(--color-danger)] bg-[var(--color-danger)]/10 px-3 py-2 rounded-lg">{error}</p>
          )}

          <Button type="submit" size="full" disabled={loading || !name.trim() || !password || !confirm}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : t('auth.sign_up_btn')}
          </Button>
        </form>

        <p className="text-center text-sm text-[var(--color-text-muted)] mt-4">
          {t('auth.have_account')}{' '}
          <Link to="/sign-in" className="text-[var(--color-brand)] hover:underline font-medium">{t('auth.sign_in_link')}</Link>
        </p>
        </div>}
      </div>
    </div>
  )
}
