import { useEffect, useState, useCallback } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { supabase } from '@/lib/supabase'
import { useMemberStore } from '@/infrastructure/stores/memberStore'
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

function formatLastSeen(lastSeen: string | null, t: TFunction): string {
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
  const { members, loadMembers } = useMemberStore()
  const [allProfiles, setAllProfiles] = useState<ProfileRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('id, in_game_name, role, last_seen_at')
      .order('last_seen_at', { ascending: false, nullsFirst: false })
    setAllProfiles(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load(); loadMembers() }, [load, loadMembers])

  // 인원수 기준은 멤버 테이블이다.
  //  - profiles 에는 이미 나간 사람의 계정이 남아 있어 그대로 세면 과다 집계된다
  //  - 반대로 멤버 중엔 로그인 계정이 아예 없는 사람도 있어, 계정만 세면 과소 집계된다
  // 그래서 멤버 전원을 나열하고 계정 정보를 인게임명으로 붙인다(두 테이블에 FK 가 없다).
  // 연결 기준은 members.profile_id (FK) — 이름이 바뀌어도 끊기지 않는다.
  // profile_id 가 없는 행만 예전 방식인 인게임명 매칭으로 폴백한다.
  const nameKey = (s: string) => (s ?? '').trim().toLowerCase()
  const profileById = new Map(allProfiles.map(p => [p.id, p]))
  const profileByName = new Map(allProfiles.map(p => [nameKey(p.in_game_name), p]))
  const profiles: ProfileRow[] = members.length === 0
    ? allProfiles
    : members
        .map((m) => {
          const p = m.profileId
            ? profileById.get(m.profileId)
            : profileByName.get(nameKey(m.inGameName))
          return {
            id: p?.id ?? m.id,
            in_game_name: m.inGameName,
            role: p?.role ?? '',
            last_seen_at: p?.last_seen_at ?? null,
          }
        })
        // 최근 접속 순 — 접속 기록이 없는 사람(계정 미보유 포함)은 뒤로
        .sort((a, b) => {
          if (a.last_seen_at === b.last_seen_at) return a.in_game_name.localeCompare(b.in_game_name)
          if (!a.last_seen_at) return 1
          if (!b.last_seen_at) return -1
          return new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime()
        })

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
