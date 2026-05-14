import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Search, TrendingUp, TrendingDown, Minus, X, Loader2, Swords, CalendarDays } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useWarStore } from '@/infrastructure/stores/warStore'
import { useEventStore } from '@/infrastructure/stores/eventStore'
import { useMemberStore } from '@/infrastructure/stores/memberStore'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { Input } from '@/presentation/components/ui/input'
import { SortIcon, nextSortDir } from '@/presentation/components/ui/sort-icon'
import type { SortDir } from '@/presentation/components/ui/sort-icon'
import { cn } from '@/lib/utils'

type Trend = 'up' | 'down' | 'stable' | 'none'

interface ContribRow {
  memberId: string
  inGameName: string
  warTotal: number
  warCT: number
  warDB: number
  eventTotal: number
  eventCT: number
  eventDB: number
  total: number
  trend: Trend
  trendDelta: number
}

interface RoundDetail {
  label: string
  date: string
  team: string
  role: string
}

interface EventDetail {
  label: string
  date: string
  status: string
}

interface MemberDetail {
  row: ContribRow
  warDetails: RoundDetail[]
  eventDetails: EventDetail[]
  warFirstHalf: number
  warSecondHalf: number
  eventFirstHalf: number
  eventSecondHalf: number
}

function calcTrend(firstRate: number, secondRate: number, hasData: boolean): Trend {
  if (!hasData) return 'none'
  const delta = secondRate - firstRate
  if (delta > 0.15) return 'up'
  if (delta < -0.15) return 'down'
  return 'stable'
}

