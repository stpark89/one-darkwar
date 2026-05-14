import { useState, useEffect } from 'react'
import { Search, Plus, X, Loader2, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useEventStore } from '@/infrastructure/stores/eventStore'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { Input } from '@/presentation/components/ui/input'
import { Button } from '@/presentation/components/ui/button'
import { SortIcon, nextSortDir } from '@/presentation/components/ui/sort-icon'
import type { SortDir } from '@/presentation/components/ui/sort-icon'
import { cn } from '@/lib/utils'

export const EventsPage = () => {
  const { t } = useTranslation()
  const { events, addEvent, deleteEvent, updateStatus, getFiltered, searchQuery, setSearchQuery, getSummary, loadData, loading } = useEventStore()
  const { user } = useAuthStore()
  const canEdit = user?.role === 'ROLE_ADMIN'
  const baseAttendance = getFiltered()
  const summary = getSummary()
  const [activeTab, setActiveTab] = useState<'grid' | 'summary'>('grid')
  const [sortKey, setSortKey] = useState<'inGameName' | 'total'>('total')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const handleSort = (key: 'inGameName' | 'total') => {
    if (key !== sortKey) { setSortKey(key); setSortDir(key === 'total' ? 'desc' : 'asc'); return }
    const next = nextSortDir(sortDir, key === 'total')
    setSortDir(next)
    if (next === null) { setSortKey('total'); setSortDir('desc') }
  }

  const attendance = [...baseAttendance].sort((a, b) => {
    if (!sortDir) return 0
    const totalA = Object.values(a.records).filter(v => v === 'CT' || v === 'DB').length
    const totalB = Object.values(b.records).filter(v => v === 'CT' || v === 'DB').length
    const cmp = sortKey === 'inGameName' ? a.inGameName.localeCompare(b.inGameName) : totalA - totalB
    return sortDir === 'asc' ? cmp : -cmp
  })
  const [showAddEvent, setShowAddEvent] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [newEventName, setNewEventName] = useState('')
  const [newEventDate, setNewEventDate] = useState(() => new Date().toISOString().slice(0, 10))

  useEffect(() => { loadData() }, [loadData])

  const handleAddEvent = () => {
    if (!newEventName.trim()) return
    addEvent(newEventName.trim(), newEventDate)
    setNewEventName('')
    setNewEventDate(new Date().toISOString().slice(0, 10))
    setShowAddEvent(false)
  }

  const handleCellClick = (memberId: string, eventKey: string, current: string) => {
    const next = current === '' ? 'CT' : current === 'CT' ? 'DB' : ''
    updateStatus(memberId, eventKey, next as 'CT' | 'DB' | '')
  }

  if (loading && events.length === 0) return (
    <div className="flex items-center justify-center h-64 text-[var(--color-text-muted)]">
      <Loader2 className="w-5 h-5 animate-spin mr-2" /> {t('common.loading')}
    </div>
  )

  return (
    <div className="p-3 sm:p-6">
      <div className="flex items-center justify-between mb-3 sm:mb-6 flex-wrap gap-2">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-[var(--color-text-primary)]">{t('events.title')}</h1>
          <p className="text-xs sm:text-sm text-[var(--color-text-muted)] mt-0.5">
            {t('events.subtitle', { events: events.length, members: attendance.length })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 p-1 bg-[var(--color-bg-surface)] rounded-lg border border-[var(--color-border-subtle)]">
            <button
              onClick={() => setActiveTab('grid')}
              className={cn('px-2.5 sm:px-3 py-1.5 rounded text-xs font-medium transition-colors', activeTab === 'grid' ? 'bg-[var(--color-brand)] text-white' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]')}
            >
              {t('events.tab_grid')}
            </button>
            <button
              onClick={() => setActiveTab('summary')}
              className={cn('px-2.5 sm:px-3 py-1.5 rounded text-xs font-medium transition-colors', activeTab === 'summary' ? 'bg-[var(--color-brand)] text-white' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]')}
            >
              {t('events.tab_ranking')}
            </button>
          </div>
          {canEdit && (
            <Button size="sm" onClick={() => setShowAddEvent(true)}>
              <Plus className="w-4 h-4" /> <span className="hidden sm:inline">{t('events.add_event_btn')}</span>
            </Button>
          )}
        </div>
      </div>

      <div className="relative mb-3 sm:mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
        <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={t('events.search_placeholder')} className="pl-9" />
      </div>

      {activeTab === 'grid' ? (
        <div className="rounded-lg border border-[var(--color-border-subtle)] overflow-auto w-full max-h-[calc(100vh-200px)] sm:max-h-[calc(100vh-280px)]">
          <table className="text-xs">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[var(--color-bg-surface)] border-b border-[var(--color-border-subtle)]">
                <th
                  onClick={() => handleSort('inGameName')}
                  className="px-3 py-3 text-left text-[var(--color-text-muted)] whitespace-nowrap sticky left-0 bg-[var(--color-bg-surface)] min-w-[140px] cursor-pointer select-none hover:text-[var(--color-text-primary)] transition-colors"
                >
                  {t('events.col_name')}<SortIcon dir={sortKey === 'inGameName' ? sortDir : null} />
                </th>
                <th
                  onClick={() => handleSort('total')}
                  className="px-3 py-3 text-center text-[var(--color-text-muted)] whitespace-nowrap min-w-[52px] cursor-pointer select-none hover:text-[var(--color-text-primary)] transition-colors"
                >
                  {t('events.col_attended')}<SortIcon dir={sortKey === 'total' ? sortDir : null} />
                </th>
                {events.map((e) => (
                  <th key={e.eventKey} className="px-2 py-3 text-center text-[var(--color-text-muted)] whitespace-nowrap min-w-[64px] group">
                    <div className="text-[10px] font-normal">{e.date?.slice(5) ?? ''}</div>
                    <div className="font-semibold flex items-center justify-center gap-1">
                      {e.name.length > 8 ? e.name.slice(0, 8) + '…' : e.name}
                      {canEdit && (
                        <button
                          onClick={() => setDeleteConfirmId(e.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--color-danger)] hover:text-red-400"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-subtle)]">
              {attendance.map((a) => {
                const total = Object.values(a.records).filter((v) => v === 'CT' || v === 'DB').length
                return (
                  <tr key={a.memberId} className="hover:bg-[var(--color-bg-surface)] transition-colors">
                    <td className="px-3 py-2.5 font-medium text-[var(--color-text-primary)] whitespace-nowrap sticky left-0 bg-[var(--color-bg-base)] hover:bg-[var(--color-bg-surface)]">
                      {a.inGameName}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="text-[var(--color-success)] font-bold">{total}</span>
                    </td>
                    {events.map((e) => {
                      const status = a.records[e.eventKey] ?? ''
                      return (
                        <td
                          key={e.eventKey}
                          onClick={() => canEdit && handleCellClick(a.memberId, e.eventKey, status)}
                          className={cn(
                            'px-2 py-2.5 text-center cursor-pointer select-none transition-colors text-[11px] font-bold',
                            status === 'CT' && 'bg-[var(--color-success)]/15 text-[var(--color-success)] hover:bg-[var(--color-success)]/25',
                            status === 'DB' && 'bg-[var(--color-warning)]/15 text-[var(--color-warning)] hover:bg-[var(--color-warning)]/25',
                            status === '' && 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-elevated)]',
                          )}
                        >
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
        <div className="space-y-2 overflow-auto max-h-[calc(100vh-200px)] sm:max-h-[calc(100vh-280px)]">
          {summary.slice(0, 30).map((s, i) => (
            <div key={s.memberId} className="flex items-center gap-4 px-4 py-3 rounded-lg bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)]">
              <span className={cn('text-lg font-black w-8 text-center', i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-amber-600' : 'text-[var(--color-text-muted)]')}>
                {i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}
              </span>
              <span className="flex-1 font-medium text-[var(--color-text-primary)]">{s.inGameName}</span>
              <span className="text-[var(--color-success)] font-bold">
                {t('events.ranking_attended', { count: s.total })}
              </span>
              {s.ct > 0 && <span className="text-[10px] text-[var(--color-success)] bg-[var(--color-success)]/10 px-1.5 py-0.5 rounded">CT {s.ct}</span>}
              {s.db > 0 && <span className="text-[10px] text-[var(--color-warning)] bg-[var(--color-warning)]/10 px-1.5 py-0.5 rounded">DB {s.db}</span>}
            </div>
          ))}
        </div>
      )}

      {deleteConfirmId && (() => {
        const event = events.find(e => e.id === deleteConfirmId)
        return (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border)] w-full max-w-sm p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-[var(--color-danger)]/15 flex items-center justify-center flex-shrink-0">
                  <Trash2 className="w-5 h-5 text-[var(--color-danger)]" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[var(--color-text-primary)]">{t('events.delete_event_title')}</h2>
                  <p className="text-sm text-[var(--color-text-muted)] mt-0.5">{event?.name}{event?.date ? ` · ${event.date}` : ''}</p>
                </div>
              </div>
              <p className="text-sm text-[var(--color-text-secondary)] mb-5">{t('events.delete_event_confirm')}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  className="flex-1 px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={async () => { await deleteEvent(deleteConfirmId); setDeleteConfirmId(null) }}
                  className="flex-1 px-4 py-2 rounded-lg bg-[var(--color-danger)] text-white text-sm font-medium hover:bg-red-700 transition-colors"
                >
                  {t('common.delete')}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {showAddEvent && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border)] w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold">{t('events.add_event_title')}</h2>
              <button onClick={() => setShowAddEvent(false)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-[var(--color-text-muted)] mb-1 block">{t('events.event_name_label')} *</label>
                <Input
                  value={newEventName}
                  onChange={(e) => setNewEventName(e.target.value)}
                  placeholder={t('events.event_name_placeholder')}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddEvent()}
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs text-[var(--color-text-muted)] mb-1 block">{t('events.event_date_label')}</label>
                <Input
                  type="date"
                  value={newEventDate}
                  onChange={(e) => setNewEventDate(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <Button variant="outline" size="full" onClick={() => setShowAddEvent(false)}>{t('common.cancel')}</Button>
              <Button size="full" onClick={handleAddEvent} disabled={!newEventName.trim()}>{t('common.add')}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
