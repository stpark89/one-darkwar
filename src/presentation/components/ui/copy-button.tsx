import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { copyText } from '@/lib/clipboard'
import { cn } from '@/lib/utils'

interface CopyButtonProps {
  value: string
  className?: string
}

/** 값 복사 버튼 — 클릭 시 복사 + 잠깐 체크 아이콘 표시 (모바일 호환) */
export const CopyButton = ({ value, className }: CopyButtonProps) => {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  if (!value) return null

  const handle = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const ok = await copyText(value)
    if (ok) {
      setCopied(true)
      toast.success(t('common.copied'))
      setTimeout(() => setCopied(false), 1500)
    } else {
      toast.error(t('common.copy_failed'))
    }
  }

  return (
    <button
      type="button"
      onClick={handle}
      title={t('common.copy')}
      aria-label={t('common.copy')}
      className={cn(
        'inline-flex items-center justify-center p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-brand)] hover:bg-[var(--color-bg-elevated)] transition-colors flex-shrink-0',
        className,
      )}
    >
      {copied ? <Check className="w-3.5 h-3.5 text-[var(--color-success)]" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  )
}
