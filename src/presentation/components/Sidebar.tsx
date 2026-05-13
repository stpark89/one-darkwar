import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Users, Swords, CalendarDays, FileSpreadsheet, ChevronUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { LANGUAGES, type LangCode } from '@/i18n'
import { cn } from '@/lib/utils'

export const Sidebar = () => {
  const { t, i18n } = useTranslation()
  const [langOpen, setLangOpen] = useState(false)

  const currentLang = LANGUAGES.find((l) => l.code === i18n.language) ?? LANGUAGES[0]

  const NAV = [
    { to: '/members', icon: Users, label: t('nav.members') },
    { to: '/war', icon: Swords, label: t('nav.war') },
    { to: '/events', icon: CalendarDays, label: t('nav.events') },
    { to: '/excel', icon: FileSpreadsheet, label: t('nav.excel') },
  ]

  return (
    <aside className="fixed left-0 top-0 h-full w-56 flex flex-col bg-[var(--color-bg-surface)] border-r border-[var(--color-border-subtle)] z-20">
      {/* 로고 */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-[var(--color-border-subtle)]">
        <div className="w-8 h-8 rounded-lg bg-[var(--color-brand)] flex items-center justify-center flex-shrink-0">
          <Swords className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-xs font-bold text-[var(--color-text-primary)] leading-tight">ONE</p>
          <p className="text-[10px] text-[var(--color-text-muted)]">DARK WAR</p>
        </div>
      </div>

      {/* 네비게이션 */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all',
                isActive
                  ? 'bg-[var(--color-brand)]/15 text-[var(--color-brand)] font-semibold'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-primary)]',
              )
            }
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* 언어 선택 */}
      <div className="px-3 py-3 border-t border-[var(--color-border-subtle)]">
        <p className="text-[10px] text-[var(--color-text-muted)] px-1 mb-1.5">{t('nav.language')}</p>

        {/* 현재 언어 버튼 */}
        <button
          onClick={() => setLangOpen((v) => !v)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--color-bg-elevated)] hover:bg-[var(--color-border)] transition-colors"
        >
          <span className="flex items-center gap-2 text-sm text-[var(--color-text-primary)]">
            <span className="text-base">{currentLang.flag}</span>
            {currentLang.label}
          </span>
          <ChevronUp className={cn('w-3.5 h-3.5 text-[var(--color-text-muted)] transition-transform', langOpen ? '' : 'rotate-180')} />
        </button>

        {/* 언어 목록 (위로 펼침) */}
        {langOpen && (
          <div className="mt-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] shadow-xl overflow-hidden">
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

      {/* 버전 */}
      <div className="px-5 py-2.5 border-t border-[var(--color-border-subtle)]">
        <p className="text-[10px] text-[var(--color-text-muted)]">v0.1.0 · ONE DARK WAR</p>
      </div>
    </aside>
  )
}
