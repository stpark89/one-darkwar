import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTransferTierStore } from '@/infrastructure/stores/transferTierStore'
import { useTransferSeasonStore } from '@/infrastructure/stores/transferSeasonStore'

/**
 * 대기 인원은 이 수 이상일 때만 보인다. 1~4명은 "거의 안 온다"로 읽혀
 * 오히려 역효과라, 그보다 적으면 남은 자리 칸만 전체폭으로 둔다(사용자 결정 2026-09-30).
 */
const PENDING_SHOW_MIN = 5

/**
 * 291 서버 홈 최상단 히어로 — 게스트·멤버 공통.
 * 시안: .tasks/design/server-home-hero.html
 * 숫자는 현재 시즌 기준이다(지난 시즌이 섞이면 정원이 찬 것처럼 보인다).
 */
export const ServerHero = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { tiers, loadAll } = useTransferTierStore()
  const [counts, setCounts] = useState<{ approved: number; pending: number } | null>(null)

  useEffect(() => {
    loadAll()
    const run = async () => {
      try {
        const seasonId = await useTransferSeasonStore.getState().ensureSeasonId()
        const base = supabase.from('transfer_applications').select('status')
        const { data, error } = await (seasonId ? base.eq('season_id', seasonId) : base)
        if (error) throw error
        const rows = data ?? []
        setCounts({
          approved: rows.filter((r) => r.status === 'APPROVED').length,
          pending: rows.filter((r) => r.status === 'PENDING').length,
        })
      } catch (e) {
        console.error('[ServerHero] count error', e)
      }
    }
    run()
  }, [loadAll])

  const capacity = useMemo(() => tiers.reduce((sum, tier) => sum + (tier.capacity ?? 0), 0), [tiers])
  const remaining = counts ? Math.max(0, capacity - counts.approved) : null
  const showPending = !!counts && counts.pending >= PENDING_SHOW_MIN

  return (
    <section className="relative isolate overflow-hidden rounded-3xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-base)] px-6 pt-8 pb-6">
      {/* 헤드라인 뒤 은은한 빛 번짐 — 토큰 색을 섞어 만든다 */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 -z-10 h-[420px] w-[520px] -translate-x-1/2 blur-3xl opacity-80"
        style={{
          background:
            'radial-gradient(closest-side at 35% 45%, color-mix(in oklch, var(--color-brand) 55%, transparent), transparent 70%),' +
            'radial-gradient(closest-side at 70% 55%, color-mix(in oklch, var(--color-brand-2) 40%, transparent), transparent 70%)',
        }}
      />

      <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)]/60 py-1.5 pl-2.5 pr-3.5 text-xs font-medium text-[var(--color-text-secondary)] backdrop-blur-xl">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-success)] opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--color-success)]" />
        </span>
        {t('server_hero.badge')}
      </span>

      <h1 className="mt-5 text-[44px] sm:text-5xl font-bold leading-[1.04] tracking-[-0.045em] text-[var(--color-text-primary)]">
        {t('server_hero.title_1')}
        <br />
        <span className="bg-gradient-to-r from-[var(--color-text-primary)] via-[var(--color-brand)] to-[var(--color-brand-2)] bg-clip-text text-transparent">
          {t('server_hero.title_2')}
        </span>
      </h1>

      <p className="mt-4 whitespace-pre-line text-[15px] leading-relaxed tracking-[-0.01em] text-[var(--color-text-secondary)]">
        {t('server_hero.desc')}
      </p>

      <div
        className={`mt-7 grid overflow-hidden rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)]/50 backdrop-blur-xl ${
          showPending ? 'grid-cols-2' : 'grid-cols-1'
        }`}
      >
        <Stat value={remaining} label={t('server_hero.remaining')} />
        {showPending && (
          <div className="border-l border-[var(--color-border-subtle)]">
            <Stat value={counts!.pending} unit={t('server_hero.pending_unit')} label={t('server_hero.pending')} />
          </div>
        )}
      </div>

      <button
        onClick={() => navigate('/transfer')}
        className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--color-brand)] text-[17px] font-semibold tracking-[-0.01em] text-white transition-transform hover:opacity-90 active:scale-[0.98]"
      >
        {t('server_hero.cta')}
        <ArrowRight className="h-[18px] w-[18px]" strokeWidth={2.4} />
      </button>

      <p className="mt-3.5 text-center text-sm text-[var(--color-text-secondary)]">{t('server_hero.alliance_later')}</p>
      <p className="mt-1.5 text-center text-sm text-[var(--color-text-secondary)]">
        {t('transfer.status_link_label')}{' '}
        <button onClick={() => navigate('/transfer/status')} className="font-medium text-[var(--color-brand)] hover:underline">
          {t('transfer.status_link_btn')}
        </button>
      </p>
    </section>
  )
}

const Stat = ({ value, unit, label }: { value: number | null; unit?: string; label: string }) => (
  <div className="py-4 text-center">
    <div className="text-[26px] font-bold tabular-nums tracking-[-0.03em] text-[var(--color-text-primary)]">
      {value ?? '–'}
      {unit && value !== null && (
        <span className="text-[15px] font-semibold text-[var(--color-text-muted)]">{unit}</span>
      )}
    </div>
    <div className="mt-0.5 text-xs text-[var(--color-text-muted)]">{label}</div>
  </div>
)
