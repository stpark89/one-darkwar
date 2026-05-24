import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { UserPlus, MessageCircleQuestion, ChevronRight, Swords, Globe, Clock, Server } from 'lucide-react'

export const GuestHomePage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <div className="p-4 sm:p-8 max-w-3xl mx-auto space-y-6 sm:space-y-8">
      {/* Hero */}
      <div className="text-center pt-4 sm:pt-8">
        <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-[var(--color-brand)] mb-4 shadow-xl">
          <Swords className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-[var(--color-text-primary)] mb-2">
          {t('guest_home.hero_title')}
        </h1>
        <p className="text-sm sm:text-base text-[var(--color-text-secondary)] leading-relaxed max-w-md mx-auto">
          {t('guest_home.hero_subtitle')}
        </p>
      </div>

      {/* 동맹 소개 박스 */}
      <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-xl p-5 sm:p-6">
        <p className="text-sm sm:text-base font-semibold text-[var(--color-text-primary)] text-center mb-4 sm:mb-5">
          {t('guest_home.intro_slogan')}
        </p>
        <div className="divide-y divide-[var(--color-border-subtle)]">
          <div className="flex items-center gap-3 py-2.5">
            <div className="w-9 h-9 rounded-lg bg-[var(--color-brand)]/15 flex items-center justify-center flex-shrink-0">
              <Server className="w-4 h-4 text-[var(--color-brand)]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-[var(--color-text-muted)]">{t('guest_home.intro_server_label')}</p>
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">{t('guest_home.intro_server_value')}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 py-2.5">
            <div className="w-9 h-9 rounded-lg bg-blue-400/15 flex items-center justify-center flex-shrink-0">
              <Globe className="w-4 h-4 text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-[var(--color-text-muted)]">{t('guest_home.intro_languages_label')}</p>
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">{t('guest_home.intro_languages_value')}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 py-2.5">
            <div className="w-9 h-9 rounded-lg bg-purple-400/15 flex items-center justify-center flex-shrink-0">
              <Clock className="w-4 h-4 text-purple-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-[var(--color-text-muted)]">{t('guest_home.intro_active_label')}</p>
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">{t('guest_home.intro_active_value')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA 카드 */}
      <div className="space-y-3">
        <button
          onClick={() => navigate('/transfer')}
          className="w-full group flex items-center gap-4 bg-gradient-to-br from-[var(--color-brand)] to-blue-600 text-white rounded-2xl p-5 sm:p-6 shadow-lg hover:shadow-xl transition-all"
        >
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
            <UserPlus className="w-6 h-6 sm:w-7 sm:h-7" />
          </div>
          <div className="flex-1 text-left">
            <div className="text-base sm:text-lg font-bold">{t('guest_home.cta_transfer_title')}</div>
            <div className="text-xs sm:text-sm opacity-90 mt-0.5">{t('guest_home.cta_transfer_desc')}</div>
          </div>
          <ChevronRight className="w-5 h-5 flex-shrink-0 group-hover:translate-x-1 transition-transform" />
        </button>

        <button
          onClick={() => navigate('/questions')}
          className="w-full group flex items-center gap-4 bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] text-[var(--color-text-primary)] rounded-2xl p-5 sm:p-6 hover:border-[var(--color-brand)]/40 hover:bg-[var(--color-bg-elevated)] transition-all"
        >
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-[var(--color-brand)]/15 flex items-center justify-center flex-shrink-0">
            <MessageCircleQuestion className="w-6 h-6 sm:w-7 sm:h-7 text-[var(--color-brand)]" />
          </div>
          <div className="flex-1 text-left">
            <div className="text-base sm:text-lg font-bold">{t('guest_home.cta_questions_title')}</div>
            <div className="text-xs sm:text-sm text-[var(--color-text-muted)] mt-0.5">{t('guest_home.cta_questions_desc')}</div>
          </div>
          <ChevronRight className="w-5 h-5 text-[var(--color-text-muted)] flex-shrink-0 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>

      {/* 회원가입 안내 */}
      <div className="text-center pt-2">
        <p className="text-xs text-[var(--color-text-muted)]">{t('guest_home.signup_hint')}</p>
      </div>
    </div>
  )
}
