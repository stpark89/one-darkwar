import { useEffect, useState, useCallback } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

interface ProfileRow {
  id: string
  in_game_name: string
  role: string
  last_seen_at: string | null
}

type OnlineStatus = 'online' | 'recent' | 'offline'

const ONLINE_MS = 5 * 60 * 1000    // 5분 이내 → 온라인
const RECENT_MS = 30 * 60 * 1000   // 30분 이내 → 최근 활동

function getStatus(lastSeen: string | null): OnlineStatus {
  if (!lastSeen) return 'offline'
  const diff = Date.now() - new Date(lastSeen).getTime()
  if (diff < ONLINE_MS) return 'online'
  if (diff < RECENT_MS) return 'recent'
  return 'offline'
}

function formatLastSeen(lastSeen: string | null, t: (k: string, o?: object) => string): string {
  if (!lastSeen) return t('online.never')
  const diff = Math.floor((Date.now() - new Date(lastSeen).getTime()) / 1000)
  if (diff < 60) return t('online.just_now')
  if (diff < 3600) return t('online.minutes_ago', { n: Math.floor(diff / 60) })
  if (diff < 86400) return t('online.hours_ago', { n: Math.floor(diff / 3600) })
  return t('online.days_ago', { n: Math.floor(diff / 86400) })
}

const STATUS_DOT: Record<OnlineStatus, string> = {
  online: 'bg-green-500',
  recent: 'bg-yellow-400',
  offline: 'bg-[var(--color-border)]',
}

const STATUS_LABEL: Record<OnlineStatus, string> = {
  online: 'online.status_online',
  recent: 'online.status_recent',
  offline: 'online.status_offline',
}

export const OnlineUsersPage = () => {
  const { t } = useTranslation()
  const [profiles, setProfiles] = useState<ProfileRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('id, in_game_name, role, last_seen_at')
      .order('last_seen_at', { ascending: false, nullsFirst: false })
    setProfiles(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const onlineCount = profiles.filter(p => getStatus(p.last_seen_at) === 'online').length

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text-primary)]">{t('online.title')}</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
            {t('online.subtitle', { online: onlineCount, total: profiles.length })}
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-primary)] border border-[var(--color-border-subtle)] transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          {t('online.refresh')}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-[var(--color-text-muted)]">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> {t('common.loading')}
        </div>
      ) : (
        <div className="rounded-lg border border-[var(--color-border-subtle)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)]">
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)]">#</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)]">{t('online.col_name')}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)]">{t('online.col_role')}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)]">{t('online.col_status')}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)]">{t('online.col_last_seen')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-subtle)]">
              {profiles.map((p, i) => {
                const status = getStatus(p.last_seen_at)
                return (
                  <tr key={p.id} className="hover:bg-[var(--color-bg-surface)] transition-colors">
                    <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">{i + 1}</td>
                    <td className="px-4 py-3 font-medium text-[var(--color-text-primary)]">{p.in_game_name}</td>
                    <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">
                      {p.role === 'ROLE_ADMIN' ? t('auth.role_admin') : t('auth.role_user')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={cn('w-2 h-2 rounded-full flex-shrink-0', STATUS_DOT[status], status === 'online' && 'animate-pulse')} />
                        <span className={cn('text-xs', status === 'online' ? 'text-green-500 font-semibold' : status === 'recent' ? 'text-yellow-400' : 'text-[var(--color-text-muted)]')}>
                          {t(STATUS_LABEL[status])}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">
                      {formatLastSeen(p.last_seen_at, t)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[10px] text-[var(--color-text-muted)] mt-3">{t('online.hint')}</p>
    </div>
  )
}
