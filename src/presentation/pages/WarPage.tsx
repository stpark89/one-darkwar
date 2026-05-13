import { useEffect, useState } from 'react'
import { Search, Plus, X, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useWarStore, nextEntry } from '@/infrastructure/stores/warStore'
import type { WarTeam, WarRole } from '@/domain/entities/War'
import { Input } from '@/presentation/components/ui/input'
import { Button } from '@/presentation/components/ui/button'
import { cn } from '@/lib/utils'

const ENTRY_STYLE: Record<string, string> = {
  'A-CT': 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30',
  'A-DB': 'bg-blue-500/10 text-blue-300 hover:bg-blue-500/20',
  'B-CT': 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30',
  'B-DB': 'bg-purple-500/10 text-purple-300 hover:bg-purple-500/20',
}

const EntryCell = ({ team, role }: { team: string; role: string }) => {
  const key = `${team}-${role}`
  if (!team || !role) return <span className="text-[var(--color-text-muted)]">·</span>
  return (
    <span className={cn('text-[11px] font-bold px-1.5 py-0.5 rounded', ENTRY_STYLE[key] ?? '')}>
      {team}·{role}
    </span>
  )
}

export const WarPage = () => {
  const { t } = useTranslation()
  const {
    activeSeason, rounds, loading,
    searchQuery, setSearchQuery,
    filterTeam, setFilterTeam,
    getMemberRows, getSummary,
    addRound, updateEntry, loadData,
  } = useWarStore()

  const memberRows = getMemberRows()
  const summary = getSummary()
  const [activeTab, setActiveTab] = useState<'grid' | 'summary'>('grid')
  const [showAddRound, setShowAddRound] = useState(false)
  const [newRoundDate, setNewRoundDate] = useState(() => new Date().toISOString().slice(0, 10))

  useEffect(() => { loadData() }, [loadData])

  if (loading && rounds.length === 0) return (
    <div className="flex items-center justify-center h-64 text-[var(--color-text-muted)]">
      <Loader2 className="w-5 h-5 animate-spin mr-2" /> {t('common.loading')}
    </div>
  )

  const handleCellClick = (roundId: string, memberId: string, team: string, role: string) => {
    const [nextTeam, nextRole] = nextEntry(team, role)
    updateEntry(roundId, memberId, nextTeam as WarTeam, nextRole as WarRole)
  }

  const handleAddRound = async () => {
    await addRound(newRoundDate)
    setShowAddRound(false)
    setNewRoundDate(new Date().toISOString().slice(0, 10))
  }

  return (
    <div className="p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text-primary)]">{t('war.title')}</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
            {activeSeason?.name} · {rounds.length}{t('war.round', { n: '' }).replace('', '')}
            {rounds.length}회차
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 p-1 bg-[var(--color-bg-surface)] rounded-lg border border-[var(--color-border-subtle)]">
            <button
              onClick={() => setActiveTab('grid')}
              className={cn('px-3 py-1.5 rounded text-xs font-medium transition-colors',
                activeTab === 'grid' ? 'bg-[var(--color-brand)] text-white' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]')}
            >
              {t('war.tab_grid')}
            </button>
            <button
              onClick={() => setActiveTab('summary')}
              className={cn('px-3 py-1.5 rounded text-xs font-medium transition-colors',
                activeTab === 'summary' ? 'bg-[var(--color-brand)] text-white' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]')}
            >
              {t('war.tab_ranking')}
            </button>
          </div>
          <Button size="sm" onClick={() => setShowAddRound(true)}>
            <Plus className="w-4 h-4" /> {t('war.add_round_btn')}
          </Button>
        </div>
      </div>

      {/* 검색 + 팀 필터 */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
          <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder={t('war.search_placeholder')} className="pl-9" />
        </div>
        <div className="flex gap-2 items-center">
          <span className="text-xs text-[var(--color-text-muted)]">{t('war.filter_team')}</span>
          {(['', 'A', 'B'] as const).map(team => (
            <button
              key={team}
              onClick={() => setFilterTeam(team)}
              className={cn('px-2.5 py-1 rounded text-xs font-medium transition-colors',
                filterTeam === team
                  ? 'bg-[var(--color-brand)] text-white'
                  : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]')}
            >
              {team === '' ? t('war.team_all') : `Team ${team}`}
            </button>
          ))}
        </div>
        <span className="text-xs text-[var(--color-text-muted)] ml-auto">{memberRows.length}{t('common.count_people')}</span>
      </div>

      {activeTab === 'grid' ? (
        <div className="rounded-lg border border-[var(--color-border-subtle)] overflow-auto max-h-[calc(100vh-280px)]">
          <table className="text-xs">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[var(--color-bg-surface)] border-b border-[var(--color-border-subtle)]">
                <th className="px-3 py-3 text-left text-[var(--color-text-muted)] sticky left-0 bg-[var(--color-bg-surface)] min-w-[140px] whitespace-nowrap">
                  {t('war.col_name')}
                </th>
                <th className="px-3 py-3 text-center text-[var(--color-text-muted)] min-w-[48px] whitespace-nowrap">
                  {t('war.col_total')}
                </th>
                {rounds.map(r => (
                  <th key={r.id} className="px-3 py-3 text-center text-[var(--color-text-muted)] min-w-[72px]">
                    <div className="text-[10px] font-normal">{r.date?.slice(5) ?? ''}</div>
                    <div className="font-semibold">{t('war.round', { n: r.sortOrder })}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-subtle)]">
              {memberRows.map(row => (
                <tr key={row.memberId} className="hover:bg-[var(--color-bg-surface)] transition-colors">
                  <td className="px-3 py-2.5 font-medium text-[var(--color-text-primary)] whitespace-nowrap sticky left-0 bg-[var(--color-bg-base)] hover:bg-[var(--color-bg-surface)]">
                    {row.inGameName}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span className="text-[var(--color-success)] font-bold">{row.total}</span>
                  </td>
                  {rounds.map(r => {
                    const e = row.entryMap[r.id] ?? { team: '', role: '' }
                    return (
                      <td
                        key={r.id}
                        onClick={() => handleCellClick(r.id, row.memberId, e.team, e.role)}
                        className="px-3 py-2.5 text-center cursor-pointer select-none transition-colors hover:bg-[var(--color-bg-elevated)]"
                      >
                        <EntryCell team={e.team} role={e.role} />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-auto">
          {summary.filter(s => s.total > 0).map((s, i) => (
            <div key={s.memberId} className="flex items-center gap-3 px-4 py-3 rounded-lg bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)]">
              <span className={cn('text-lg font-black w-8 text-center',
                i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-amber-600' : 'text-[var(--color-text-muted)]')}>
                {i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}
              </span>
              <span className="flex-1 font-medium text-[var(--color-text-primary)] text-sm">{s.inGameName}</span>
              <span className="text-[var(--color-success)] font-bold text-sm">{t('war.ranking_total', { count: s.total })}</span>
              {s.ct > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400">CT {s.ct}</span>}
              {s.db > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400">DB {s.db}</span>}
              {s.teamA > 0 && <span className="text-[10px] text-[var(--color-text-muted)]">A:{s.teamA}</span>}
              {s.teamB > 0 && <span className="text-[10px] text-[var(--color-text-muted)]">B:{s.teamB}</span>}
            </div>
          ))}
        </div>
      )}

      {/* 회차 추가 모달 */}
      {showAddRound && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border)] w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold">{t('war.add_round_title')}</h2>
              <button onClick={() => setShowAddRound(false)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div>
              <label className="text-xs text-[var(--color-text-muted)] mb-1 block">{t('war.round_date_label')}</label>
              <Input type="date" value={newRoundDate} onChange={e => setNewRoundDate(e.target.value)} />
            </div>
            <div className="flex gap-2 mt-5">
              <Button variant="outline" size="full" onClick={() => setShowAddRound(false)}>{t('common.cancel')}</Button>
              <Button size="full" onClick={handleAddRound}>{t('common.add')}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
