import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { toIso, parseIso, formatIsoDate } from '@/lib/date'

/**
 * 앱 언어(i18next)를 따르는 날짜 선택기.
 *
 * ⛔ `<input type="date">` 를 쓰지 않는 이유: 네이티브 입력의 자리표시자(「연도. 월. 일.」)와
 *    달력 팝업은 **브라우저·OS 언어**로 그려져 i18next 가 바꿀 수 없다.
 *    월·요일 이름은 `Intl` + `i18n.language` 로, 버튼 문구는 `t()` 로 만든다.
 *
 * 값은 `YYYY-MM-DD` 문자열(빈 문자열 = 미지정) — DB `date` 컬럼과 그대로 맞는다.
 */

interface DatePickerProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  withYear?: boolean
  ariaLabel?: string
  className?: string
  disabled?: boolean
}

const POPUP_W = 264

export const DatePicker = ({
  value, onChange, placeholder, withYear = false, ariaLabel, className, disabled,
}: DatePickerProps) => {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const [view, setView] = useState(() => (value ? parseIso(value) : new Date()))

  const openPicker = () => {
    if (disabled) return
    setView(value ? parseIso(value) : new Date())
    setOpen(true)
  }

  // 표 안(overflow 컨테이너)에서도 잘리지 않도록 body 에 띄우고 위치를 계산
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return
    const r = triggerRef.current.getBoundingClientRect()
    const popupH = popupRef.current?.offsetHeight ?? 320
    const left = Math.min(Math.max(8, r.left), window.innerWidth - POPUP_W - 8)
    const below = r.bottom + 4
    const top = below + popupH > window.innerHeight - 8 ? Math.max(8, r.top - popupH - 4) : below
    setPos({ top, left })
  }, [open, view])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (popupRef.current?.contains(target) || triggerRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    const onScroll = (e: Event) => {
      if (popupRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [open])

  const monthLabel = view.toLocaleDateString(lang, { year: 'numeric', month: 'long' })

  // 일요일 시작 요일 머리글 — 2023-01-01 이 일요일
  const weekdays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => new Date(2023, 0, 1 + i).toLocaleDateString(lang, { weekday: 'narrow' })),
    [lang],
  )

  const cells = useMemo(() => {
    const first = new Date(view.getFullYear(), view.getMonth(), 1)
    const start = new Date(first)
    start.setDate(1 - first.getDay())
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      return d
    })
  }, [view])

  const todayIso = toIso(new Date())
  const pick = (iso: string) => { onChange(iso); setOpen(false) }
  const shiftMonth = (n: number) => setView(new Date(view.getFullYear(), view.getMonth() + n, 1))

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openPicker())}
        disabled={disabled}
        aria-label={ariaLabel}
        className={cn(
          'whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50',
          !value && 'text-[var(--color-text-muted)]',
          className,
        )}
      >
        {value ? formatIsoDate(value, lang, withYear) : (placeholder ?? t('common.pick_date'))}
      </button>

      {open && createPortal(
        <div
          ref={popupRef}
          role="dialog"
          aria-label={ariaLabel}
          className="fixed z-[60] rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-3 shadow-xl text-[var(--color-text-primary)]"
          style={{ top: pos.top, left: pos.left, width: POPUP_W }}
        >
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={() => shiftMonth(-1)} aria-label={t('common.prev_month')}
              className="p-1 rounded hover:bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)]">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-bold">{monthLabel}</span>
            <button type="button" onClick={() => shiftMonth(1)} aria-label={t('common.next_month')}
              className="p-1 rounded hover:bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)]">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5 text-center">
            {weekdays.map((w, i) => (
              <span key={i} className="text-[10px] font-semibold text-[var(--color-text-muted)] py-1">{w}</span>
            ))}
            {cells.map((d) => {
              const iso = toIso(d)
              const inMonth = d.getMonth() === view.getMonth()
              const selected = iso === value
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => pick(iso)}
                  className={cn(
                    'h-8 rounded text-xs transition-colors',
                    selected
                      ? 'bg-[var(--color-brand)] text-white font-bold'
                      : iso === todayIso
                        ? 'ring-1 ring-[var(--color-brand)] text-[var(--color-brand)] font-bold hover:bg-[var(--color-brand)]/10'
                        : inMonth
                          ? 'hover:bg-[var(--color-brand)]/10'
                          : 'text-[var(--color-text-muted)] hover:bg-[var(--color-brand)]/10',
                  )}
                >
                  {d.getDate()}
                </button>
              )
            })}
          </div>

          <div className="flex items-center justify-between mt-2 pt-2 border-t border-[var(--color-border-subtle)]">
            <button type="button" onClick={() => pick('')}
              className="text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-danger)] px-1 py-1">
              {t('common.clear')}
            </button>
            <button type="button" onClick={() => pick(todayIso)}
              className="text-xs font-semibold text-[var(--color-brand)] hover:underline px-1 py-1">
              {t('common.today')}
            </button>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}

const pad2 = (n: number) => String(n).padStart(2, '0')
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5)

interface DateTimePickerProps {
  /** `YYYY-MM-DDTHH:mm` (로컬) — 기존 datetime-local 값과 같은 형식 */
  value: string
  onChange: (value: string) => void
  ariaLabel?: string
}

/**
 * 날짜 + 시·분. ⛔ `type="datetime-local"`·`type="time"` 도 OS 언어(오전/오후·자리표시자)로 그려져서
 * 시·분은 숫자만 보이는 select 로 받는다. 분은 5분 단위 + 기존 값이 5분 단위가 아니면 그 값도 보존한다.
 */
export const DateTimePicker = ({ value, onChange, ariaLabel }: DateTimePickerProps) => {
  const [date = '', time = '00:00'] = value.split('T')
  const [hh, mm] = time.split(':').map(Number)
  const minutes = MINUTES.includes(mm) ? MINUTES : [...MINUTES, mm].sort((a, b) => a - b)
  const emit = (d: string, h: number, m: number) => onChange(d ? `${d}T${pad2(h)}:${pad2(m)}` : '')
  const selectCls =
    'h-9 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-2 text-sm text-[var(--color-text-primary)] tabular-nums focus:outline-none focus:ring-1 focus:ring-[var(--color-brand)] disabled:opacity-50'

  return (
    <div className="flex items-center gap-1.5">
      <DatePicker
        value={date}
        onChange={(d) => emit(d, hh, mm)}
        withYear
        ariaLabel={ariaLabel}
        className="flex h-9 flex-1 min-w-0 items-center rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 text-sm text-left text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand)]"
      />
      <select value={hh} disabled={!date} onChange={(e) => emit(date, Number(e.target.value), mm)} className={selectCls}>
        {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{pad2(h)}</option>)}
      </select>
      <span className="text-[var(--color-text-muted)]">:</span>
      <select value={mm} disabled={!date} onChange={(e) => emit(date, hh, Number(e.target.value))} className={selectCls}>
        {minutes.map((m) => <option key={m} value={m}>{pad2(m)}</option>)}
      </select>
    </div>
  )
}
