import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { UserPlus, MessageCircleQuestion, ChevronRight, Users, Swords } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export const GuestHomePage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [memberCount, setMemberCount] = useState<number | null>(null)
  const [roundCount, setRoundCount] = useState<number | null>(null)

  useEffect(() => {
    const load = async () => {
      const [{ count: members }, { count: rounds }] = await Promise.all([
        supabase.from('members').select('*', { count: 'exact', head: true }),
        supabase.from('war_rounds').select('*', { count: 'exact', head: true }),
      ])
      setMemberCount(members ?? 0)
      setRoundCount(rounds ?? 0)
    }
    load()
  }, [])

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

      {/* 통계 */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-xl p-4 sm:p-5 text-center">
          <div className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-[var(--color-brand)]/15 mb-2">
            <Users className="w-4 h-4 text-[var(--color-brand)]" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-[var(--color-text-primary)]">
            {memberCount ?? '—'}
          </div>
          <div className="text-[11px] sm:text-xs text-[var(--color-text-muted)] mt-0.5">
            {t('guest_home.stat_members')}
          </div>
        </div>
        <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-xl p-4 sm:p-5 text-center">
          <div className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-blue-400/15 mb-2">
            <Swords className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-[var(--color-text-primary)]">
            {roundCount ?? '—'}
          </div>
          <div className="text-[11px] sm:text-xs text-[var(--color-text-muted)] mt-0.5">
            {t('guest_home.stat_rounds')}
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
