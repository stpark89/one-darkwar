import { useState } from 'react'
import { Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useEventStore } from '@/infrastructure/stores/eventStore'
import { Input } from '@/presentation/components/ui/input'
import { cn } from '@/lib/utils'

const STATUS_STYLE: Record<string, string> = {
  X: 'bg-[var(--color-success)]/20 text-[var(--color-success)] font-bold',
  O: 'bg-[var(--color-brand)]/15 text-[var(--color-brand)]',
  '': 'text-[var(--color-text-muted)]',
}

export const EventsPage = () => {
  const { t } = useTranslation()
  const { events, getFiltered, searchQuery, setSearchQuery, getSummary } = useEventStore()
  const attendance = getFiltered()
  const summary = getSummary()
  const [activeTab, setActiveTab] = useState<'grid' | 'summary'>('grid')

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text-primary)]">{t('events.title')}</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">{t('events.subtitle', { events: events.length, members: attendance.length })}</p>
        </div>
        <div className="flex gap-1 p-1 bg-[var(--color-bg-surface)] rounded-lg border border-[var(--color-border-subtle)]">
          <button
            onClick={() => setActiveTab('grid')}
            className={cn('px-3 py-1.5 rounded text-xs font-medium transition-colors', activeTab === 'grid' ? 'bg-[var(--color-brand)] text-white' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]')}
          >
            {t('events.tab_grid')}
          </button>
          <button
            onClick={() => setActiveTab('summary')}
            className={cn('px-3 py-1.5 rounded text-xs font-medium transition-colors', activeTab === 'summary' ? 'bg-[var(--color-brand)] text-white' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]')}
          >
            {t('events.tab_ranking')}
          </button>
        </div>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
        <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={t('events.search_placeholder')} className="pl-9" />
      </div>

      {activeTab === 'grid' ? (
        <div className="rounded-lg border border-[var(--color-border-subtle)] overflow-auto max-h-[calc(100vh-260px)]">
          <table className="text-xs">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[var(--color-bg-surface)] border-b border-[var(--color-border-subtle)]">
                <th className="px-3 py-3 text-left text-[var(--color-text-muted)] whitespace-nowrap sticky left-0 bg-[var(--color-bg-surface)] min-w-[140px]">{t('events.col_name')}</th>
                <th className="px-3 py-3 text-center text-[var(--color-text-muted)] whitespace-nowrap">{t('events.col_attended')}</th>
                {events.map((e) => (
                  <th key={e.eventKey} className="px-2 py-3 text-center text-[var(--color-text-muted)] whitespace-nowrap min-w-[70px]">
                    <div className="text-[10px] font-normal">{e.date?.slice(5) ?? ''}</div>
                    <div className="font-semibold">{e.name.length > 8 ? e.name.slice(0, 8) + '…' : e.name}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-subtle)]">
              {attendance.map((a) => {
                const xCount = Object.values(a.records).filter((v) => v === 'X').length
                return (
                  <tr key={a.memberId} className="hover:bg-[var(--color-bg-surface)] transition-colors">
                    <td className="px-3 py-2.5 font-medium text-[var(--color-text-primary)] whitespace-nowrap sticky left-0 bg-[var(--color-bg-base)] hover:bg-[var(--color-bg-surface)]">
                      {a.inGameName}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="text-[var(--color-success)] font-bold">{xCount}</span>
                    </td>
                    {events.map((e) => {
                      const status = a.records[e.eventKey] ?? ''
                      return (
                        <td key={e.eventKey} className={cn('px-2 py-2.5 text-center', STATUS_STYLE[status])}>
                          {status || '·'}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-2 max-h-[calc(100vh-260px)] overflow-auto">
          {summary.slice(0, 30).map((s, i) => (
            <div key={s.memberId} className="flex items-center gap-4 px-4 py-3 rounded-lg bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)]">
              <span className={cn('text-lg font-black w-8 text-center', i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-amber-600' : 'text-[var(--color-text-muted)]')}>
                {i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}
              </span>
              <span className="flex-1 font-medium text-[var(--color-text-primary)]">{s.inGameName}</span>
              <span className="text-[var(--color-success)] font-bold">{t('events.ranking_attended', { count: s.total })}</span>
              {s.online > 0 && <span className="text-[var(--color-brand)] text-xs">{t('events.ranking_online', { count: s.online })}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
