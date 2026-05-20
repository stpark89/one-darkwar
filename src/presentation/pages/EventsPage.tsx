import { useState, useEffect, useMemo } from 'react'
import { Search, Plus, X, Loader2, Trash2, EyeOff, Eye, ClipboardList, Users, UserCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useEventStore } from '@/infrastructure/stores/eventStore'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { Input } from '@/presentation/components/ui/input'
import { Button } from '@/presentation/components/ui/button'
import { SortIcon, nextSortDir } from '@/presentation/components/ui/sort-icon'
import type { SortDir } from '@/presentation/components/ui/sort-icon'
import type { AttendanceStatus } from '@/domain/entities/Event'
import { cn } from '@/lib/utils'

// ─── 출석 입력 모달 ───────────────────────────────────────────────────────────
interface AttendanceModalProps {
  eventId: string
  eventName: string
  eventDate: string
  attendance: { memberId: string; inGameName: string; status: AttendanceStatus }[]
  onStatusChange: (memberId: string, status: AttendanceStatus) => void
  onBulkSet: (status: AttendanceStatus) => void
  onClose: () => void
}

const AttendanceModal = ({ eventName, eventDate, attendance, onStatusChange, onBulkSet, onClose }: AttendanceModalProps) => {
  const [search, setSearch] = useState('')
  const filtered = search
    ? attendance.filter((a) => a.inGameName.toLowerCase().includes(search.toLowerCase()))
    : attendance
  const ct = attendance.filter((a) => a.status === 'CT').length
  const db = attendance.filter((a) => a.status === 'DB').length
  const total = ct + db

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border)] w-full max-w-md flex flex-col max-h-[90vh]">
        {/* 헤더 */}
        <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-[var(--color-border-subtle)] flex-shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-[var(--color-brand)]" />
              <h2 className="text-base font-bold text-[var(--color-text-primary)]">{eventName}</h2>
            </div>
            {eventDate && (
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5 ml-6">{eventDate}</p>
            )}
          </div>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] p-1 -mr-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 요약 + 일괄 설정 */}
        <div className="px-5 py-3 border-b border-[var(--color-border-subtle)] flex-shrink-0">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
              <Users className="w-3.5 h-3.5" />
              <span>참여 <span className="font-bold text-[var(--color-success)]">{total}</span>명</span>
              {ct > 0 && <span className="text-[var(--color-success)] bg-[var(--color-success)]/10 px-1.5 py-0.5 rounded">CT {ct}</span>}
              {db > 0 && <span className="text-[var(--color-warning)] bg-[var(--color-warning)]/10 px-1.5 py-0.5 rounded">DB {db}</span>}
            </div>
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={() => onBulkSet('CT')}
              className="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-[var(--color-success)]/15 text-[var(--color-success)] hover:bg-[var(--color-success)]/25 transition-colors"
            >
              전체 CT
            </button>
            <button
              onClick={() => onBulkSet('DB')}
              className="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-[var(--color-warning)]/15 text-[var(--color-warning)] hover:bg-[var(--color-warning)]/25 transition-colors"
            >
              전체 DB
            </button>
            <button
              onClick={() => onBulkSet('')}
              className="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] hover:bg-[var(--color-border)] transition-colors"
            >
              전체 초기화
            </button>
          </div>
        </div>

        {/* 검색 */}
        <div className="px-5 py-2.5 border-b border-[var(--color-border-subtle)] flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-muted)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="멤버 검색..."
              className="w-full pl-8 pr-3 py-1.5 text-sm bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none focus:border-[var(--color-brand)]/50"
            />
          </div>
        </div>

        {/* 멤버 목록 */}
        <div className="overflow-y-auto flex-1 px-3 py-2">
          {filtered.map((a) => (
            <div key={a.memberId} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-[var(--color-bg-elevated)] transition-colors">
              <span className="flex-1 text-sm font-medium text-[var(--color-text-primary)] truncate">{a.inGameName}</span>
              <div className="flex gap-1 flex-shrink-0">
                <button
                  onClick={() => onStatusChange(a.memberId, 'CT')}
                  className={cn(
                    'px-3 py-1 rounded-md text-xs font-bold transition-colors',
                    a.status === 'CT'
                      ? 'bg-[var(--color-success)] text-white'
                      : 'bg-[var(--color-bg-base)] text-[var(--color-text-muted)] hover:bg-[var(--color-success)]/20 hover:text-[var(--color-success)]'
                  )}
                >
                  CT
                </button>
                <button
                  onClick={() => onStatusChange(a.memberId, 'DB')}
                  className={cn(
                    'px-3 py-1 rounded-md text-xs font-bold transition-colors',
                    a.status === 'DB'
                      ? 'bg-[var(--color-warning)] text-white'
                      : 'bg-[var(--color-bg-base)] text-[var(--color-text-muted)] hover:bg-[var(--color-warning)]/20 hover:text-[var(--color-warning)]'
                  )}
                >
                  DB
                </button>
                <button
                  onClick={() => onStatusChange(a.memberId, '')}
                  className={cn(
                    'px-2 py-1 rounded-md text-xs font-bold transition-colors',
                    a.status === ''
                      ? 'bg-[var(--color-border)] text-[var(--color-text-secondary)]'
                      : 'bg-[var(--color-bg-base)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-elevated)]'
                  )}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-center text-xs text-[var(--color-text-muted)] py-8">검색 결과가 없습니다.</p>
          )}
        </div>

        {/* 닫기 */}
        <div className="px-5 py-4 border-t border-[var(--color-border-subtle)] flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full py-2 rounded-lg bg-[var(--color-brand)] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            완료
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── 회원별 출석 모달 ─────────────────────────────────────────────────────────
interface MemberAttendanceModalProps {
  memberId: string
  memberName: string
  events: { eventKey: string; name: string; date: string; status: AttendanceStatus }[]
  onStatusChange: (eventKey: string, status: AttendanceStatus) => void
  onBulkSet: (status: AttendanceStatus) => void
  onClose: () => void
}

const MemberAttendanceModal = ({ memberName, events, onStatusChange, onBulkSet, onClose }: MemberAttendanceModalProps) => {
  const [search, setSearch] = useState('')
  const filtered = search
    ? events.filter((e) => e.name.toLowerCase().includes(search.toLowerCase()) || e.date.includes(search))
    : events
  const ct = events.filter((e) => e.status === 'CT').length
  const db = events.filter((e) => e.status === 'DB').length
  const total = ct + db

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border)] w-full max-w-md flex flex-col max-h-[90vh]">
        {/* 헤더 */}
        <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-[var(--color-border-subtle)] flex-shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-[var(--color-brand)]" />
              <h2 className="text-base font-bold text-[var(--color-text-primary)]">{memberName}</h2>
            </div>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5 ml-6">
              전체 이벤트 출석 관리
            </p>
          </div>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] p-1 -mr-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 요약 + 일괄 설정 */}
        <div className="px-5 py-3 border-b border-[var(--color-border-subtle)] flex-shrink-0">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
              <ClipboardList className="w-3.5 h-3.5" />
              <span>참여 <span className="font-bold text-[var(--color-success)]">{total}</span> / {events.length}개</span>
              {ct > 0 && <span className="text-[var(--color-success)] bg-[var(--color-success)]/10 px-1.5 py-0.5 rounded">CT {ct}</span>}
              {db > 0 && <span className="text-[var(--color-warning)] bg-[var(--color-warning)]/10 px-1.5 py-0.5 rounded">DB {db}</span>}
            </div>
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={() => onBulkSet('CT')}
              className="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-[var(--color-success)]/15 text-[var(--color-success)] hover:bg-[var(--color-success)]/25 transition-colors"
            >
              전체 CT
            </button>
            <button
              onClick={() => onBulkSet('DB')}
              className="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-[var(--color-warning)]/15 text-[var(--color-warning)] hover:bg-[var(--color-warning)]/25 transition-colors"
            >
              전체 DB
            </button>
            <button
              onClick={() => onBulkSet('')}
              className="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] hover:bg-[var(--color-border)] transition-colors"
            >
              전체 초기화
            </button>
          </div>
        </div>

        {/* 검색 */}
        <div className="px-5 py-2.5 border-b border-[var(--color-border-subtle)] flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-muted)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="이벤트 검색..."
              className="w-full pl-8 pr-3 py-1.5 text-sm bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none focus:border-[var(--color-brand)]/50"
            />
          </div>
        </div>

        {/* 이벤트 목록 */}
        <div className="overflow-y-auto flex-1 px-3 py-2">
          {filtered.map((e) => (
            <div key={e.eventKey} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-[var(--color-bg-elevated)] transition-colors">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{e.name}</p>
                {e.date && <p className="text-[11px] text-[var(--color-text-muted)]">{e.date}</p>}
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button
                  onClick={() => onStatusChange(e.eventKey, 'CT')}
                  className={cn(
                    'px-3 py-1 rounded-md text-xs font-bold transition-colors',
                    e.status === 'CT'
                      ? 'bg-[var(--color-success)] text-white'
                      : 'bg-[var(--color-bg-base)] text-[var(--color-text-muted)] hover:bg-[var(--color-success)]/20 hover:text-[var(--color-success)]',
                  )}
                >
                  CT
                </button>
                <button
                  onClick={() => onStatusChange(e.eventKey, 'DB')}
                  className={cn(
                    'px-3 py-1 rounded-md text-xs font-bold transition-colors',
                    e.status === 'DB'
                      ? 'bg-[var(--color-warning)] text-white'
                      : 'bg-[var(--color-bg-base)] text-[var(--color-text-muted)] hover:bg-[var(--color-warning)]/20 hover:text-[var(--color-warning)]',
                  )}
                >
                  DB
                </button>
                <button
                  onClick={() => onStatusChange(e.eventKey, '')}
                  className={cn(
                    'px-2 py-1 rounded-md text-xs font-bold transition-colors',
                    e.status === ''
                      ? 'bg-[var(--color-border)] text-[var(--color-text-secondary)]'
                      : 'bg-[var(--color-bg-base)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-elevated)]',
                  )}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-center text-xs text-[var(--color-text-muted)] py-8">검색 결과가 없습니다.</p>
          )}
        </div>

        {/* 닫기 */}
        <div className="px-5 py-4 border-t border-[var(--color-border-subtle)] flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full py-2 rounded-lg bg-[var(--color-brand)] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            완료
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── 메인 페이지 ──────────────────────────────────────────────────────────────
export const EventsPage = () => {
  const { t } = useTranslation()
  const { events, addEvent, deleteEvent, toggleHidden, toggleShowHidden, showHidden, updateStatus, bulkUpdateEvent, bulkUpdateMember, getFiltered, searchQuery, setSearchQuery, getSummary, loadData, loading, attendance: allAttendance } = useEventStore()
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

  const hiddenCount = events.filter(e => e.hidden).length
  // 최신순(역순) + 숨김 필터
  const visibleEvents = [...events].reverse().filter(e => showHidden || !e.hidden)

  const attendance = [...baseAttendance].sort((a, b) => {
    if (!sortDir) return 0
    const calcTotal = (rec: Record<string, string>) =>
      visibleEvents.reduce((acc, e) => {
        const s = rec[e.eventKey] ?? ''
        return acc + (s === 'CT' || s === 'DB' ? 1 : 0)
      }, 0)
    const cmp = sortKey === 'inGameName' ? a.inGameName.localeCompare(b.inGameName) : calcTotal(a.records) - calcTotal(b.records)
    return sortDir === 'asc' ? cmp : -cmp
  })

  const [showAddEvent, setShowAddEvent] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [newEventName, setNewEventName] = useState('')
  const [newEventDate, setNewEventDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [attendanceModalEventId, setAttendanceModalEventId] = useState<string | null>(null)
  const [memberModalId, setMemberModalId] = useState<string | null>(null)

  useEffect(() => { loadData() }, [loadData])

  const attendanceModalEvent = useMemo(
    () => attendanceModalEventId ? events.find((e) => e.id === attendanceModalEventId) ?? null : null,
    [attendanceModalEventId, events],
  )
  const attendanceModalMembers = useMemo(() => {
    if (!attendanceModalEventId) return []
    return allAttendance.map((a) => ({
      memberId: a.memberId,
      inGameName: a.inGameName,
      status: (a.records[attendanceModalEventId] ?? '') as AttendanceStatus,
    }))
  }, [attendanceModalEventId, allAttendance])

  const handleModalStatusChange = (memberId: string, status: AttendanceStatus) => {
    updateStatus(memberId, attendanceModalEventId!, status)
  }

  const handleModalBulkSet = (status: AttendanceStatus) => {
    const updates = allAttendance.map((a) => ({ memberId: a.memberId, status }))
    bulkUpdateEvent(attendanceModalEventId!, updates)
  }

  // 회원별 모달 데이터
  const memberModalData = useMemo(() => {
    if (!memberModalId) return null
    const member = allAttendance.find((a) => a.memberId === memberModalId)
    if (!member) return null
    return {
      memberId: member.memberId,
      memberName: member.inGameName,
      events: visibleEvents.map((e) => ({
        eventKey: e.eventKey,
        name: e.name,
        date: e.date ?? '',
        status: (member.records[e.eventKey] ?? '') as AttendanceStatus,
      })),
    }
  }, [memberModalId, allAttendance, visibleEvents])

  const handleMemberModalStatusChange = (eventKey: string, status: AttendanceStatus) => {
    updateStatus(memberModalId!, eventKey, status)
  }

  const handleMemberModalBulkSet = (status: AttendanceStatus) => {
    const updates = visibleEvents.map((e) => ({ eventKey: e.eventKey, status }))
    bulkUpdateMember(memberModalId!, updates)
  }

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
            {t('events.subtitle', { events: visibleEvents.length, members: attendance.length })}
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
          {canEdit && hiddenCount > 0 && (
            <Button size="sm" variant="outline" onClick={toggleShowHidden}>
              {showHidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              <span className="hidden sm:inline">{showHidden ? '숨김 해제' : `숨긴 이벤트 ${hiddenCount}개`}</span>
            </Button>
          )}
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
                  className="px-2 sm:px-3 py-2.5 sm:py-3 text-left text-[var(--color-text-muted)] whitespace-nowrap sticky left-0 bg-[var(--color-bg-surface)] min-w-[90px] sm:min-w-[140px] cursor-pointer select-none hover:text-[var(--color-text-primary)] transition-colors"
                >
                  {t('events.col_name')}<SortIcon dir={sortKey === 'inGameName' ? sortDir : null} />
                </th>
                <th
                  onClick={() => handleSort('total')}
                  className="px-1 sm:px-3 py-2.5 sm:py-3 text-center text-[var(--color-text-muted)] whitespace-nowrap min-w-[32px] sm:min-w-[52px] cursor-pointer select-none hover:text-[var(--color-text-primary)] transition-colors"
                >
                  {t('events.col_attended')}<SortIcon dir={sortKey === 'total' ? sortDir : null} />
                </th>
                {visibleEvents.map((e) => (
                  <th key={e.eventKey} className={cn('px-1 sm:px-2 py-2 sm:py-2.5 text-center text-[var(--color-text-muted)] whitespace-nowrap min-w-[42px] sm:min-w-[64px] group', e.hidden && 'opacity-40')}>
                    <div className="hidden sm:block text-[10px] font-normal leading-none mb-0.5">{e.date?.slice(5) ?? ''}</div>
                    <button
                      onClick={() => canEdit && setAttendanceModalEventId(e.id)}
                      className={cn(
                        'font-semibold text-[10px] sm:text-[11px] flex items-center justify-center gap-0.5 w-full',
                        canEdit && 'hover:text-[var(--color-brand)] transition-colors cursor-pointer',
                      )}
                      title={canEdit ? '출석 입력' : undefined}
                    >
                      <span className="sm:hidden">{e.name.length > 4 ? e.name.slice(0, 4) + '…' : e.name}</span>
                      <span className="hidden sm:inline">{e.name.length > 8 ? e.name.slice(0, 8) + '…' : e.name}</span>
                    </button>
                    {canEdit && (
                      <div className="hidden sm:flex items-center justify-center gap-0.5 mt-1 h-5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setAttendanceModalEventId(e.id)}
                          className="p-1 rounded text-[var(--color-brand)] hover:bg-[var(--color-brand)]/20 transition-colors"
                          title="출석 입력"
                        >
                          <ClipboardList className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => toggleHidden(e.id)}
                          className={cn(
                            'p-1 rounded transition-colors',
                            e.hidden
                              ? 'text-[var(--color-brand)] hover:bg-[var(--color-brand)]/20'
                              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-elevated)]',
                          )}
                          title={e.hidden ? '숨김 해제' : '숨기기'}
                        >
                          {e.hidden ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(e.id)}
                          className="p-1 rounded text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 transition-colors"
                          title="삭제"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-subtle)]">
              {attendance.map((a) => {
                const total = visibleEvents.reduce((acc, e) => {
                  const s = a.records[e.eventKey] ?? ''
                  return acc + (s === 'CT' || s === 'DB' ? 1 : 0)
                }, 0)
                return (
                  <tr key={a.memberId} className="hover:bg-[var(--color-bg-surface)] transition-colors">
                    <td className="px-2 sm:px-3 py-2 sm:py-2.5 font-medium whitespace-nowrap sticky left-0 bg-[var(--color-bg-base)] hover:bg-[var(--color-bg-surface)]">
                      {canEdit ? (
                        <button
                          onClick={() => setMemberModalId(a.memberId)}
                          className="text-left text-[var(--color-text-primary)] hover:text-[var(--color-brand)] transition-colors"
                          title="출석 일괄 입력"
                        >
                          {a.inGameName}
                        </button>
                      ) : (
                        <span className="text-[var(--color-text-primary)]">{a.inGameName}</span>
                      )}
                    </td>
                    <td className="px-1 sm:px-3 py-2 sm:py-2.5 text-center">
                      <span className="text-[var(--color-success)] font-bold">{total}</span>
                    </td>
                    {visibleEvents.map((e) => {
                      const status = a.records[e.eventKey] ?? ''
                      return (
                        <td
                          key={e.eventKey}
                          onClick={() => canEdit && handleCellClick(a.memberId, e.eventKey, status)}
                          className={cn(
                            'px-1 sm:px-2 py-2 sm:py-2.5 text-center cursor-pointer select-none transition-colors text-[10px] sm:text-[11px] font-bold',
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
            <tfoot className="sticky bottom-0 z-10">
              <tr className="bg-[var(--color-bg-surface)] border-t-2 border-[var(--color-border)]">
                <td className="px-2 sm:px-3 py-2 sm:py-2.5 font-semibold text-[var(--color-text-muted)] text-xs whitespace-nowrap sticky left-0 bg-[var(--color-bg-surface)]">
                  {t('common.total')} / {t('common.count_people')}
                </td>
                <td className="px-1 sm:px-3 py-2 sm:py-2.5 text-center">
                  <span className="text-xs font-bold text-[var(--color-text-primary)]">
                    {attendance.filter(a =>
                      visibleEvents.some(e => { const s = a.records[e.eventKey] ?? ''; return s === 'CT' || s === 'DB' })
                    ).length}
                  </span>
                </td>
                {visibleEvents.map((e) => {
                  const count = attendance.filter(a => {
                    const s = a.records[e.eventKey] ?? ''
                    return s === 'CT' || s === 'DB'
                  }).length
                  return (
                    <td key={e.eventKey} className="px-1 sm:px-2 py-2 sm:py-2.5 text-center">
                      <span className={cn('text-xs font-bold', count > 0 ? 'text-[var(--color-brand)]' : 'text-[var(--color-text-muted)]')}>
                        {count}
                      </span>
                    </td>
                  )
                })}
              </tr>
            </tfoot>
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

      {memberModalId && memberModalData && (
        <MemberAttendanceModal
          memberId={memberModalData.memberId}
          memberName={memberModalData.memberName}
          events={memberModalData.events}
          onStatusChange={handleMemberModalStatusChange}
          onBulkSet={handleMemberModalBulkSet}
          onClose={() => setMemberModalId(null)}
        />
      )}

      {attendanceModalEventId && attendanceModalEvent && (
        <AttendanceModal
          eventId={attendanceModalEventId}
          eventName={attendanceModalEvent.name}
          eventDate={attendanceModalEvent.date ?? ''}
          attendance={attendanceModalMembers}
          onStatusChange={handleModalStatusChange}
          onBulkSet={handleModalBulkSet}
          onClose={() => setAttendanceModalEventId(null)}
        />
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
