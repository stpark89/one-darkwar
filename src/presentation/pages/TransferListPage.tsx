// 이주 신청 내역 — 게스트도 볼 수 있는 공개 조회 페이지.
// 권한 분리(다른 동맹 관리자 권한) 대신 모두 게스트로 볼 수 있게 단순화.
//
// 표시:
//  - 단체 신청: 대표자 카드 + 멤버 펼침
//  - 단독 신청: 개별 카드
//  - 거절은 RLS 가 자동 필터링 (대기/승인만)
//  - admin_message 비공개 (store.loadPublic 이 비워서 반환)

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, ChevronDown, Users, User, Clock, CheckCircle2, ChevronRight, Filter } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useTransferStore } from '@/infrastructure/stores/transferStore'
import { useTransferTierStore } from '@/infrastructure/stores/transferTierStore'
import type { DesiredAlliance, TransferApplication, TransferStatus } from '@/domain/entities/Transfer'
import { cn } from '@/lib/utils'

const ALLIANCE_FILTERS: Array<{ code: 'ALL' | DesiredAlliance; label: string }> = [
  { code: 'ALL', label: 'all' },
  { code: 'ONE', label: 'ONE' },
  { code: 'NXO', label: 'NXO' },
  { code: 'NH_D', label: 'NH-D' },
  { code: 'OTHER', label: 'other' },
]

