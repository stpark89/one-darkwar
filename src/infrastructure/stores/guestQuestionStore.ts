import { create } from 'zustand'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { GuestQuestion, GuestAnswer, GuestQuestionDraft } from '@/domain/entities/GuestQuestion'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toAnswer = (r: any): GuestAnswer => ({
  id: r.id,
  questionId: r.question_id,
  authorId: r.author_id,
  authorName: r.author_name,
  isAdmin: !!r.is_admin,
  content: r.content,
  createdAt: r.created_at,
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toQuestion = (r: any, answers: GuestAnswer[]): GuestQuestion => ({
  id: r.id,
  authorName: r.author_name,
  title: r.title,
  content: r.content ?? '',
  createdAt: r.created_at,
  answers,
})

interface GuestQuestionStore {
  questions: GuestQuestion[]
  loading: boolean
  loadAll: () => Promise<void>
  submit: (draft: GuestQuestionDraft) => Promise<boolean>
  addAnswer: (questionId: string, content: string, authorName: string, opts?: { authorId?: string; isAdmin?: boolean }) => Promise<boolean>
  deleteQuestion: (id: string) => Promise<void>
  deleteAnswer: (answerId: string, questionId: string) => Promise<void>
}

export const useGuestQuestionStore = create<GuestQuestionStore>((set) => ({
  questions: [],
  loading: false,

  loadAll: async () => {
    set({ loading: true })
    try {
      const [{ data: qs }, { data: as }] = await Promise.all([
        supabase.from('guest_questions').select('*').order('created_at', { ascending: false }),
        supabase.from('guest_answers').select('*').order('created_at', { ascending: true }),
      ])
      const answers = (as ?? []).map(toAnswer)
      const byQ = new Map<string, GuestAnswer[]>()
      for (const a of answers) {
        const arr = byQ.get(a.questionId) ?? []
        arr.push(a)
        byQ.set(a.questionId, arr)
      }
      const questions = (qs ?? []).map((r) => toQuestion(r, byQ.get(r.id) ?? []))
      set({ questions })
    } catch (err) {
      console.error('guest questions load error', err)
    } finally {
      set({ loading: false })
    }
  },

  submit: async (draft) => {
    const authorName = draft.authorName.trim()
    const title = draft.title.trim()
    if (!authorName || !title) {
      toast.error('이름과 제목을 입력해주세요.')
      return false
    }
    const { data, error } = await supabase
      .from('guest_questions')
      .insert({
        author_name: authorName,
        title,
        content: draft.content.trim(),
      })
      .select()
      .single()
    if (error || !data) {
      console.error('guest question submit error', error)
      toast.error('질문 등록 중 오류가 발생했습니다.')
      return false
    }
    set((s) => ({ questions: [toQuestion(data, []), ...s.questions] }))
    return true
  },

  addAnswer: async (questionId, content, authorName, opts) => {
    const trimmed = content.trim()
    const name = authorName.trim()
    if (!trimmed || !name) {
      toast.error('이름과 내용을 입력해주세요.')
      return false
    }
    const { data, error } = await supabase
      .from('guest_answers')
      .insert({
        question_id: questionId,
        author_id: opts?.authorId ?? null,
        author_name: name,
        is_admin: !!opts?.isAdmin,
        content: trimmed,
      })
      .select()
      .single()
    if (error || !data) {
      console.error('guest answer error', error)
      toast.error('답변 등록 중 오류가 발생했습니다.')
      return false
    }
    const answer = toAnswer(data)
    set((s) => ({
      questions: s.questions.map((q) =>
        q.id === questionId ? { ...q, answers: [...q.answers, answer] } : q,
      ),
    }))
    return true
  },

  deleteQuestion: async (id) => {
    const { error } = await supabase.from('guest_questions').delete().eq('id', id)
    if (error) {
      toast.error('질문 삭제 중 오류가 발생했습니다.')
      return
    }
    set((s) => ({ questions: s.questions.filter((q) => q.id !== id) }))
  },

  deleteAnswer: async (answerId, questionId) => {
    const { error } = await supabase.from('guest_answers').delete().eq('id', answerId)
    if (error) {
      toast.error('답변 삭제 중 오류가 발생했습니다.')
      return
    }
    set((s) => ({
      questions: s.questions.map((q) =>
        q.id === questionId ? { ...q, answers: q.answers.filter((a) => a.id !== answerId) } : q,
      ),
    }))
  },
}))
