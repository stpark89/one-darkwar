import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Wifi, Swords, CalendarDays, Loader2, AlertCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useMemberStore } from '@/infrastructure/stores/memberStore'
import { useWarStore } from '@/infrastructure/stores/warStore'
import { useEventStore } from '@/infrastructure/stores/eventStore'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { useApprovalStore } from '@/infrastructure/stores/approvalStore'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

const ONLINE_MS = 5 * 60 * 1000

export const HomePage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const { user } = useAuthStore()
  const { members, loadMembers } = useMemberStore()
  const warStore = useWarStore()
  const eventStore = useEventStore()
  const { pendingCount, loadPending } = useApprovalStore()

  const [onlineCount, setOnlineCount] = useState<number>(0)
  const [loading, setLoading] = useState(true)

  // Load all data on mount
  useEffect(() => {
    const init = async () => {
      setLoading(true)
      const promises: Promise<unknown>[] = []

      if (members.length === 0) promises.push(loadMembers())
      if (warStore.rounds.length === 0 && !warStore.loading) promises.push(warStore.loadData())
      if (eventStore.events.length === 0 && !eventStore.loading) promises.push(eventStore.loadData())

      // Fetch online count from supabase directly
      const onlineFetch = async () => {
        const { data } = await supabase
          .from('profiles')
          .select('last_seen_at')
          .eq('status', 'APPROVED')
        const count = (data ?? []).filter(
          (r) => r.last_seen_at && Date.now() - new Date(r.last_seen_at).getTime() < ONLINE_MS,
        ).length
        setOnlineCount(count)
      }

      promises.push(onlineFetch())

      if (user?.role === 'ROLE_ADMIN') promises.push(loadPending())

      await Promise.all(promises)
      setLoading(false)
    }

    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Derived stats
  const warSummary = warStore.getSummary()
  const eventSummary = eventStore.getSummary()
  const { events, attendance } = eventStore
  const { rounds } = warStore

  const warRate =
    members.length > 0
      ? Math.round((warSummary.filter((m) => m.total > 0).length / members.length) * 100)
      : 0

  const visibleEvents = events.filter((e) => !e.hidden)
  const eventRate =
    members.length > 0 && visibleEvents.length > 0
      ? Math.round(
          (eventSummary.reduce((acc, m) => acc + m.total, 0) /
            (members.length * visibleEvents.length)) *
            100,
        )
      : 0

  // TOP 5 contributors (war + event combined)
  const top5 = (() => {
    const warMap = new Map(warSummary.map((r) => [r.memberId, r.total]))
    const eventMap = new Map(eventSummary.map((r) => [r.memberId, r.total]))

    const allIds = new Set([...warMap.keys(), ...eventMap.keys()])
    const combined = Array.from(allIds).map((id) => {
      const warTotal = warMap.get(id) ?? 0
      const eventTotal = eventMap.get(id) ?? 0
      const member =
        warSummary.find((r) => r.memberId === id) ??
        eventSummary.find((r) => r.memberId === id)
      return {
        memberId: id,
        inGameName: member?.inGameName ?? id,
        warTotal,
        eventTotal,
        total: warTotal + eventTotal,
      }
    })

    return combined.sort((a, b) => b.total - a.total).slice(0, 5)
  })()

  // Recent events (latest 5, including hidden, with attendance rate)
  const recentEvents = [...events]
    .reverse()
    .slice(0, 5)
    .map((event) => {
      const attended =
        members.length > 0
          ? attendance.filter(
              (a) => a.records[event.eventKey] === 'CT' || a.records[event.eventKey] === 'DB',
            ).length
          : 0
      const pct = members.length > 0 ? Math.round((attended / members.length) * 100) : 0
      return { ...event, pct }
    })

  const isAdmin = user?.role === 'ROLE_ADMIN'

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-[var(--color-text-muted)]">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        {t('common.loading')}
      </div>
    )
  }

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-lg sm:text-xl font-bold text-[var(--color-text-primary)]">
          {t('home.title')}
        </h1>
        {user && (
          <p className="text-xs sm:text-sm text-[var(--color-text-muted)] mt-0.5">
            {t('home.greeting', { name: user.inGameName })}
          </p>
        )}
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={<Users className="w-5 h-5" />}
          label={t('home.stat_members')}
          value={members.length}
          color="text-[var(--color-brand)]"
          iconBg="bg-[var(--color-brand)]/15"
        />
        <StatCard
          icon={<Wifi className="w-5 h-5" />}
          label={t('home.stat_online')}
          value={onlineCount}
          color="text-[var(--color-success)]"
          iconBg="bg-[var(--color-success)]/15"
        />
        <StatCard
          icon={<Swords className="w-5 h-5" />}
          label={t('home.stat_war_rate')}
          value={`${warRate}%`}
          sub={rounds.length > 0 ? t('home.war_rounds', { n: rounds.length }) : undefined}
          color="text-blue-400"
          iconBg="bg-blue-400/15"
        />
        <StatCard
          icon={<CalendarDays className="w-5 h-5" />}
          label={t('home.stat_event_rate')}
          value={`${eventRate}%`}
          color="text-[var(--color-warning)]"
          iconBg="bg-[var(--color-warning)]/15"
        />
      </div>

      {/* Middle 2-col grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* TOP 5 Contributors */}
        <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-xl p-4">
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
            <Swords className="w-4 h-4 text-[var(--color-brand)]" />
            {t('home.top5_title')}
          </h2>
          {top5.length === 0 ? (
            <p className="text-xs text-[var(--color-text-muted)] py-4 text-center">
              {t('home.top5_no_data')}
            </p>
          ) : (
            <ol className="space-y-2">
              {top5.map((row, i) => (
                <li key={row.memberId} className="flex items-center gap-3">
                  <span
                    className={cn(
                      'w-6 text-center text-sm font-black flex-shrink-0',
                      i === 0
                        ? 'text-yellow-400'
                        : i === 1
                          ? 'text-gray-300'
                          : i === 2
                            ? 'text-amber-600'
                            : 'text-[var(--color-text-muted)]',
                    )}
                  >
                    {i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}
                  </span>
                  <span className="flex-1 text-sm font-medium text-[var(--color-text-primary)] truncate">
                    {row.inGameName}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] flex-shrink-0">
                    <span className="text-blue-400 font-semibold">
                      {t('home.top5_war', { n: row.warTotal })}
                    </span>
                    <span>·</span>
                    <span className="text-[var(--color-success)] font-semibold">
                      {t('home.top5_event', { n: row.eventTotal })}
                    </span>
                    <span className="ml-1 text-[var(--color-brand)] font-bold">
                      = {row.total}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* Recent Events */}
        <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-xl p-4">
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-[var(--color-brand)]" />
            {t('home.recent_events_title')}
          </h2>
          {recentEvents.length === 0 ? (
            <p className="text-xs text-[var(--color-text-muted)] py-4 text-center">
              {t('home.event_no_data')}
            </p>
          ) : (
            <ul className="space-y-2">
              {recentEvents.map((event) => (
                <li
                  key={event.id}
                  className="flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {event.hidden && (
                      <span className="text-[9px] px-1 rounded bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] flex-shrink-0">
                        hidden
                      </span>
                    )}
                    <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                      {event.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 text-xs text-[var(--color-text-muted)]">
                    {event.date && (
                      <span>{event.date.slice(5)}</span>
                    )}
                    <span
                      className={cn(
                        'font-semibold',
                        event.pct >= 70
                          ? 'text-[var(--color-success)]'
                          : event.pct >= 40
                            ? 'text-[var(--color-warning)]'
                            : 'text-[var(--color-danger)]',
                      )}
                    >
                      {t('home.event_attendance_rate', { pct: event.pct })}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Admin Pending Banner */}
      {isAdmin && pendingCount > 0 && (
        <button
          onClick={() => navigate('/approval')}
          className="w-full flex items-center justify-between gap-3 bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/40 rounded-xl px-4 py-3 hover:bg-[var(--color-warning)]/15 transition-colors"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-[var(--color-warning)] flex-shrink-0" />
            <span className="text-sm font-medium text-[var(--color-warning)]">
              {t('home.pending_banner', { count: pendingCount })}
            </span>
          </div>
          <span className="text-xs font-semibold text-[var(--color-warning)] border border-[var(--color-warning)]/40 rounded-lg px-2.5 py-1 flex-shrink-0">
            {t('home.pending_go')}
          </span>
        </button>
      )}
    </div>
  )
}

interface StatCardProps {
  icon: React.ReactNode
  label: string
  value: string | number
  sub?: string
  color: string
  iconBg: string
}

function StatCard({ icon, label, value, sub, color, iconBg }: StatCardProps) {
  return (
    <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-xl p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-[var(--color-text-muted)] mb-1">{label}</p>
          <p className={cn('text-2xl font-bold', color)}>{value}</p>
          {sub && <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">{sub}</p>}
        </div>
        <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0', iconBg, color)}>
          {icon}
        </div>
      </div>
    </div>
  )
}