const STATUS_META: Record<Exclude<TransferStatus, 'REJECTED'>, { icon: typeof Clock; color: string; bg: string }> = {
  PENDING: { icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-400/15' },
  APPROVED: { icon: CheckCircle2, color: 'text-[var(--color-success)]', bg: 'bg-[var(--color-success)]/15' },
}

const COUNTRY_FLAGS: Record<string, string> = {
  KR: '🇰🇷', VN: '🇻🇳', TW: '🇹🇼', CN: '🇨🇳', JP: '🇯🇵', EN: '🇺🇸', OTHER: '🌐',
}

export const TransferListPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { apps, groups, loading, loadPublic } = useTransferStore()
  const { tiers, loadAll: loadTiers } = useTransferTierStore()

  const [filter, setFilter] = useState<'ALL' | DesiredAlliance>('ALL')
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null)

  useEffect(() => {
    loadPublic(true)  // 게스트 조회용 — 매번 fresh
    loadTiers()
  }, [loadPublic, loadTiers])

  // 필터 적용 후 그룹/단독 분리
  const { groupItems, soloItems } = useMemo(() => {
    const matchAlliance = (a: { desiredAlliance: DesiredAlliance }) =>
      filter === 'ALL' || a.desiredAlliance === filter

    const filteredGroups = groups.filter(matchAlliance)
    const groupIds = new Set(filteredGroups.map((g) => g.id))

    // 그룹에 속한 신청들 (그 그룹의 멤버)
    const groupItems = filteredGroups.map((g) => {
      const members = apps.filter((a) => a.groupId === g.id)
      return { group: g, members }
    })

    // 단독 (group_id 가 없거나, 필터에 해당하는 단독)
    const soloItems = apps.filter((a) => {
      if (a.groupId) {
        // 필터된 그룹의 멤버는 위에서 표시했으니 skip
        return false
      }
      return matchAlliance(a)
    })

    // 그룹 멤버는 위 groupItems 안에서만 노출되도록 단독에서 제외
    void groupIds
    return { groupItems, soloItems }
  }, [apps, groups, filter])

  const tierName = (tierId: string | null): string | null => {
    if (!tierId) return null
    return tiers.find((tt) => tt.id === tierId)?.name ?? null
  }

  const allianceLabel = (a: DesiredAlliance, other: string) => {
    if (a === 'OTHER') return other || t('transfer.alliance_other')
    if (a === 'NH_D') return 'NH-D'
    return a
  }

  return (
    <div className="p-3 sm:p-6 max-w-3xl mx-auto space-y-4 break-keep">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-[var(--color-text-primary)]">{t('transfer_list.title')}</h1>
          <p className="text-xs sm:text-sm text-[var(--color-text-muted)] mt-0.5">{t('transfer_list.subtitle')}</p>
        </div>
        <button
          onClick={() => navigate('/transfer')}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--color-brand)] text-white text-xs sm:text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          {t('transfer_list.go_submit')}
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* 동맹 필터 */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-4 h-4 text-[var(--color-text-muted)]" />
        {ALLIANCE_FILTERS.map((f) => (
          <button
            key={f.code}
            onClick={() => setFilter(f.code)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
              filter === f.code
                ? 'bg-[var(--color-brand)] text-white'
                : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]',
            )}
          >
            {f.code === 'ALL'
              ? t('transfer_list.filter_all')
              : f.code === 'OTHER'
                ? t('transfer.alliance_other')
                : f.label}
          </button>
        ))}
      </div>

      {/* 목록 */}
      {loading && apps.length === 0 ? (
        <div className="flex items-center justify-center h-32 text-[var(--color-text-muted)]">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> {t('common.loading')}
        </div>
      ) : groupItems.length === 0 && soloItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-32 gap-2 text-[var(--color-text-muted)]">
          <Users className="w-10 h-10 opacity-30" />
          <p className="text-sm">{t('transfer_list.empty')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* 그룹 카드 */}
          {groupItems.map(({ group, members }) => {
            const isOpen = expandedGroupId === group.id
            return (
              <div key={group.id} className="bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedGroupId(isOpen ? null : group.id)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-[var(--color-bg-elevated)] transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-[var(--color-brand)]/15 flex items-center justify-center flex-shrink-0">
                    <Users className="w-5 h-5 text-[var(--color-brand)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                      {t('transfer_list.group_card_title', { leader: group.leaderName, count: members.length })}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--color-brand)]/15 text-[var(--color-brand)]">
                        {allianceLabel(group.desiredAlliance, group.desiredAllianceOther)}
                      </span>
                      <span className="text-[11px] text-[var(--color-text-muted)]">
                        {new Date(group.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <ChevronDown className={cn('w-4 h-4 text-[var(--color-text-muted)] transition-transform flex-shrink-0', isOpen && 'rotate-180')} />
                </button>
                {isOpen && (
                  <div className="border-t border-[var(--color-border-subtle)] divide-y divide-[var(--color-border-subtle)]">
                    {members.length === 0 ? (
                      <p className="px-4 py-3 text-xs text-[var(--color-text-muted)] text-center">
                        {t('transfer_list.no_visible_members')}
                      </p>
                    ) : (
                      members.map((m, i) => (
                        <ApplicantRow key={m.id} idx={i} app={m} tierName={tierName(m.tierId)} />
                      ))
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {/* 단독 카드 */}
          {soloItems.map((a) => (
            <div key={a.id} className="bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-xl">
              <div className="px-4 py-3 flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-[var(--color-bg-elevated)] flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-[var(--color-text-secondary)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{a.inGameName}</p>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--color-brand)]/15 text-[var(--color-brand)]">
                      {allianceLabel(a.desiredAlliance, a.desiredAllianceOther)}
                    </span>
                    <StatusBadge status={a.status} />
                    {tierName(a.tierId) && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)]">
                        {tierName(a.tierId)}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
                    UID: <span className="font-mono">{a.uid || '—'}</span>
                    {a.cp && <span className="ml-2">CP: {a.cp}</span>}
                    {a.country && (
                      <span className="ml-2">{COUNTRY_FLAGS[a.country] ?? ''}</span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// ApplicantRow — 그룹 안의 한 명 표시
// ─────────────────────────────────────────────────────────

interface ApplicantRowProps {
  idx: number
  app: TransferApplication
  tierName: string | null
}

const ApplicantRow = ({ idx, app, tierName }: ApplicantRowProps) => {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <span className="text-[11px] font-mono text-[var(--color-text-muted)] w-6 flex-shrink-0">#{idx + 1}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{app.inGameName}</p>
        <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5 truncate">
          UID: <span className="font-mono">{app.uid || '—'}</span>
          {app.cp && <span className="ml-2">CP {app.cp}</span>}
          {tierName && <span className="ml-2">· {tierName}</span>}
          {app.country && <span className="ml-2">{COUNTRY_FLAGS[app.country] ?? ''}</span>}
        </p>
      </div>
      <StatusBadge status={app.status} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// StatusBadge — 대기/승인만 (거절은 RLS 차단)
// ─────────────────────────────────────────────────────────

const StatusBadge = ({ status }: { status: TransferStatus }) => {
  const { t } = useTranslation()
  if (status === 'REJECTED') return null  // 안전망
  const meta = STATUS_META[status]
  const Icon = meta.icon
  return (
    <span className={cn('flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0', meta.bg, meta.color)}>
      <Icon className="w-2.5 h-2.5" />
      {t(`transfer.status_${status.toLowerCase()}`)}
    </span>
  )
}
