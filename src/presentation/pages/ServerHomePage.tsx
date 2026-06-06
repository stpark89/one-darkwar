import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  UserPlus, MessageCircleQuestion, ChevronRight, Search,
  Swords, Crown, Castle,
} from 'lucide-react'
import { getSessionAvatar } from '@/lib/avatars'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { useOccupationStore } from '@/infrastructure/stores/occupationStore'
import type { Facility } from '@/domain/entities/Occupation'
import { RecruitmentWidget } from '@/presentation/components/server/RecruitmentWidget'
import { RecentQuestionsWidget } from '@/presentation/components/server/RecentQuestionsWidget'
import { ServerEventsWidget } from '@/presentation/components/server/ServerEventsWidget'
import { AllianceWidget } from '@/presentation/components/server/AllianceWidget'

export const ServerHomePage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { isGuest } = useAuthStore()
  const { turns, loadAll } = useOccupationStore()

  useEffect(() => { loadAll() }, [loadAll])

  const currentOf = (facility: Facility) =>
    turns.find((tn) => tn.facility === facility && tn.isCurrent) ?? null
  const armory = currentOf('armory')
  const castle = currentOf('castle')

  return (
    <div className="p-4 sm:p-8 max-w-2xl mx-auto space-y-6 break-keep">
      {/* Hero */}
      <div className="text-center pt-4 sm:pt-6">
        <div className="inline-block w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden mb-4 shadow-xl bg-[var(--color-bg-elevated)]">
          <img src={getSessionAvatar()} alt="ONE" className="w-full h-full object-cover" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-[var(--color-text-primary)] mb-2 leading-tight">
          {t('server_home.hero_title')}
        </h1>
        <p className="text-sm sm:text-base text-[var(--color-text-secondary)] leading-relaxed max-w-md mx-auto px-2">
          {t('server_home.hero_subtitle')}
        </p>
      </div>

      {/* 서버 일정/이벤트 + 다음 일정 카운트다운 */}
      <ServerEventsWidget />

      {/* 점령 현황 (291 공용 정보 — 모두에게 표시) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-bold text-[var(--color-text-primary)] flex items-center gap-1.5">
            <Castle className="w-4 h-4 text-[var(--color-brand)]" /> {t('server_home.occupation_status')}
          </h2>
          <button
            onClick={() => navigate('/occupation')}
            className="flex items-center gap-0.5 text-xs text-[var(--color-brand)] hover:underline"
          >
            {t('server_home.view_all')} <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: Swords, label: t('occupation.armory'), turn: armory },
            { icon: Crown, label: t('occupation.castle'), turn: castle },
          ].map(({ icon: Icon, label, turn }) => (
            <button
              key={label}
              onClick={() => navigate('/occupation')}
              className="text-left bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-xl p-4 hover:border-[var(--color-brand)]/40 transition-colors"
            >
              <div className="flex items-center gap-1.5 text-[var(--color-text-muted)] mb-2">
                <Icon className="w-4 h-4" />
                <span className="text-xs font-semibold">{label}</span>
              </div>
              {turn ? (
                <p className="text-lg font-black text-[var(--color-text-primary)] truncate">{turn.allianceName}</p>
              ) : (
                <p className="text-sm font-semibold text-[var(--color-text-muted)]">{t('occupation.no_current')}</p>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 이주 모집 현황 */}
      <RecruitmentWidget />

      {/* 291 동맹 목록 (세력도/외교) */}
      <AllianceWidget />

      {/* 진입 CTA (게스트·멤버 공통 — 291 서버 공용 진입점) */}
      <div className="space-y-3">
        <button
          onClick={() => navigate('/transfer')}
          className="w-full group flex items-start gap-4 bg-gradient-to-br from-[var(--color-brand)] to-blue-600 text-white rounded-2xl p-5 shadow-lg hover:shadow-xl transition-all"
        >
          <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
            <UserPlus className="w-6 h-6" />
          </div>
          <div className="flex-1 text-left min-w-0">
            <div className="text-base font-bold leading-snug">{t('guest_home.cta_transfer_title')}</div>
            <div className="text-xs opacity-90 mt-1 leading-relaxed">{t('guest_home.cta_transfer_desc')}</div>
          </div>
          <ChevronRight className="w-5 h-5 flex-shrink-0 mt-1 group-hover:translate-x-1 transition-transform" />
        </button>

        <button
          onClick={() => navigate('/questions')}
          className="w-full group flex items-start gap-4 bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] text-[var(--color-text-primary)] rounded-2xl p-5 hover:border-[var(--color-brand)]/40 hover:bg-[var(--color-bg-elevated)] transition-all"
        >
          <div className="w-12 h-12 rounded-xl bg-[var(--color-brand)]/15 flex items-center justify-center flex-shrink-0">
            <MessageCircleQuestion className="w-6 h-6 text-[var(--color-brand)]" />
          </div>
          <div className="flex-1 text-left min-w-0">
            <div className="text-base font-bold leading-snug">{t('guest_home.cta_questions_title')}</div>
            <div className="text-xs text-[var(--color-text-muted)] mt-1 leading-relaxed">{t('guest_home.cta_questions_desc')}</div>
          </div>
          <ChevronRight className="w-5 h-5 text-[var(--color-text-muted)] flex-shrink-0 mt-1 group-hover:translate-x-1 transition-transform" />
        </button>

        <button
          onClick={() => navigate('/transfer/status')}
          className="w-full group flex items-start gap-4 bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] text-[var(--color-text-primary)] rounded-2xl p-5 hover:border-[var(--color-brand)]/40 hover:bg-[var(--color-bg-elevated)] transition-all"
        >
          <div className="w-12 h-12 rounded-xl bg-[var(--color-text-muted)]/15 flex items-center justify-center flex-shrink-0">
            <Search className="w-6 h-6 text-[var(--color-text-secondary)]" />
          </div>
          <div className="flex-1 text-left min-w-0">
            <div className="text-base font-bold leading-snug">{t('guest_home.cta_status_title')}</div>
            <div className="text-xs text-[var(--color-text-muted)] mt-1 leading-relaxed">{t('guest_home.cta_status_desc')}</div>
          </div>
          <ChevronRight className="w-5 h-5 text-[var(--color-text-muted)] flex-shrink-0 mt-1 group-hover:translate-x-1 transition-transform" />
        </button>

        {/* 회원가입 안내는 게스트에게만 (로그인 사용자에겐 무의미) */}
        {isGuest && (
          <p className="text-center text-xs text-[var(--color-text-muted)] leading-relaxed px-4 pt-1">
            {t('guest_home.signup_hint')}
          </p>
        )}
      </div>

      {/* 궁금한 점 최근/미답변 글 */}
      <RecentQuestionsWidget />
    </div>
  )
}
