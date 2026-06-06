import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Ticket, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTransferTierStore } from '@/infrastructure/stores/transferTierStore'
import { TIER_COLOR_CLASS } from '@/domain/entities/TransferTier'
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
  const [counts, setCounts] = useState<Record<string, number>>({}) // tierId -> 승인 수

  useEffect(() => {
    loadAll()
    const run = async () => {
      try {
        const { data, error } = await supabase
          .from('transfer_applications')
          .select('tier_id, status')
        if (error) throw error
        const map: Record<string, number> = {}
        for (const r of data ?? []) {
          if (r.status === 'APPROVED' && r.tier_id) {
            map[r.tier_id] = (map[r.tier_id] ?? 0) + 1
          }
        }
        setCounts(map)
      } catch (e) {
        console.error('[RecruitmentWidget] count error', e)
      }
    }
    run()
  }, [loadAll])

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
