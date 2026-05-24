import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { UserPlus, MessageCircleQuestion, ChevronRight, Globe, Clock, Server, Eye } from 'lucide-react'
import { getSessionAvatar } from '@/lib/avatars'
import { useAuthStore } from '@/infrastructure/stores/authStore'

export const GuestHomePage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { enterTourMode } = useAuthStore()

  const handleStartTour = () => {
    enterTourMode()
    navigate('/notices')
  }

  return (
    <div className="p-4 sm:p-8 max-w-2xl mx-auto space-y-6 sm:space-y-8 break-keep">
      {/* Hero */}
      <div className="text-center pt-4 sm:pt-8">
        <div className="inline-block w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden mb-5 shadow-xl bg-[var(--color-bg-elevated)]">
          <img src={getSessionAvatar()} alt="ONE" className="w-full h-full object-cover" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-[var(--color-text-primary)] mb-3 leading-tight">
          {t('guest_home.hero_title')}
        </h1>
        <p className="text-sm sm:text-base text-[var(--color-text-secondary)] leading-relaxed max-w-md mx-auto px-2">
          {t('guest_home.hero_subtitle')}
        </p>
      </div>

      {/* 동맹 소개 박스 */}
      <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-xl p-5 sm:p-6">
        <p className="text-sm sm:text-base font-semibold text-[var(--color-text-primary)] text-center mb-4 sm:mb-5 leading-snug">
          {t('guest_home.intro_slogan')}
        </p>
        <div className="divide-y divide-[var(--color-border-subtle)]">
          <div className="flex items-start gap-3 py-3">
            <div className="w-9 h-9 rounded-lg bg-[var(--color-brand)]/15 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Server className="w-4 h-4 text-[var(--color-brand)]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-[var(--color-text-muted)] mb-0.5">{t('guest_home.intro_server_label')}</p>
              <p className="text-sm font-semibold text-[var(--color-text-primary)] leading-snug">{t('guest_home.intro_server_value')}</p>
            </div>
          </div>
          <div className="flex items-start gap-3 py-3">
            <div className="w-9 h-9 rounded-lg bg-blue-400/15 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Globe className="w-4 h-4 text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-[var(--color-text-muted)] mb-0.5">{t('guest_home.intro_languages_label')}</p>
              <p className="text-sm font-semibold text-[var(--color-text-primary)] leading-snug">{t('guest_home.intro_languages_value')}</p>
            </div>
          </div>
          <div className="flex items-start gap-3 py-3">
            <div className="w-9 h-9 rounded-lg bg-purple-400/15 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Clock className="w-4 h-4 text-purple-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-[var(--color-text-muted)] mb-0.5">{t('guest_home.intro_active_label')}</p>
              <p className="text-sm font-semibold text-[var(--color-text-primary)] leading-snug">{t('guest_home.intro_active_value')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA 카드 */}
      <div className="space-y-3">
        {/* ONE 둘러보기 — 실제 서비스 페이지를 read-only 로 진입 */}
        <button
          onClick={handleStartTour}
          className="w-full group flex items-start gap-4 bg-gradient-to-br from-purple-600 to-fuchsia-500 text-white rounded-2xl p-5 sm:p-6 shadow-lg hover:shadow-xl transition-all"
        >
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
            <Eye className="w-6 h-6 sm:w-7 sm:h-7" />
          </div>
          <div className="flex-1 text-left min-w-0">
            <div className="text-base sm:text-lg font-bold leading-snug">{t('guest_home.cta_tour_title')}</div>
            <div className="text-xs sm:text-sm opacity-90 mt-1 leading-relaxed">{t('guest_home.cta_tour_desc')}</div>
          </div>
          <ChevronRight className="w-5 h-5 flex-shrink-0 mt-1 group-hover:translate-x-1 transition-transform" />
        </button>

        <button
          onClick={() => navigate('/transfer')}
          className="w-full group flex items-start gap-4 bg-gradient-to-br from-[var(--color-brand)] to-blue-600 text-white rounded-2xl p-5 sm:p-6 shadow-lg hover:shadow-xl transition-all"
        >
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
            <UserPlus className="w-6 h-6 sm:w-7 sm:h-7" />
          </div>
          <div className="flex-1 text-left min-w-0">
            <div className="text-base sm:text-lg font-bold leading-snug">{t('guest_home.cta_transfer_title')}</div>
            <div className="text-xs sm:text-sm opacity-90 mt-1 leading-relaxed">{t('guest_home.cta_transfer_desc')}</div>
          </div>
          <ChevronRight className="w-5 h-5 flex-shrink-0 mt-1 group-hover:translate-x-1 transition-transform" />
        </button>

        <button
          onClick={() => navigate('/questions')}
          className="w-full group flex items-start gap-4 bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] text-[var(--color-text-primary)] rounded-2xl p-5 sm:p-6 hover:border-[var(--color-brand)]/40 hover:bg-[var(--color-bg-elevated)] transition-all"
        >
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-[var(--color-brand)]/15 flex items-center justify-center flex-shrink-0">
            <MessageCircleQuestion className="w-6 h-6 sm:w-7 sm:h-7 text-[var(--color-brand)]" />
          </div>
          <div className="flex-1 text-left min-w-0">
            <div className="text-base sm:text-lg font-bold leading-snug">{t('guest_home.cta_questions_title')}</div>
            <div className="text-xs sm:text-sm text-[var(--color-text-muted)] mt-1 leading-relaxed">{t('guest_home.cta_questions_desc')}</div>
          </div>
          <ChevronRight className="w-5 h-5 text-[var(--color-text-muted)] flex-shrink-0 mt-1 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>

      {/* 회원가입 안내 */}
      <div className="text-center pt-2">
        <p className="text-xs text-[var(--color-text-muted)] leading-relaxed px-4">{t('guest_home.signup_hint')}</p>
      </div>
    </div>
  )
}
