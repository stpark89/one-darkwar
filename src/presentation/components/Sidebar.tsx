import { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Home, Users, Swords, CalendarDays, FileSpreadsheet, BarChart3, Megaphone, ChevronUp, ChevronLeft, ChevronRight, X, LogOut, ShieldCheck, User, KeyRound, UserX, UserCheck, MessageSquare, Target, UserPlus, MessageCircleQuestion, Eye, EyeOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { LANGUAGES, type LangCode } from '@/i18n'
import { useAuthStore } from '@/infrastructure/stores/authStore'
import { useApprovalStore } from '@/infrastructure/stores/approvalStore'
import { getSessionAvatar } from '@/lib/avatars'
import { cn } from '@/lib/utils'

interface SidebarProps {
  collapsed: boolean
  onToggleCollapse: () => void
  mobileOpen: boolean
  onCloseMobile: () => void
}

export const Sidebar = ({ collapsed, onToggleCollapse, mobileOpen, onCloseMobile }: SidebarProps) => {
  const { t, i18n } = useTranslation()
  const { user, signOut, isGuest, isTourMode, exitTourMode } = useAuthStore()
  const { pendingCount, loadPending } = useApprovalStore()
  const navigate = useNavigate()
  const [langOpen, setLangOpen] = useState(false)

  useEffect(() => {
    if (user?.role === 'ROLE_ADMIN') loadPending()
  }, [user, loadPending])

  const handleSignOut = async () => {
    await signOut()
    navigate('/sign-in', { replace: true })
  }

  const currentLang = LANGUAGES.find((l) => l.code === i18n.language) ?? LANGUAGES[0]

  const NAV_GENERAL = [
    { to: '/', icon: Home, label: t('nav.home'), end: true },
    { to: '/notices', icon: Megaphone, label: t('notice.nav'), end: false },
    { to: '/board', icon: MessageSquare, label: t('board.nav'), end: false },
    { to: '/members', icon: Users, label: t('nav.members'), end: false },
    { to: '/war', icon: Swords, label: t('nav.war'), end: false },
    { to: '/vs-point', icon: Target, label: t('nav.vs_point'), end: false },
    { to: '/events', icon: CalendarDays, label: t('nav.events'), end: false },
  ]

  const NAV_GUEST = [
    { to: '/', icon: Home, label: t('nav.home'), end: true },
    { to: '/questions', icon: MessageCircleQuestion, label: t('nav.questions'), end: false },
    { to: '/transfer', icon: UserPlus, label: t('nav.transfer'), end: false },
  ]

  const NAV_ADMIN = [
    { to: '/contribution', icon: BarChart3, label: t('nav.contribution'), badge: 0 },
    { to: '/excel', icon: FileSpreadsheet, label: t('nav.excel'), badge: 0 },
    { to: '/approval', icon: UserCheck, label: t('nav.join_management'), badge: pendingCount },
    { to: '/questions', icon: MessageCircleQuestion, label: t('nav.questions'), badge: 0 },
    { to: '/transfer', icon: UserPlus, label: t('nav.transfer'), badge: 0 },
  ]

  // 게스트가 둘러보기 모드면 NAV_GENERAL 을 read-only 로 노출
  const navItems = isGuest
    ? (isTourMode ? NAV_GENERAL : NAV_GUEST)
    : NAV_GENERAL

  const handleExitTour = () => {
    exitTourMode()
    navigate('/', { replace: true })
    onCloseMobile()
  }

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-full flex flex-col bg-[var(--color-bg-surface)] border-r border-[var(--color-border-subtle)] z-40 transition-all duration-200',
        'w-64 md:w-56',
        collapsed && 'md:w-14',
        mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
      )}
      style={{
        // iOS PWA: 노치 / 홈 인디케이터 영역 회피
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {/* 로고 */}
      <div className={cn('flex items-center border-b border-[var(--color-border-subtle)]', collapsed ? 'md:justify-center px-5 md:px-0 py-5' : 'gap-3 px-5 py-5')}>
        <NavLink
          to="/"
          onClick={onCloseMobile}
          className={cn('flex items-center gap-3 flex-1 min-w-0', collapsed && 'md:justify-center')}
        >
          <div className="w-8 h-8 rounded-lg overflow-hidden bg-[var(--color-bg-elevated)] flex-shrink-0">
            <img src={getSessionAvatar()} alt="ONE" className="w-full h-full object-cover" />
          </div>
          <div className={cn('transition-all', collapsed && 'md:hidden')}>
            <p className="text-xs font-bold text-[var(--color-text-primary)] leading-tight">ONE</p>
            <p className="text-[10px] text-[var(--color-text-muted)]">DARK WAR</p>
          </div>
        </NavLink>
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
        {/* 일반 메뉴 (게스트면 NAV_GUEST, 아니면 NAV_GENERAL) */}
        {navItems.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
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

        {/* 관리자 전용 섹션 (게스트는 표시 안 함) */}
        {!isGuest && user?.role === 'ROLE_ADMIN' && (
          <>
            <div className={cn('pt-3 pb-1', collapsed && 'md:hidden')}>
              <p className="px-3 text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">{t('nav.admin_section')}</p>
            </div>
            {!collapsed && <div className="mx-3 border-t border-[var(--color-border-subtle)] md:block hidden" />}
            {NAV_ADMIN.map(({ to, icon: Icon, label, badge }) => (
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
                <div className="relative flex-shrink-0">
                  <Icon className="w-4 h-4" />
                  {badge > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[var(--color-danger)] text-white text-[9px] font-bold flex items-center justify-center">
                      {badge > 9 ? '9+' : badge}
                    </span>
                  )}
                </div>
                <span className={cn('flex-1', collapsed && 'md:hidden')}>{label}</span>
                {badge > 0 && !collapsed && (
                  <span className="md:flex hidden items-center justify-center px-1.5 py-0.5 rounded-full bg-[var(--color-danger)] text-white text-[10px] font-bold min-w-[18px]">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </NavLink>
            ))}
          </>
        )}
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

      {/* 유저 정보 + 비밀번호 변경 + 로그아웃 */}
      <div className={cn('px-3 py-3 border-t border-[var(--color-border-subtle)]', collapsed && 'md:flex md:flex-col md:items-center md:px-0')}>
        {isGuest ? (
          <>
            <div className={cn('flex items-center gap-2 px-2 py-2 rounded-lg', collapsed && 'md:justify-center md:px-0')}>
              <div className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0',
                isTourMode ? 'bg-[var(--color-brand)]/20' : 'bg-[var(--color-bg-elevated)]',
              )}>
                {isTourMode
                  ? <Eye className="w-3.5 h-3.5 text-[var(--color-brand)]" />
                  : <UserX className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />}
              </div>
              <div className={cn('flex-1 min-w-0', collapsed && 'md:hidden')}>
                <p className="text-xs font-semibold text-[var(--color-text-primary)]">
                  {isTourMode ? t('nav.tour_mode_label') : t('nav.guest_label')}
                </p>
                <p className="text-[10px] text-[var(--color-text-muted)]">
                  {isTourMode ? t('nav.tour_mode_desc') : t('nav.guest_desc')}
                </p>
              </div>
            </div>
            {isTourMode && (
              <button
                onClick={handleExitTour}
                title={t('nav.exit_tour')}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-primary)] transition-colors mt-0.5',
                  collapsed && 'md:w-9 md:h-9 md:justify-center md:px-0',
                )}
              >
                <EyeOff className="w-3.5 h-3.5 flex-shrink-0" />
                <span className={cn(collapsed && 'md:hidden')}>{t('nav.exit_tour')}</span>
              </button>
            )}
            <button
              onClick={() => { handleSignOut(); onCloseMobile() }}
              title={t('nav.go_signin')}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-[var(--color-brand)] hover:bg-[var(--color-brand)]/10 transition-colors mt-0.5',
                collapsed && 'md:w-9 md:h-9 md:justify-center md:px-0',
              )}
            >
              <LogOut className="w-3.5 h-3.5 flex-shrink-0" />
              <span className={cn(collapsed && 'md:hidden')}>{t('nav.go_signin')}</span>
            </button>
          </>
        ) : user && (
          <>
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
            </div>
            <button
              onClick={() => { navigate('/change-password'); onCloseMobile() }}
              title={t('auth.change_password')}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-primary)] transition-colors mt-0.5',
                collapsed && 'md:w-9 md:h-9 md:justify-center md:px-0',
              )}
            >
              <KeyRound className="w-3.5 h-3.5 flex-shrink-0" />
              <span className={cn(collapsed && 'md:hidden')}>{t('auth.change_password')}</span>
            </button>
            <button
              onClick={handleSignOut}
              title={t('auth.sign_out')}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-danger)] transition-colors mt-0.5',
                collapsed && 'md:w-9 md:h-9 md:justify-center md:px-0',
              )}
            >
              <LogOut className="w-3.5 h-3.5 flex-shrink-0" />
              <span className={cn(collapsed && 'md:hidden')}>{t('auth.sign_out')}</span>
            </button>
          </>
        )}
      </div>

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
