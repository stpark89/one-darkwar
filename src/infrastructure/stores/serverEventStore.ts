import { create } from 'zustand'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { ServerEvent, ServerEventDraft } from '@/domain/entities/ServerEvent'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toEvent = (r: any): ServerEvent => ({
  id: r.id,
  title: r.title,
  eventAt: r.event_at,
  category: r.category ?? 'event',
  note: r.note ?? '',
  createdAt: r.created_at,
})

interface ServerEventStore {
  events: ServerEvent[]
  loading: boolean
  initialized: boolean
  loadAll: (force?: boolean) => Promise<void>
  add: (draft: ServerEventDraft) => Promise<boolean>
  update: (id: string, draft: Partial<ServerEventDraft>) => Promise<void>
  remove: (id: string) => Promise<void>
}

export const useServerEventStore = create<ServerEventStore>((set, get) => ({
  events: [],
  loading: false,
  initialized: false,

  loadAll: async (force = false) => {
    if (!force && get().initialized) return
    set({ loading: true })
    try {
      const { data, error } = await supabase
        .from('server_events')
        .select('*')
        .order('event_at', { ascending: true })
      if (error) throw error
      set({ events: (data ?? []).map(toEvent), initialized: true })
    } catch (err) {
      console.error('[serverEventStore] loadAll error', err)
    } finally {
      set({ loading: false })
    }
  },

  add: async (draft) => {
    const title = draft.title.trim()
    if (!title) {
      toast.error('일정 제목을 입력해주세요.')
      return false
    }
    const { data, error } = await supabase
      .from('server_events')
      .insert({
        title,
        event_at: draft.eventAt,
        category: draft.category,
        note: draft.note.trim(),
      })
      .select()
      .single()
    if (error || !data) {
      toast.error('일정 추가 중 오류가 발생했습니다.')
      return false
    }
    set((s) => ({
      events: [...s.events, toEvent(data)].sort((a, b) => a.eventAt.localeCompare(b.eventAt)),
    }))
    return true
  },

  update: async (id, draft) => {
    const payload: Record<string, unknown> = {}
    if (draft.title !== undefined) payload.title = draft.title.trim()
    if (draft.eventAt !== undefined) payload.event_at = draft.eventAt
    if (draft.category !== undefined) payload.category = draft.category
    if (draft.note !== undefined) payload.note = draft.note.trim()
    const { error } = await supabase.from('server_events').update(payload).eq('id', id)
    if (error) {
      toast.error('일정 수정 중 오류가 발생했습니다.')
      return
    }
    set((s) => ({
      events: s.events
        .map((e) =>
          e.id === id
            ? {
                ...e,
                title: draft.title?.trim() ?? e.title,
                eventAt: draft.eventAt ?? e.eventAt,
                category: draft.category ?? e.category,
                note: draft.note?.trim() ?? e.note,
              }
            : e,
        )
        .sort((a, b) => a.eventAt.localeCompare(b.eventAt)),
    }))
  },

  remove: async (id) => {
    const { error } = await supabase.from('server_events').delete().eq('id', id)
    if (error) {
      toast.error('일정 삭제 중 오류가 발생했습니다.')
      return
    }
    set((s) => ({ events: s.events.filter((e) => e.id !== id) }))
  },
}))
