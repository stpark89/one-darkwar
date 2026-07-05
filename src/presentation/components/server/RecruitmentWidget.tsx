import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Ticket, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTransferTierStore, findTierForCp } from '@/infrastructure/stores/transferTierStore'
import { TIER_COLOR_CLASS } from '@/domain/entities/TransferTier'
import { parseCp } from '@/lib/cp'
import { cn } from '@/lib/utils'

/**
 * 이주 모집 현황 — 시즌 티켓 등급별 승인 인원 / 정원.
 * 공유 transferStore 를 건드리지 않도록 자체 집계 쿼리를 사용한다.
 * (transfer_applications 의 PENDING/APPROVED 는 공개 SELECT 가능 — RLS)
 */
export const RecruitmentWidget = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { tiers, loadAll } = useTransferTierStore()
  // 승인된 신청의 (tier_id, total_power) 원본 — 등급 매칭은 tiers 로드 후 계산
  const [approvedRows, setApprovedRows] = useState<{ tierId: string | null; totalPower: string }[]>([])

  useEffect(() => {
    loadAll()
    const run = async () => {
      try {
        const { data, error } = await supabase
          .from('transfer_applications')
          .select('tier_id, total_power, status')
        if (error) throw error
        setApprovedRows(
          (data ?? [])
            .filter((r) => r.status === 'APPROVED')
            .map((r) => ({ tierId: r.tier_id ?? null, totalPower: r.total_power ?? '' })),
        )
      } catch (e) {
        console.error('[RecruitmentWidget] count error', e)
      }
    }
    run()
  }, [loadAll])

  // 등급별 승인 인원 — tier_id(관리자 지정) 우선, 없으면 Migration Score 매칭
  // (관리자/이주 내역 집계와 동일 로직으로 통일)
  const counts = useMemo(() => {
    const map: Record<string, number> = {}
    for (const r of approvedRows) {
      const tier = r.tierId
        ? tiers.find((tt) => tt.id === r.tierId) ?? null
        : r.totalPower.trim() ? findTierForCp(tiers, parseCp(r.totalPower)) : null
      if (tier) map[tier.id] = (map[tier.id] ?? 0) + 1
    }
    return map
  }, [approvedRows, tiers])

  const sorted = [...tiers].sort((a, b) => a.sortOrder - b.sortOrder)
  if (sorted.length === 0) return null

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-bold text-[var(--color-text-primary)] flex items-center gap-1.5">
          <Ticket className="w-4 h-4 text-[var(--color-brand)]" /> {t('server_home.recruitment')}
        </h2>
        <button
          onClick={() => navigate('/transfer')}
          className="flex items-center gap-0.5 text-xs text-[var(--color-brand)] hover:underline"
        >
          {t('server_home.apply_now')} <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="space-y-2.5 bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-xl p-4">
        {sorted.map((tier) => {
          const filled = counts[tier.id] ?? 0
          const hasCap = tier.capacity > 0
          const pct = hasCap ? Math.min(100, Math.round((filled / tier.capacity) * 100)) : 0
          const cls = TIER_COLOR_CLASS[tier.color]
          return (
            <div key={tier.id}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="flex items-center gap-1.5 min-w-0">
                  <span className={cn('w-2 h-2 rounded-full flex-shrink-0', cls.dot)} />
                  <span className="font-semibold text-[var(--color-text-primary)] truncate">{tier.name}</span>
                </span>
                <span className="text-[var(--color-text-muted)] flex-shrink-0 tabular-nums">
                  {hasCap ? `${filled} / ${tier.capacity}` : t('server_home.applied_count', { count: filled })}
                </span>
              </div>
              {hasCap && (
                <div className="h-1.5 rounded-full bg-[var(--color-bg-elevated)] overflow-hidden">
                  <div className={cn('h-full rounded-full transition-all', cls.bar)} style={{ width: `${pct}%` }} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
