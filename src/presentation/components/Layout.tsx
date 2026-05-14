import { useState, useRef, useEffect } from 'react'
import { Outlet, Navigate, useNavigate } from 'react-router-dom'
import { Menu, Swords, Loader2, User, ShieldCheck, KeyRound, LogOut } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { ChatWidget } from './ChatWidget'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

export const Layout = () => {
  const { user, loading, signOut } = useAuthStore()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

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

  if (loading) return (
    <div className="min-h-screen bg-[var(--color-bg-base)] flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-[var(--color-brand)]" />
    </div>
  )

  if (!user) return <Navigate to="/sign-in" replace />

  return (
    <div className="flex min-h-screen overflow-x-hidden">
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
          'flex-1 min-h-screen bg-[var(--color-bg-base)] transition-all duration-200',
          'ml-0',
          collapsed ? 'md:ml-14' : 'md:ml-56',
        )}
      >
        {/* 모바일 상단 헤더 */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-[var(--color-bg-surface)] border-b border-[var(--color-border-subtle)] sticky top-0 z-20">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-primary)]"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 flex-1">
            <div className="w-6 h-6 rounded bg-[var(--color-brand)] flex items-center justify-center">
              <Swords className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-bold text-[var(--color-text-primary)]">ONE DARK WAR</span>
          </div>
          {/* 모바일 유저 메뉴 */}
          {user && (
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

        <Outlet />
      </main>
      <ChatWidget />
    </div>
  )
}
