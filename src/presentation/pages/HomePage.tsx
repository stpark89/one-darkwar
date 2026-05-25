import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Wifi, Swords, CalendarDays, Loader2, AlertCircle, Megaphone, Pin, ChevronRight, MessageSquare, MessageCircle, Download, X, Share, MoreVertical, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useMemberStore } from '@/infrastructure/stores/memberStore'
import { useWarStore } from '@/infrastructure/stores/warStore'
import { useEventStore } from '@/infrastructure/stores/eventStore'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { useApprovalStore } from '@/infrastructure/stores/approvalStore'
import { useNoticeStore } from '@/infrastructure/stores/noticeStore'
import { useBoardStore } from '@/infrastructure/stores/boardStore'
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
  const { notices, loadNotices } = useNoticeStore()
  const { posts, loadPosts } = useBoardStore()

  const [onlineCount, setOnlineCount] = useState<number>(0)
  const [loading, setLoading] = useState(true)

  // ── PWA 설치 프롬프트 ─────────────────────────────────────────────────────
  type BeforeInstallPromptEvent = Event & {
    prompt: () => Promise<void>
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
  }
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [showInstallHelp, setShowInstallHelp] = useState(false)

  // OS 감지
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !('MSStream' in window)
  const isAndroid = /Android/.test(ua)

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true
    if (standalone) setIsInstalled(true)

    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setIsInstalled(true)
      setInstallPrompt(null)
      setShowInstallHelp(false)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  // 설치 직전 캐시/SW 정리 — 옛 빌드 잔여물로 인한 흰 화면·반영 누락 방지
  // localStorage / IndexedDB는 건드리지 않음(로그인 세션·언어 설정 보존)
  const cleanupBeforeInstall = async () => {
    try {
      if ('caches' in window) {
        const keys = await caches.keys()
        await Promise.all(keys.map((k) => caches.delete(k)))
      }
    } catch (err) {
      console.warn('cache cleanup 실패:', err)
    }
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations()
        await Promise.all(regs.map((r) => r.update()))
      }
    } catch (err) {
      console.warn('SW update 실패:', err)
    }
  }

  const handleInstall = async () => {
    await cleanupBeforeInstall()

    if (installPrompt) {
      await installPrompt.prompt()
      const { outcome } = await installPrompt.userChoice
      if (outcome === 'accepted') setInstallPrompt(null)
      return
    }
    // beforeinstallprompt를 잡지 못한 경우(iOS이거나, 이미 dismiss됐거나 등) 안내 모달
    setShowInstallHelp(true)
  }

  // 이미 설치된 앱에서 새 빌드를 강제로 받아오기 위한 새로고침
  // Cache Storage + ServiceWorker 모두 정리 후 페이지 새로고침
  // localStorage / IndexedDB 는 건드리지 않음(로그인 세션·언어 설정 보존)
  const [refreshing, setRefreshing] = useState(false)
  const handleRefreshApp = async () => {
    if (refreshing) return
    setRefreshing(true)
    try {
      if ('caches' in window) {
        const keys = await caches.keys()
        await Promise.all(keys.map((k) => caches.delete(k)))
      }
    } catch (err) {
      console.warn('cache cleanup 실패:', err)
    }
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations()
        await Promise.all(regs.map((r) => r.unregister()))
      }
    } catch (err) {
      console.warn('SW unregister 실패:', err)
    }
    // 강제 hard reload — 일부 브라우저는 ?_=timestamp 같은 캐시버스터가 더 안전
    window.location.href = `${window.location.pathname}?_t=${Date.now()}`
  }

  // Load all data on mount
  useEffect(() => {
    const init = async () => {
      setLoading(true)
      try {
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
        promises.push(loadNotices())
        promises.push(loadPosts(true))

        // Promise.allSettled 로 일부 실패해도 다른 fetch 완료 보장.
        // 추가로 15초 race timeout — PWA 휴면 후 일부 fetch 가 영원히
        // hang 되는 경우에도 spinner 가 풀리도록 강제 안전망.
        await Promise.race([
          Promise.allSettled(promises),
          new Promise<void>((resolve) => setTimeout(resolve, 15000)),
        ])
      } catch (err) {
        console.error('[HomePage] init exception:', err)
      } finally {
        setLoading(false)
      }
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
      <div className="flex items-start justify-between gap-3 flex-wrap">
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
        {!isInstalled ? (
          <button
            onClick={handleInstall}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--color-brand)] text-white text-xs sm:text-sm font-semibold hover:opacity-90 transition-opacity shadow-md"
          >
            <Download className="w-4 h-4" />
            {t('home.install_btn')}
          </button>
        ) : (
          <button
            onClick={handleRefreshApp}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] text-xs sm:text-sm font-semibold hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-primary)] transition-colors disabled:opacity-40"
            title={t('home.refresh_app_hint')}
          >
            {refreshing
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <RefreshCw className="w-4 h-4" />}
            {t('home.refresh_app')}
          </button>
        )}
      </div>

      {/* 설치 안내 모달 (beforeinstallprompt를 못 잡았을 때) */}
      {showInstallHelp && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border)] w-full max-w-sm p-5">
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-base font-bold text-[var(--color-text-primary)]">{t('home.install_help_title')}</h2>
              <button onClick={() => setShowInstallHelp(false)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] -mt-1 -mr-1 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {isIOS ? (
              <ol className="space-y-3 text-sm text-[var(--color-text-secondary)]">
                <li className="flex gap-2">
                  <span className="font-bold text-[var(--color-brand)]">1.</span>
                  <span className="flex-1 flex items-center gap-1.5 flex-wrap">
                    {t('home.install_help_ios_1_pre')}
                    <Share className="inline w-4 h-4 text-blue-400" />
                    {t('home.install_help_ios_1_post')}
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-[var(--color-brand)]">2.</span>
                  <span className="flex-1">{t('home.install_help_ios_2')}</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-[var(--color-brand)]">3.</span>
                  <span className="flex-1">{t('home.install_help_ios_3')}</span>
                </li>
              </ol>
            ) : isAndroid ? (
              <ol className="space-y-3 text-sm text-[var(--color-text-secondary)]">
                <li className="flex gap-2">
                  <span className="font-bold text-[var(--color-brand)]">1.</span>
                  <span className="flex-1 flex items-center gap-1.5 flex-wrap">
                    {t('home.install_help_android_1_pre')}
                    <MoreVertical className="inline w-4 h-4" />
                    {t('home.install_help_android_1_post')}
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-[var(--color-brand)]">2.</span>
                  <span className="flex-1">{t('home.install_help_android_2')}</span>
                </li>
              </ol>
            ) : (
              <ol className="space-y-3 text-sm text-[var(--color-text-secondary)]">
                <li className="flex gap-2">
                  <span className="font-bold text-[var(--color-brand)]">1.</span>
                  <span className="flex-1">{t('home.install_help_desktop_1')}</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-[var(--color-brand)]">2.</span>
                  <span className="flex-1">{t('home.install_help_desktop_2')}</span>
                </li>
              </ol>
            )}

            <p className="text-[11px] text-[var(--color-text-muted)] mt-4 pt-3 border-t border-[var(--color-border-subtle)]">
              {t('home.install_help_note')}
            </p>
          </div>
        </div>
      )}

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

      {/* 공지사항 위젯 */}
      <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-[var(--color-brand)]" />
            {t('notice.dashboard_title')}
          </h2>
          <button
            onClick={() => navigate('/notices')}
            className="flex items-center gap-0.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-brand)] transition-colors"
          >
            {t('notice.view_all')} <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
        {notices.length === 0 ? (
          <p className="text-xs text-[var(--color-text-muted)] py-4 text-center">{t('notice.no_data')}</p>
        ) : (
          <ul className="divide-y divide-[var(--color-border-subtle)]">
            {notices.slice(0, 3).map((notice) => (
              <li
                key={notice.id}
                className="flex items-center gap-2.5 py-2.5 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => navigate('/notices')}
              >
                {notice.pinned && (
                  <Pin className="w-3 h-3 text-[var(--color-brand)] flex-shrink-0" />
                )}
                {!notice.pinned && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-border)] flex-shrink-0" />
                )}
                <span className="flex-1 text-sm text-[var(--color-text-primary)] truncate font-medium">
                  {notice.title}
                </span>
                <span className="text-[11px] text-[var(--color-text-muted)] flex-shrink-0">
                  {notice.authorName}
                </span>
                <span className="text-[11px] text-[var(--color-text-muted)] flex-shrink-0 hidden sm:block">
                  {new Date(notice.createdAt).toLocaleDateString([], { month: '2-digit', day: '2-digit' })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 게시판 최신 글 */}
      <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-[var(--color-brand)]" />
            {t('home.board_title')}
          </h2>
          <button
            onClick={() => navigate('/board')}
            className="flex items-center gap-0.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-brand)] transition-colors"
          >
            {t('notice.view_all')} <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
        {posts.length === 0 ? (
          <p className="text-xs text-[var(--color-text-muted)] py-4 text-center">{t('board.no_posts')}</p>
        ) : (
          <ul className="divide-y divide-[var(--color-border-subtle)]">
            {posts.slice(0, 5).map((post) => (
              <li
                key={post.id}
                className="flex items-center gap-2.5 py-2.5 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => navigate('/board')}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-border)] flex-shrink-0" />
                <span className="flex-1 text-sm text-[var(--color-text-primary)] truncate font-medium">
                  {post.title}
                </span>
                <span className="text-[11px] text-[var(--color-text-muted)] flex-shrink-0 hidden sm:block">
                  {post.authorName}
                </span>
                {post.commentCount > 0 && (
                  <span className="flex items-center gap-0.5 text-[11px] text-[var(--color-text-muted)] flex-shrink-0">
                    <MessageCircle className="w-3 h-3" />
                    {post.commentCount}
                  </span>
                )}
                <span className="text-[11px] text-[var(--color-text-muted)] flex-shrink-0 hidden sm:block">
                  {new Date(post.createdAt).toLocaleDateString([], { month: '2-digit', day: '2-digit' })}
                </span>
              </li>
            ))}
          </ul>
        )}
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
