import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Users, Swords, CalendarDays, FileSpreadsheet, BarChart3, ChevronUp, ChevronLeft, ChevronRight, X, LogOut, ShieldCheck, User } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { LANGUAGES, type LangCode } from '@/i18n'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { cn } from '@/lib/utils'

interface SidebarProps {
  collapsed: boolean
  onToggleCollapse: () => void
  mobileOpen: boolean
  onCloseMobile: () => void
}

export const Sidebar = ({ collapsed, onToggleCollapse, mobileOpen, onCloseMobile }: SidebarProps) => {
  const { t, i18n } = useTranslation()
  const { user, signOut } = useAuthStore()
  const navigate = useNavigate()
  const [langOpen, setLangOpen] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    navigate('/sign-in', { replace: true })
  }

  const currentLang = LANGUAGES.find((l) => l.code === i18n.language) ?? LANGUAGES[0]

  const NAV = [
    { to: '/members', icon: Users, label: t('nav.members') },
    { to: '/war', icon: Swords, label: t('nav.war') },
    { to: '/events', icon: CalendarDays, label: t('nav.events') },
    { to: '/contribution', icon: BarChart3, label: t('nav.contribution') },
    { to: '/excel', icon: FileSpreadsheet, label: t('nav.excel') },
  ]

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-full flex flex-col bg-[var(--color-bg-surface)] border-r border-[var(--color-border-subtle)] z-40 transition-all duration-200',
        'w-64 md:w-56',
        collapsed && 'md:w-14',
        mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
      )}
    >
      {/* 로고 */}
      <div className={cn('flex items-center border-b border-[var(--color-border-subtle)]', collapsed ? 'md:justify-center px-5 md:px-0 py-5' : 'gap-3 px-5 py-5')}>
        <div className="w-8 h-8 rounded-lg bg-[var(--color-brand)] flex items-center justify-center flex-shrink-0">
          <Swords className="w-4 h-4 text-white" />
        </div>
        <div className={cn('transition-all', collapsed && 'md:hidden')}>
          <p className="text-xs font-bold text-[var(--color-text-primary)] leading-tight">ONE</p>
          <p className="text-[10px] text-[var(--color-text-muted)]">DARK WAR</p>
        </div>
        {/* 모바일 닫기 버튼 */}
        <button
          onClick={onCloseMobile}
          className="ml-auto md:hidden p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 네비게이션 */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            title={collapsed ? label : undefined}
            onClick={onCloseMobile}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all',
                collapsed && 'md:justify-center md:px-0',
                isActive
                  ? 'bg-[var(--color-brand)]/15 text-[var(--color-brand)] font-semibold'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-primary)]',
              )
            }
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            <span className={cn(collapsed && 'md:hidden')}>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* 언어 선택 */}
      <div className={cn('px-3 py-3 border-t border-[var(--color-border-subtle)]', collapsed && 'md:flex md:justify-center md:px-0')}>
        {!collapsed && (
          <p className="text-[10px] text-[var(--color-text-muted)] px-1 mb-1.5 md:block">{t('nav.language')}</p>
        )}

        <button
          onClick={() => setLangOpen((v) => !v)}
          title={collapsed ? currentLang.label : undefined}
          className={cn(
            'w-full flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--color-bg-elevated)] hover:bg-[var(--color-border)] transition-colors',
            collapsed && 'md:w-9 md:h-9 md:justify-center md:px-0',
          )}
        >
          <span className={cn('flex items-center gap-2 text-sm text-[var(--color-text-primary)]')}>
            <span className="text-base leading-none">{currentLang.flag}</span>
            <span className={cn(collapsed && 'md:hidden')}>{currentLang.label}</span>
          </span>
          <ChevronUp className={cn('w-3.5 h-3.5 text-[var(--color-text-muted)] transition-transform', langOpen ? '' : 'rotate-180', collapsed && 'md:hidden')} />
        </button>

        {langOpen && (
          <div className={cn('mt-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] shadow-xl overflow-hidden', collapsed && 'md:absolute md:left-16 md:bottom-16 md:w-40')}>
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => {
                  i18n.changeLanguage(lang.code as LangCode)
                  setLangOpen(false)
                }}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors text-left',
                  i18n.language === lang.code
                    ? 'bg-[var(--color-brand)]/15 text-[var(--color-brand)] font-semibold'
                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-primary)]',
                )}
              >
                <span className="text-base">{lang.flag}</span>
                {lang.label}
                {i18n.language === lang.code && (
                  <span className="ml-auto text-[10px] text-[var(--color-brand)]">✓</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 유저 정보 + 로그아웃 */}
      {user && (
        <div className={cn('px-3 py-3 border-t border-[var(--color-border-subtle)]', collapsed && 'md:flex md:justify-center md:px-0')}>
          <div className={cn('flex items-center gap-2 px-2 py-2 rounded-lg', collapsed && 'md:justify-center md:px-0')}>
            <div className="w-7 h-7 rounded-full bg-[var(--color-brand)]/20 flex items-center justify-center flex-shrink-0">
              {user.role === 'ROLE_ADMIN'
                ? <ShieldCheck className="w-3.5 h-3.5 text-[var(--color-brand)]" />
                : <User className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />}
            </div>
            <div className={cn('flex-1 min-w-0', collapsed && 'md:hidden')}>
              <p className="text-xs font-semibold text-[var(--color-text-primary)] truncate">{user.inGameName}</p>
              <p className="text-[10px] text-[var(--color-text-muted)]">
                {user.role === 'ROLE_ADMIN' ? t('auth.role_admin') : t('auth.role_user')}
              </p>
            </div>
            <button
              onClick={handleSignOut}
              title={t('auth.sign_out')}
              className={cn('p-1.5 rounded hover:bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] hover:text-[var(--color-danger)] transition-colors flex-shrink-0', collapsed && 'md:hidden')}
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
          {collapsed && (
            <button
              onClick={handleSignOut}
              title={t('auth.sign_out')}
              className="hidden md:flex items-center justify-center w-9 h-9 rounded hover:bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] hover:text-[var(--color-danger)] transition-colors mx-auto mt-1"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* 버전 + 데스크톱 토글 버튼 */}
      <div className={cn('px-5 py-2.5 border-t border-[var(--color-border-subtle)] flex items-center', collapsed ? 'md:justify-center md:px-0' : 'justify-between')}>
        <p className={cn('text-[10px] text-[var(--color-text-muted)]', collapsed && 'md:hidden')}>v0.1.0 · ONE DARK WAR</p>
        <button
          onClick={onToggleCollapse}
          className="hidden md:flex items-center justify-center w-6 h-6 rounded hover:bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
      </div>
    </aside>
  )
}
