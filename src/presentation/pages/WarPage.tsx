import { useEffect } from 'react'
import { Search, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useWarStore } from '@/infrastructure/stores/warStore'
import { Input } from '@/presentation/components/ui/input'
import { Badge } from '@/presentation/components/ui/badge'
import { cn } from '@/lib/utils'
import type { WarParticipant, WarRoundEntry } from '@/domain/entities/War'

const ROUNDS = [1, 2, 3, 4] as const

const RoleBadge = ({ role }: { role: string }) => {
  if (!role) return <span className="text-[var(--color-text-muted)] text-xs">-</span>
  return <Badge variant={role === 'CT' ? 'warning' : 'muted'}>{role}</Badge>
}

const TeamBadge = ({ team }: { team: string }) => {
  if (!team) return <span className="text-[var(--color-text-muted)] text-xs">-</span>
  return <Badge variant={team === 'A' ? 'teamA' : 'teamB'}>{team}</Badge>
}

export const WarPage = () => {
  const { t } = useTranslation()
  const { session, searchQuery, filterTeam, filterRound, setSearchQuery, setFilterTeam, setFilterRound, getFiltered, loadParticipants, loading } = useWarStore()
  const participants = getFiltered()

  useEffect(() => { loadParticipants() }, [loadParticipants])

  if (loading && session.participants.length === 0) return (
    <div className="flex items-center justify-center h-64 text-[var(--color-text-muted)]">
      <Loader2 className="w-5 h-5 animate-spin mr-2" /> {t('common.loading')}
    </div>
  )

  const stats = {
    total: session.participants.length,
    teamA: (r: number) => session.participants.filter((p) => (p[`round${r}` as keyof WarParticipant] as WarRoundEntry).team === 'A').length,
    teamB: (r: number) => session.participants.filter((p) => (p[`round${r}` as keyof WarParticipant] as WarRoundEntry).team === 'B').length,
  }

  return (
    <div className="p-6">
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[var(--color-text-primary)]">{t('war.title')} — {session.name}</h1>
        <div className="flex gap-4 mt-2">
          {session.rounds.map((r, i) => (
            <div key={i} className="text-xs text-[var(--color-text-muted)]">
              <span className="font-semibold text-[var(--color-text-secondary)]">{r.label}</span> {r.date}
              <span className="ml-2 text-blue-400">{stats.teamA(i + 1)}A</span>
              <span className="ml-1 text-purple-400">{stats.teamB(i + 1)}B</span>
            </div>
          ))}
        </div>
      </div>

      {/* 검색 + 필터 */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
          <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={t('war.search_placeholder')} className="pl-9" />
        </div>
        <div className="flex gap-2 items-center">
          <span className="text-xs text-[var(--color-text-muted)]">{t('war.filter_round')}</span>
          {[0, 1, 2, 3, 4].map((r) => (
            <button
              key={r}
              onClick={() => setFilterRound(r)}
              className={cn('px-2.5 py-1 rounded text-xs font-medium transition-colors', filterRound === r ? 'bg-[var(--color-brand)] text-white' : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]')}
            >
              {r === 0 ? t('war.round_all') : t('war.round', { n: r })}
            </button>
          ))}
        </div>
        <div className="flex gap-2 items-center">
          <span className="text-xs text-[var(--color-text-muted)]">{t('war.filter_team')}</span>
          {['', 'A', 'B'].map((team) => (
            <button
              key={team}
              onClick={() => setFilterTeam(team)}
              className={cn('px-2.5 py-1 rounded text-xs font-medium transition-colors', filterTeam === team ? 'bg-[var(--color-brand)] text-white' : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]')}
            >
              {team === '' ? t('war.team_all') : `Team ${team}`}
            </button>
          ))}
        </div>
        <span className="text-xs text-[var(--color-text-muted)] ml-auto">{participants.length}{t('common.count_people')}</span>
      </div>

      {/* 테이블 */}
      <div className="rounded-lg border border-[var(--color-border-subtle)] overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--color-bg-surface)] border-b border-[var(--color-border-subtle)]">
              <th className="px-3 py-3 text-left text-xs text-[var(--color-text-muted)] whitespace-nowrap">{t('war.col_no')}</th>
              <th className="px-3 py-3 text-left text-xs text-[var(--color-text-muted)] whitespace-nowrap">{t('war.col_name')}</th>
              <th className="px-3 py-3 text-left text-xs text-[var(--color-text-muted)] whitespace-nowrap">{t('war.col_cp')}</th>
              {ROUNDS.map((r) => (
                <th key={r} colSpan={3} className="px-3 py-3 text-center text-xs text-[var(--color-text-muted)] whitespace-nowrap border-l border-[var(--color-border-subtle)]">
                  {session.rounds[r - 1]?.label ?? `Đợt ${r}`}
                </th>
              ))}
            </tr>
            <tr className="bg-[var(--color-bg-surface)] border-b border-[var(--color-border-subtle)]">
              <th colSpan={3} />
              {ROUNDS.map((r) => (
                <>
                  <th key={`${r}-team`} className="px-2 py-1.5 text-xs text-[var(--color-text-muted)] border-l border-[var(--color-border-subtle)]">{t('war.team')}</th>
                  <th key={`${r}-role`} className="px-2 py-1.5 text-xs text-[var(--color-text-muted)]">{t('war.role')}</th>
                  <th key={`${r}-note`} className="px-2 py-1.5 text-xs text-[var(--color-text-muted)]">{t('war.note')}</th>
                </>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border-subtle)]">
            {participants.map((p, i) => (
              <tr key={p.id} className="hover:bg-[var(--color-bg-surface)] transition-colors">
                <td className="px-3 py-2.5 text-xs text-[var(--color-text-muted)]">{i + 1}</td>
                <td className="px-3 py-2.5 font-medium text-[var(--color-text-primary)] whitespace-nowrap">{p.inGameName}</td>
                <td className="px-3 py-2.5"><Badge variant="success" className="text-[10px]">{p.cp || '-'}</Badge></td>
                {ROUNDS.map((r) => {
                  const entry = p[`round${r}` as keyof WarParticipant] as WarRoundEntry
                  return (
                    <>
                      <td key={`${p.id}-${r}-team`} className="px-2 py-2.5 text-center border-l border-[var(--color-border-subtle)]">
                        <TeamBadge team={entry.team} />
                      </td>
                      <td key={`${p.id}-${r}-role`} className="px-2 py-2.5 text-center">
                        <RoleBadge role={entry.role} />
                      </td>
                      <td key={`${p.id}-${r}-note`} className="px-2 py-2.5 text-xs text-[var(--color-text-muted)] max-w-[80px] truncate">
                        {entry.note || ''}
                      </td>
                    </>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