export const ContributionPage = () => {
  const { user } = useAuthStore()
  if (user?.role !== 'ROLE_ADMIN') return <Navigate to="/members" replace />

  const { t } = useTranslation()
  const { rounds, entries, members: warMembers, loadData: loadWar, loading: warLoading } = useWarStore()
  const { events, attendance, loadData: loadEvent, loading: eventLoading } = useEventStore()
  const { loadMembers } = useMemberStore()

  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<keyof ContribRow>('total')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [detail, setDetail] = useState<MemberDetail | null>(null)

  useEffect(() => {
    loadWar()
    loadEvent()
    loadMembers()
  }, [loadWar, loadEvent, loadMembers])

  const loading = warLoading || eventLoading

  // 회차 정렬 (sort_order 기준)
  const sortedRounds = [...rounds].sort((a, b) => a.sortOrder - b.sortOrder)
  const midRound = Math.ceil(sortedRounds.length / 2)
  const firstRounds = sortedRounds.slice(0, midRound)
  const secondRounds = sortedRounds.slice(midRound)

  // 이벤트 정렬 (순서 유지)
  const midEvent = Math.ceil(events.length / 2)
  const firstEvents = events.slice(0, midEvent)
  const secondEvents = events.slice(midEvent)

  // 기여도 데이터 빌드
  const rows: ContribRow[] = warMembers.map(m => {
    const myEntries = entries.filter(e => e.memberId === m.id)
    const warCT = myEntries.filter(e => e.role === 'CT').length
    const warDB = myEntries.filter(e => e.role === 'DB').length
    const warTotal = warCT + warDB

    const myAtt = attendance.find(a => a.memberId === m.id)
    const attValues = myAtt ? Object.values(myAtt.records) : []
    const eventCT = attValues.filter(v => v === 'CT').length
    const eventDB = attValues.filter(v => v === 'DB').length
    const eventTotal = eventCT + eventDB

    // 트렌드 계산
    const w1 = firstRounds.length > 0
      ? myEntries.filter(e => firstRounds.some(r => r.id === e.roundId)).length / firstRounds.length
      : 0
    const w2 = secondRounds.length > 0
      ? myEntries.filter(e => secondRounds.some(r => r.id === e.roundId)).length / secondRounds.length
      : 0
    const e1 = firstEvents.length > 0
      ? firstEvents.filter(ev => myAtt?.records[ev.eventKey] && myAtt.records[ev.eventKey] !== '').length / firstEvents.length
      : 0
    const e2 = secondEvents.length > 0
      ? secondEvents.filter(ev => myAtt?.records[ev.eventKey] && myAtt.records[ev.eventKey] !== '').length / secondEvents.length
      : 0

    const hasData = (warTotal + eventTotal) > 0
    const combinedFirst = (w1 + e1) / 2
    const combinedSecond = (w2 + e2) / 2
    const trend = calcTrend(combinedFirst, combinedSecond, hasData)
    const trendDelta = Math.round((combinedSecond - combinedFirst) * 100)

    return { memberId: m.id, inGameName: m.inGameName, warTotal, warCT, warDB, eventTotal, eventCT, eventDB, total: warTotal + eventTotal, trend, trendDelta }
  })

  const handleSort = (key: keyof ContribRow) => {
    if (key !== sortKey) { setSortKey(key); setSortDir('desc'); return }
    const next = nextSortDir(sortDir, true)
    setSortDir(next)
    if (next === null) { setSortKey('total'); setSortDir('desc') }
  }

  const filtered = rows
    .filter(r => !search || r.inGameName.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (!sortDir) return 0
      const va = a[sortKey] as number | string
      const vb = b[sortKey] as number | string
      const cmp = typeof va === 'string' ? (va as string).localeCompare(vb as string) : (va as number) - (vb as number)
      return sortDir === 'asc' ? cmp : -cmp
    })

  const openDetail = (row: ContribRow) => {
    const myEntries = entries.filter(e => e.memberId === row.memberId)
    const myAtt = attendance.find(a => a.memberId === row.memberId)

    const warDetails: RoundDetail[] = sortedRounds.map(r => {
      const e = myEntries.find(en => en.roundId === r.id)
      return { label: t('war.round', { n: r.sortOrder }), date: r.date?.slice(5) ?? '', team: e?.team ?? '', role: e?.role ?? '' }
    })

    const eventDetails: EventDetail[] = events.map(e => ({
      label: e.name.length > 10 ? e.name.slice(0, 10) + '…' : e.name,
      date: e.date?.slice(5) ?? '',
      status: myAtt?.records[e.eventKey] ?? '',
    }))

    const w1 = firstRounds.length > 0
      ? myEntries.filter(e => firstRounds.some(r => r.id === e.roundId)).length / firstRounds.length
      : 0
    const w2 = secondRounds.length > 0
      ? myEntries.filter(e => secondRounds.some(r => r.id === e.roundId)).length / secondRounds.length
      : 0
    const e1 = firstEvents.length > 0
      ? firstEvents.filter(ev => myAtt?.records[ev.eventKey] && myAtt.records[ev.eventKey] !== '').length / firstEvents.length
      : 0
    const e2 = secondEvents.length > 0
      ? secondEvents.filter(ev => myAtt?.records[ev.eventKey] && myAtt.records[ev.eventKey] !== '').length / secondEvents.length
      : 0

    setDetail({ row, warDetails, eventDetails, warFirstHalf: w1, warSecondHalf: w2, eventFirstHalf: e1, eventSecondHalf: e2 })
  }

  const TrendBadge = ({ trend, delta }: { trend: Trend; delta: number }) => {
    if (trend === 'none') return <span className="text-[var(--color-text-muted)] text-xs">—</span>
    if (trend === 'up') return (
      <span className="flex items-center gap-0.5 text-[var(--color-success)] text-xs font-semibold">
        <TrendingUp className="w-3.5 h-3.5" /> +{delta}%
      </span>
    )
    if (trend === 'down') return (
      <span className="flex items-center gap-0.5 text-[var(--color-danger)] text-xs font-semibold">
        <TrendingDown className="w-3.5 h-3.5" /> {delta}%
      </span>
    )
    return <span className="flex items-center gap-0.5 text-[var(--color-text-muted)] text-xs"><Minus className="w-3.5 h-3.5" /> 0%</span>
  }

  const th = (key: keyof ContribRow, label: string, center = false) => (
    <th
      onClick={() => handleSort(key)}
      className={cn(
        'px-3 py-3 text-xs font-semibold text-[var(--color-text-muted)] whitespace-nowrap cursor-pointer select-none hover:text-[var(--color-text-primary)] transition-colors',
        center ? 'text-center' : 'text-left',
      )}
    >
      {label}<SortIcon dir={sortKey === key ? sortDir : null} />
    </th>
  )

  if (loading && rows.length === 0) return (
    <div className="flex items-center justify-center h-64 text-[var(--color-text-muted)]">
      <Loader2 className="w-5 h-5 animate-spin mr-2" /> {t('common.loading')}
    </div>
  )

  return (
    <div className="p-3 sm:p-6">
      <div className="mb-3 sm:mb-5">
        <h1 className="text-lg sm:text-xl font-bold text-[var(--color-text-primary)]">{t('contribution.title')}</h1>
        <p className="text-xs sm:text-sm text-[var(--color-text-muted)] mt-0.5">{t('contribution.subtitle', { count: filtered.length })}</p>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('contribution.search_placeholder')} className="pl-9" />
      </div>

      <div className="rounded-lg border border-[var(--color-border-subtle)] overflow-auto max-h-[calc(100vh-240px)]">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-[var(--color-bg-surface)] border-b border-[var(--color-border-subtle)]">
              <th className="px-3 py-3 text-center text-xs font-semibold text-[var(--color-text-muted)] w-10">{t('contribution.col_rank')}</th>
              {th('inGameName', t('contribution.col_name'))}
              {th('warTotal', t('contribution.col_war'), true)}
              {th('eventTotal', t('contribution.col_event'), true)}
              {th('total', t('contribution.col_total'), true)}
              <th className="px-3 py-3 text-center text-xs font-semibold text-[var(--color-text-muted)] whitespace-nowrap">{t('contribution.col_trend')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border-subtle)]">
            {filtered.map((row, i) => (
              <tr
                key={row.memberId}
                onClick={() => openDetail(row)}
                className="hover:bg-[var(--color-bg-surface)] transition-colors cursor-pointer"
              >
                <td className="px-3 py-2.5 text-center">
                  <span className={cn('text-sm font-black',
                    i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-amber-600' : 'text-[var(--color-text-muted)]'
                  )}>
                    {i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}
                  </span>
                </td>
                <td className="px-3 py-2.5 font-medium text-[var(--color-text-primary)]">{row.inGameName}</td>
                <td className="px-3 py-2.5 text-center">
                  <span className="font-bold text-blue-400">{row.warTotal}</span>
                </td>
                <td className="px-3 py-2.5 text-center">
                  <span className="font-bold text-[var(--color-success)]">{row.eventTotal}</span>
                </td>
                <td className="px-3 py-2.5 text-center">
                  <span className="font-bold text-[var(--color-brand)] text-base">{row.total}</span>
                </td>
                <td className="px-3 py-2.5 text-center">
                  <TrendBadge trend={row.trend} delta={row.trendDelta} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 멤버 상세 모달 */}
      {detail && (
        <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 sm:p-4">
          <div className="bg-[var(--color-bg-surface)] rounded-t-2xl sm:rounded-xl border border-[var(--color-border)] w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* 헤더 */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-[var(--color-border-subtle)]">
              <div className="flex items-center gap-3 flex-wrap">
                <div>
                  <h2 className="text-base font-bold text-[var(--color-text-primary)]">{detail.row.inGameName}</h2>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                    {t('contribution.total_label', { total: detail.row.total })} · {t('contribution.war_label', { n: detail.row.warTotal })} · {t('contribution.event_label', { n: detail.row.eventTotal })}
                  </p>
                </div>
                <div>
                  {detail.row.trend === 'up' && <span className="flex items-center gap-1 text-[var(--color-success)] text-sm font-bold"><TrendingUp className="w-4 h-4" />{t('contribution.trend_up')}</span>}
                  {detail.row.trend === 'down' && <span className="flex items-center gap-1 text-[var(--color-danger)] text-sm font-bold"><TrendingDown className="w-4 h-4" />{t('contribution.trend_down')}</span>}
                  {detail.row.trend === 'stable' && <span className="flex items-center gap-1 text-[var(--color-text-muted)] text-sm"><Minus className="w-4 h-4" />{t('contribution.trend_stable')}</span>}
                </div>
              </div>
              <button onClick={() => setDetail(null)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] flex-shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-4 sm:px-6 py-4 sm:py-5 space-y-5 sm:space-y-6">
              {/* 추세 비교 카드 */}
              <div className="grid grid-cols-2 gap-3">
                <TrendCard
                  icon={<Swords className="w-4 h-4" />}
                  label={t('contribution.war_trend_label')}
                  first={detail.warFirstHalf}
                  second={detail.warSecondHalf}
                  firstLabel={t('contribution.half_first', { n: firstRounds.length })}
                  secondLabel={t('contribution.half_second', { n: secondRounds.length })}
                />
                <TrendCard
                  icon={<CalendarDays className="w-4 h-4" />}
                  label={t('contribution.event_trend_label')}
                  first={detail.eventFirstHalf}
                  second={detail.eventSecondHalf}
                  firstLabel={t('contribution.half_first', { n: firstEvents.length })}
                  secondLabel={t('contribution.half_second', { n: secondEvents.length })}
                />
              </div>

              {/* 전쟁 참가 히스토리 */}
              {detail.warDetails.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-[var(--color-text-muted)] mb-3 flex items-center gap-1.5">
                    <Swords className="w-3.5 h-3.5" /> {t('contribution.war_history')}
                  </h3>
                  <div className="flex gap-2 flex-wrap">
                    {detail.warDetails.map((d, i) => {
                      const participated = !!(d.team && d.role)
                      return (
                        <div key={i} className="flex flex-col items-center gap-1">
                          <div className={cn(
                            'w-12 h-12 rounded-lg flex items-center justify-center text-[10px] font-bold border',
                            participated
                              ? 'bg-[var(--color-success)]/15 text-[var(--color-success)] border-[var(--color-success)]/30'
                              : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] border-[var(--color-border-subtle)]',
                          )}>
                            {participated ? '✓' : <span className="text-lg">·</span>}
                          </div>
                          <span className="text-[9px] text-[var(--color-text-muted)] text-center leading-tight">{d.label}<br />{d.date}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* 이벤트 출석 히스토리 */}
              {detail.eventDetails.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-[var(--color-text-muted)] mb-3 flex items-center gap-1.5">
                    <CalendarDays className="w-3.5 h-3.5" /> {t('contribution.event_history')}
                  </h3>
                  <div className="flex gap-2 flex-wrap">
                    {detail.eventDetails.map((d, i) => {
                      const participated = d.status === 'CT' || d.status === 'DB'
                      return (
                        <div key={i} className="flex flex-col items-center gap-1">
                          <div className={cn(
                            'w-12 h-12 rounded-lg flex items-center justify-center text-[10px] font-bold border',
                            participated
                              ? 'bg-[var(--color-success)]/15 text-[var(--color-success)] border-[var(--color-success)]/30'
                              : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] border-[var(--color-border-subtle)]',
                          )}>
                            {participated ? '✓' : <span className="text-lg">·</span>}
                          </div>
                          <span className="text-[9px] text-[var(--color-text-muted)] text-center leading-tight w-12 truncate">{d.label}<br />{d.date}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TrendCard({ icon, label, first, second, firstLabel, secondLabel }: {
  icon: React.ReactNode
  label: string
  first: number
  second: number
  firstLabel: string
  secondLabel: string
}) {
  const { t } = useTranslation()
  const delta = second - first
  const isUp = delta > 0.05
  const isDown = delta < -0.05

  return (
    <div className="bg-[var(--color-bg-elevated)] rounded-lg p-4 border border-[var(--color-border-subtle)]">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-text-muted)] mb-3">
        {icon} {label}
      </div>
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <p className="text-[10px] text-[var(--color-text-muted)] mb-1">{firstLabel}</p>
          <div className="h-1.5 rounded-full bg-[var(--color-border)] overflow-hidden">
            <div className="h-full bg-[var(--color-text-muted)] rounded-full transition-all" style={{ width: `${Math.round(first * 100)}%` }} />
          </div>
          <p className="text-xs font-bold text-[var(--color-text-secondary)] mt-1">{Math.round(first * 100)}%</p>
        </div>
        <div className={cn('text-lg font-black', isUp ? 'text-[var(--color-success)]' : isDown ? 'text-[var(--color-danger)]' : 'text-[var(--color-text-muted)]')}>
          {isUp ? '↑' : isDown ? '↓' : '→'}
        </div>
        <div className="flex-1">
          <p className="text-[10px] text-[var(--color-text-muted)] mb-1">{secondLabel}</p>
          <div className="h-1.5 rounded-full bg-[var(--color-border)] overflow-hidden">
            <div className={cn('h-full rounded-full transition-all', isUp ? 'bg-[var(--color-success)]' : isDown ? 'bg-[var(--color-danger)]' : 'bg-[var(--color-text-muted)]')} style={{ width: `${Math.round(second * 100)}%` }} />
          </div>
          <p className={cn('text-xs font-bold mt-1', isUp ? 'text-[var(--color-success)]' : isDown ? 'text-[var(--color-danger)]' : 'text-[var(--color-text-secondary)]')}>{Math.round(second * 100)}%</p>
        </div>
      </div>
      <p className="text-[10px] text-center mt-2">
        {isUp && <span className="text-[var(--color-success)]">{t('contribution.trend_improved', { n: Math.round(Math.abs(delta) * 100) })}</span>}
        {isDown && <span className="text-[var(--color-danger)]">{t('contribution.trend_declined', { n: Math.round(Math.abs(delta) * 100) })}</span>}
        {!isUp && !isDown && <span className="text-[var(--color-text-muted)]">{t('contribution.trend_maintained')}</span>}
      </p>
    </div>
  )
}
