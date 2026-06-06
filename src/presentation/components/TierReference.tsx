import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, Table2 } from 'lucide-react'
import { useTransferTierStore } from '@/infrastructure/stores/transferTierStore'
import { TIER_COLOR_CLASS } from '@/domain/entities/TransferTier'
import { formatCp } from '@/lib/cp'
import { cn } from '@/lib/utils'

/** 이주 등급표 참조 — 합산 전투력 기준 등급 구간을 접었다 펼 수 있게 표시 */
export const TierReference = () => {
  const { t } = useTranslation()
  const { tiers, loadAll } = useTransferTierStore()
  const [open, setOpen] = useState(false)

  useEffect(() => { loadAll() }, [loadAll])

  if (tiers.length === 0) return null
  const sorted = [...tiers].sort((a, b) => a.sortOrder - b.sortOrder)
  const range = (min: number, max: number | null) =>
    `${min > 0 ? formatCp(min) : '0'} ~ ${max != null ? formatCp(max) : '∞'}`

  return (
    <div className="rounded-lg border border-[var(--color-border-subtle)] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 bg-[var(--color-bg-elevated)] text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <Table2 className="w-3.5 h-3.5" /> {t('transfer.tier_ref_title')}
        </span>
        <ChevronDown className={cn('w-4 h-4 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div>
          <div className="divide-y divide-[var(--color-border-subtle)]">
            {sorted.map((tier) => (
              <div key={tier.id} className="flex items-center gap-2 px-3 py-2 text-xs">
                <span className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0', TIER_COLOR_CLASS[tier.color].dot)} />
                <span className="font-semibold text-[var(--color-text-primary)] flex-1 min-w-0 truncate">{tier.name}</span>
                <span className="text-[var(--color-text-muted)] tabular-nums flex-shrink-0">{range(tier.minCp, tier.maxCp)}</span>
              </div>
            ))}
          </div>
          <p className="px-3 py-1.5 text-[10px] text-[var(--color-text-muted)] border-t border-[var(--color-border-subtle)]">
            {t('transfer.tier_ref_hint')}
          </p>
        </div>
      )}
    </div>
  )
}
