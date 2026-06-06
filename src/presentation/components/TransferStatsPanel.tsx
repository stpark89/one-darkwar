import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BarChart3, ChevronDown, Users, User, Ticket } from 'lucide-react'
import type { TransferApplication, ApplicationGroup, DesiredAlliance } from '@/domain/entities/Transfer'
import type { TransferTier } from '@/domain/entities/TransferTier'
import { cn } from '@/lib/utils'

interface Props {
  apps: TransferApplication[]
  groups: ApplicationGroup[]
  tiers: TransferTier[]
}

const ALLIANCE_ORDER: DesiredAlliance[] = ['ONE', 'NXO', 'NH_D', 'OTHER']
const ALLIANCE_COLORS: Record<DesiredAlliance, string> = {
  ONE: 'bg-[var(--color-brand)]',
  NXO: 'bg-emerald-500',
  NH_D: 'bg-amber-500',
  OTHER: 'bg-[var(--color-text-muted)]',
}

const allianceLabel = (a: DesiredAlliance) => (a === 'NH_D' ? 'NH-D' : a)

/**
 * 이주 신청 통계 대시보드 — 관리자 전용.
 * 요약(총 신청/단체/단독/대기) + 동맹별 분포 막대 + 그룹 현황 + 티켓 등급별 분포.
 */
export const TransferStatsPanel = ({ apps, groups, tiers }: Props) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(true)

  const stats = useMemo(() => {
    const total = apps.length
    const groupMemberCount = apps.filter((a) => a.groupId).length
    const soloCount = total - groupMemberCount
    const pending = apps.filter((a) => a.status === 'PENDING').length
    const approved = apps.filter((a) => a.status === 'APPROVED').length

    // 동맹별
    const byAlliance: Record<DesiredAlliance, number> = { ONE: 0, NXO: 0, NH_D: 0, OTHER: 0 }
    for (const a of apps) byAlliance[a.desiredAlliance] = (byAlliance[a.desiredAlliance] ?? 0) + 1

    // 그룹 현황 — 그룹별 실제 멤버 수 (apps 기준)
    const groupRows = groups
      .map((g) => ({
        group: g,
        count: apps.filter((a) => a.groupId === g.id).length,
      }))
      .filter((r) => r.count > 0)
      .sort((a, b) => b.count - a.count)

    // 티켓 등급별 (tier_id 우선, 없으면 미지정)
    const byTier = new Map<string, number>()
    let tierUnset = 0
    for (const a of apps) {
      if (a.tierId && tiers.some((tt) => tt.id === a.tierId)) {
        byTier.set(a.tierId, (byTier.get(a.tierId) ?? 0) + 1)
      } else {
        tierUnset += 1
      }
    }

    return { total, groupMemberCount, soloCount, pending, approved, byAlliance, groupRows, byTier, tierUnset }
  }, [apps, groups, tiers])

  const allianceMax = Math.max(1, ...ALLIANCE_ORDER.map((a) => stats.byAlliance[a]))

  return (
    <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-xl">
      {/* 헤더 (접기) */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3"
      >
        <h3 className="text-sm font-bold text-[var(--color-text-primary)] flex items-center gap-1.5">
          <BarChart3 className="w-4 h-4 text-[var(--color-brand)]" />
          {t('transfer_stats.title')}
        </h3>
        <ChevronDown className={cn('w-4 h-4 text-[var(--color-text-muted)] transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4">
          {/* 요약 카드 4개 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <SummaryCard label={t('transfer_stats.total')} value={stats.total} icon={<User className="w-3.5 h-3.5" />} color="text-[var(--color-text-primary)]" />
            <SummaryCard label={t('transfer_stats.groups')} value={`${stats.groupRows.length}`} sub={t('transfer_stats.group_members', { n: stats.groupMemberCount })} icon={<Users className="w-3.5 h-3.5" />} color="text-purple-400" />
            <SummaryCard label={t('transfer_stats.solo')} value={stats.soloCount} icon={<User className="w-3.5 h-3.5" />} color="text-[var(--color-text-secondary)]" />
            <SummaryCard label={t('transfer_stats.pending')} value={stats.pending} sub={t('transfer_stats.approved_n', { n: stats.approved })} color="text-yellow-400" />
          </div>

          {/* 동맹별 분포 */}
          <div>
            <p className="text-[11px] font-semibold text-[var(--color-text-muted)] mb-2">{t('transfer_stats.by_alliance')}</p>
            <div className="space-y-1.5">
              {ALLIANCE_ORDER.map((a) => {
                const v = stats.byAlliance[a]
                if (v === 0) return null
                return (
                  <div key={a} className="flex items-center gap-2">
                    <span className="w-12 text-[11px] font-semibold text-[var(--color-text-secondary)] flex-shrink-0">{allianceLabel(a)}</span>
                    <div className="flex-1 h-4 rounded bg-[var(--color-bg-elevated)] overflow-hidden">
                      <div className={cn('h-full rounded transition-all', ALLIANCE_COLORS[a])} style={{ width: `${(v / allianceMax) * 100}%` }} />
                    </div>
                    <span className="w-8 text-right text-[11px] font-bold text-[var(--color-text-primary)] flex-shrink-0">{v}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 그룹 현황 */}
          {stats.groupRows.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-[var(--color-text-muted)] mb-2 flex items-center gap-1">
                <Users className="w-3 h-3" /> {t('transfer_stats.group_status')}
              </p>
              <div className="space-y-1">
                {stats.groupRows.map(({ group, count }) => (
                  <div key={group.id} className="flex items-center gap-2 px-2 py-1.5 rounded bg-[var(--color-bg-elevated)]">
                    <span className="text-xs font-semibold text-[var(--color-text-primary)] truncate flex-1">{group.leaderName}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--color-brand)]/15 text-[var(--color-brand)]">
                      → {group.desiredAlliance === 'OTHER' ? (group.desiredAllianceOther || t('transfer.alliance_other')) : allianceLabel(group.desiredAlliance)}
                    </span>
                    <span className="text-xs font-bold text-purple-400 flex-shrink-0">{t('transfer_stats.n_people', { n: count })}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 티켓 등급별 분포 */}
          <div>
            <p className="text-[11px] font-semibold text-[var(--color-text-muted)] mb-2 flex items-center gap-1">
              <Ticket className="w-3 h-3" /> {t('transfer_stats.by_tier')}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {tiers.map((tier) => (
                <span key={tier.id} className="text-[11px] px-2 py-1 rounded bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)]">
                  {tier.name} <span className="font-bold text-[var(--color-text-primary)]">{stats.byTier.get(tier.id) ?? 0}</span>
                </span>
              ))}
              <span className="text-[11px] px-2 py-1 rounded bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)]">
                {t('transfer_stats.tier_unset')} <span className="font-bold">{stats.tierUnset}</span>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const SummaryCard = ({ label, value, sub, icon, color }: { label: string; value: string | number; sub?: string; icon?: React.ReactNode; color: string }) => (
  <div className="bg-[var(--color-bg-base)] rounded-lg p-2.5 text-center">
    <p className="text-[9px] sm:text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider flex items-center justify-center gap-1 truncate">
      {icon}{label}
    </p>
    <p className={cn('text-base sm:text-lg font-bold mt-0.5', color)}>{value}</p>
    {sub && <p className="text-[9px] text-[var(--color-text-muted)]">{sub}</p>}
  </div>
)
