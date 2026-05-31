import { create } from 'zustand'
import { supabase } from '@/lib/supabase'

export interface Notice {
  id: string
  title: string
  content: string
  authorId: string | null
  authorName: string
  pinned: boolean
  mediaUrls: string[]
  createdAt: string
  updatedAt: string
}

interface NoticeStore {
  notices: Notice[]
  loading: boolean
  initialized: boolean
  loadNotices: (force?: boolean) => Promise<void>
  addNotice: (title: string, content: string, authorId: string, authorName: string, mediaUrls?: string[]) => Promise<void>
  updateNotice: (id: string, title: string, content: string, mediaUrls?: string[]) => Promise<void>
  deleteNotice: (id: string) => Promise<void>
  togglePin: (id: string) => Promise<void>
}

const toNotice = (r: Record<string, unknown>): Notice => ({
  id: r.id as string,
  title: r.title as string,
  content: r.content as string,
  authorId: r.author_id as string | null,
  authorName: r.author_name as string,
  pinned: r.pinned as boolean,
  mediaUrls: (r.media_urls as string[] | null) ?? [],
  createdAt: r.created_at as string,
  updatedAt: r.updated_at as string,
})

export const useNoticeStore = create<NoticeStore>((set, get) => ({
  notices: [],
  loading: false,
  initialized: false,

  loadNotices: async (force = false) => {
    if (!force && get().initialized) return
    set({ loading: true })
    try {
      const { data, error } = await supabase
        .from('notices')
        .select('*')
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) console.error('[noticeStore] loadNotices error:', error)
      set({ notices: (data ?? []).map(toNotice), initialized: true })
    } finally {
      set({ loading: false })
    }
  },

  addNotice: async (title, content, authorId, authorName, mediaUrls = []) => {
    const { data, error } = await supabase
      .from('notices')
      .insert({ title, content, author_id: authorId, author_name: authorName, media_urls: mediaUrls })
      .select()
      .single()
    if (error || !data) return
    set((s) => ({ notices: [toNotice(data), ...s.notices] }))
  },

  updateNotice: async (id, title, content, mediaUrls) => {
    const payload: Record<string, unknown> = {
      title, content, updated_at: new Date().toISOString(),
    }
    if (mediaUrls !== undefined) payload.media_urls = mediaUrls
    const { data, error } = await supabase
      .from('notices')
      .update(payload)
      .eq('id', id)
      .select()
      .single()
    if (error || !data) return
    set((s) => ({ notices: s.notices.map((n) => (n.id === id ? toNotice(data) : n)) }))
  },

  deleteNotice: async (id) => {
    await supabase.from('notices').delete().eq('id', id)
    set((s) => ({ notices: s.notices.filter((n) => n.id !== id) }))
  },

  togglePin: async (id) => {
    const notice = get().notices.find((n) => n.id === id)
    if (!notice) return
    const pinned = !notice.pinned
    await supabase.from('notices').update({ pinned }).eq('id', id)
    const updated = get()
      .notices.map((n) => (n.id === id ? { ...n, pinned } : n))
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })
    set({ notices: updated })
  },
}))
