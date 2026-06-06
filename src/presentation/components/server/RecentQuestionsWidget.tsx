import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { MessageCircleQuestion, ChevronRight, CheckCircle2, Clock } from 'lucide-react'
import { useGuestQuestionStore } from '@/infrastructure/stores/guestQuestionStore'
import { cn } from '@/lib/utils'

/** 궁금한 점 최근/미답변 글 미리보기 (guest_questions 는 공개 SELECT) */
export const RecentQuestionsWidget = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { questions, loadAll } = useGuestQuestionStore()

  useEffect(() => { loadAll() }, [loadAll])

  const recent = [...questions]
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 4)
  if (recent.length === 0) return null

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-bold text-[var(--color-text-primary)] flex items-center gap-1.5">
          <MessageCircleQuestion className="w-4 h-4 text-[var(--color-brand)]" /> {t('server_home.recent_questions')}
        </h2>
        <button
          onClick={() => navigate('/questions')}
          className="flex items-center gap-0.5 text-xs text-[var(--color-brand)] hover:underline"
        >
          {t('server_home.view_all')} <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-xl divide-y divide-[var(--color-border-subtle)] overflow-hidden">
        {recent.map((q) => {
          const answered = q.answers.length > 0
          return (
            <button
              key={q.id}
              onClick={() => navigate('/questions')}
              className="w-full text-left flex items-center gap-2.5 px-4 py-3 hover:bg-[var(--color-bg-elevated)] transition-colors"
            >
              <span
                className={cn(
                  'text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 flex-shrink-0',
                  answered ? 'bg-green-500/15 text-green-400' : 'bg-amber-500/15 text-amber-400',
                )}
              >
                {answered ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                {answered ? t('server_home.answered') : t('server_home.unanswered')}
              </span>
              <span className="flex-1 min-w-0 text-sm text-[var(--color-text-primary)] truncate">{q.title}</span>
              <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)] flex-shrink-0" />
            </button>
          )
        })}
      </div>
    </div>
  )
}
