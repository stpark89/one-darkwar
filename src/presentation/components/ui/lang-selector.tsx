import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown } from 'lucide-react'
import { LANGUAGES, type LangCode } from '@/i18n'
import { cn } from '@/lib/utils'

export const LangSelector = () => {
  const { i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const current = LANGUAGES.find(l => l.code === i18n.language) ?? LANGUAGES[0]

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-bg-elevated)] hover:bg-[var(--color-border)] border border-[var(--color-border-subtle)] text-sm text-[var(--color-text-secondary)] transition-colors"
      >
        <span className="text-base leading-none">{current.flag}</span>
        <span>{current.label}</span>
        <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 w-40 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] shadow-xl overflow-hidden z-20">
            {LANGUAGES.map(lang => (
              <button
                key={lang.code}
                onClick={() => { i18n.changeLanguage(lang.code as LangCode); setOpen(false) }}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors text-left',
                  i18n.language === lang.code
                    ? 'bg-[var(--color-brand)]/15 text-[var(--color-brand)] font-semibold'
                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)]',
                )}
              >
                <span className="text-base">{lang.flag}</span>
                {lang.label}
                {i18n.language === lang.code && <span className="ml-auto text-[10px]">✓</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
