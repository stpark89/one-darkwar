import { useState, useRef, useEffect } from 'react'
import { Outlet, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { Menu, Loader2, User, ShieldCheck, KeyRound, LogOut, UserX, Megaphone, Pin, X } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { ChatWidget } from './ChatWidget'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { useNoticeStore } from '@/infrastructure/stores/noticeStore'
import { useTranslation } from 'react-i18next'
import { getSessionAvatar } from '@/lib/avatars'
import { cn } from '@/lib/utils'

export const Layout = () => {
  const { user, loading, signOut, isGuest, isTourMode } = useAuthStore()
  const { notices, loadNotices } = useNoticeStore()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [dismissedNoticeId, setDismissedNoticeId] = useState<string | null>(
    () => sessionStorage.getItem('dismissedNoticeId')
  )
  const userMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => { loadNotices() }, [loadNotices])

  // authStore.loading 이 어떤 이유로 5초 이상 stuck 되면 spinner 를 강제로
  // 풀어 화면 진입을 보장. 진짜 hang 이어도 사용자가 sign-in 페이지로라도
  // 갈 수 있게 — '아무것도 안 보이는 검은 화면 무한 spinner' 방지.
  const [forceUnblock, setForceUnblock] = useState(false)
  useEffect(() => {
    if (!loading) {
      setForceUnblock(false)
      return
    }
    const t = setTimeout(() => setForceUnblock(true), 5000)
    return () => clearTimeout(t)
  }, [loading])

  // 핀 공지 우선, 없으면 최신 공지
  const prominentNotice = notices.find(n => n.pinned) ?? notices[0] ?? null
  const showBanner =
    !isGuest &&
    prominentNotice !== null &&
    prominentNotice.id !== dismissedNoticeId &&
    location.pathname !== '/notices'

  const handleDismiss = () => {
    if (!prominentNotice) return
    sessionStorage.setItem('dismissedNoticeId', prominentNotice.id)
    setDismissedNoticeId(prominentNotice.id)
  }

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSignOut = async () => {
    await signOut()
    navigate('/sign-in', { replace: true })
  }

  const handleGuestExit = () => {
    signOut()
    navigate('/sign-in', { replace: true })
  }

  if (loading && !forceUnblock) return (
    <div className="min-h-screen min-h-dvh bg-[var(--color-bg-base)] flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-[var(--color-brand)]" />
    </div>
  )

  if (!user && !isGuest) return <Navigate to="/sign-in" replace />

  // 게스트는 허용된 경로 외 접근 시 게스트 홈으로 돌려보냄
  // 둘러보기(tour) 모드 시 일반 메뉴 경로 추가 허용 (read-only)
  const GUEST_ALLOWED_BASE = ['/', '/home', '/transfer', '/transfer/status', '/transfer/list', '/questions']
  const GUEST_ALLOWED_TOUR = [
    ...GUEST_ALLOWED_BASE,
    '/notices', '/board', '/members', '/war', '/vs-point', '/events',
  ]
  const guestAllowed = isTourMode ? GUEST_ALLOWED_TOUR : GUEST_ALLOWED_BASE
  if (isGuest && !guestAllowed.includes(location.pathname)) {
    return <Navigate to="/" replace />
  }

  return (
    <div
      className="flex min-h-screen w-full"
      style={{
        maxWidth: '100vw',
        overflowX: 'clip',
        minHeight: '100dvh',  // iOS Safari 동적 툴바 대응 (fallback: min-h-screen)
      }}
    >
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((v) => !v)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <main
        className={cn(
          'flex-1 min-h-screen min-h-dvh bg-[var(--color-bg-base)] transition-all duration-200 min-w-0 overflow-x-clip',
          'ml-0',
          collapsed ? 'md:ml-14' : 'md:ml-56',
        )}
      >
        {/* 공지 배너 + 모바일 헤더를 하나의 sticky 블록으로 묶음 */}
        {/* iOS PWA 노치 회피: 상단 safe-area 확보 */}
        <div
          className="sticky top-0 z-20 bg-[var(--color-bg-base)]"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          {/* 공지 배너 */}
          {showBanner && prominentNotice && (
            <div className="flex items-center gap-2 px-4 py-2 bg-[var(--color-brand)]/20 border-b border-[var(--color-brand)]/30">
              {prominentNotice.pinned
                ? <Pin className="w-3.5 h-3.5 text-[var(--color-brand)] flex-shrink-0" />
                : <Megaphone className="w-3.5 h-3.5 text-[var(--color-brand)] flex-shrink-0" />}
              <button
                onClick={() => navigate('/notices')}
                className="flex-1 min-w-0 text-left text-xs font-medium text-[var(--color-brand)] hover:underline truncate"
              >
                {prominentNotice.title}
              </button>
              <button
                onClick={handleDismiss}
                className="p-1 rounded text-[var(--color-brand)]/60 hover:text-[var(--color-brand)] hover:bg-[var(--color-brand)]/15 transition-colors flex-shrink-0"
                aria-label="close"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* 모바일 상단 헤더 */}
          <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-[var(--color-bg-surface)] border-b border-[var(--color-border-subtle)]">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-primary)]"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 flex-1">
            <div className="w-6 h-6 rounded overflow-hidden bg-[var(--color-bg-elevated)]">
              <img src={getSessionAvatar()} alt="ONE" className="w-full h-full object-cover" />
            </div>
            <span className="text-sm font-bold text-[var(--color-text-primary)]">ONE DARK WAR</span>
          </div>
          {/* 모바일 유저 메뉴 */}
          {isGuest ? (
            <button
              onClick={handleGuestExit}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--color-border-subtle)] text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-bg-elevated)] transition-colors"
            >
              <UserX className="w-3.5 h-3.5" />
              {t('auth.sign_in_btn')}
            </button>
          ) : user && (
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen(v => !v)}
                className="w-8 h-8 rounded-full bg-[var(--color-brand)]/20 flex items-center justify-center"
              >
                {user.role === 'ROLE_ADMIN'
                  ? <ShieldCheck className="w-4 h-4 text-[var(--color-brand)]" />
                  : <User className="w-4 h-4 text-[var(--color-text-muted)]" />}
              </button>
              {userMenuOpen && (
                <div className="absolute right-0 top-10 w-52 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] shadow-xl overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-[var(--color-border-subtle)]">
                    <p className="text-xs font-semibold text-[var(--color-text-primary)] truncate">{user.inGameName}</p>
                    <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                      {user.role === 'ROLE_ADMIN' ? t('auth.role_admin') : t('auth.role_user')}
                    </p>
                  </div>
                  <button
                    onClick={() => { navigate('/change-password'); setUserMenuOpen(false) }}
                    className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] transition-colors"
                  >
                    <KeyRound className="w-4 h-4" />
                    {t('auth.change_password')}
                  </button>
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-danger)] transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    {t('auth.sign_out')}
                  </button>
                </div>
              )}
            </div>
          )}
          </div>
        </div>

        <Outlet />
      </main>
      {!isGuest && <ChatWidget />}
    </div>
  )
}
