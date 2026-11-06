import { create } from 'zustand'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { Alliance, AllianceDraft } from '@/domain/entities/Alliance'
import i18n from '@/i18n'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toAlliance = (r: any): Alliance => ({
  id: r.id,
  name: r.name,
  tag: r.tag ?? '',
  recruiting: r.recruiting ?? false,
  contact: r.contact ?? '',
  note: r.note ?? '',
  isHome: r.is_home ?? false,
  sortOrder: r.sort_order ?? 0,
  createdAt: r.created_at,
})

const sortFn = (a: Alliance, b: Alliance) =>
  Number(b.isHome) - Number(a.isHome) ||
  a.sortOrder - b.sortOrder ||
  a.name.localeCompare(b.name)

interface AllianceStore {
  alliances: Alliance[]
  loading: boolean
  initialized: boolean
  loadAll: (force?: boolean) => Promise<void>
  add: (draft: AllianceDraft) => Promise<boolean>
  update: (id: string, draft: Partial<AllianceDraft>) => Promise<void>
  remove: (id: string) => Promise<void>
}

export const useAllianceStore = create<AllianceStore>((set, get) => ({
  alliances: [],
  loading: false,
  initialized: false,

  loadAll: async (force = false) => {
    if (!force && get().initialized) return
    set({ loading: true })
    try {
      const { data, error } = await supabase
        .from('alliances')
        .select('*')
        .order('sort_order', { ascending: true })
      if (error) throw error
      set({ alliances: (data ?? []).map(toAlliance).sort(sortFn), initialized: true })
    } catch (err) {
      console.error('[allianceStore] loadAll error', err)
    } finally {
      set({ loading: false })
    }
  },

  add: async (draft) => {
    const name = draft.name.trim()
    if (!name) {
      toast.error(i18n.t('notify.alliance_name_required'))
      return false
    }
    const { data, error } = await supabase
      .from('alliances')
      .insert({
        name,
        tag: draft.tag.trim(),
        recruiting: draft.recruiting,
        contact: draft.contact.trim(),
        note: draft.note.trim(),
        is_home: draft.isHome,
        sort_order: draft.sortOrder,
      })
      .select()
      .single()
    if (error || !data) {
      toast.error(i18n.t('notify.alliance_add_error'))
      return false
    }
    set((s) => ({ alliances: [...s.alliances, toAlliance(data)].sort(sortFn) }))
    return true
  },

  update: async (id, draft) => {
    const payload: Record<string, unknown> = {}
    if (draft.name !== undefined) payload.name = draft.name.trim()
    if (draft.tag !== undefined) payload.tag = draft.tag.trim()
    if (draft.recruiting !== undefined) payload.recruiting = draft.recruiting
    if (draft.contact !== undefined) payload.contact = draft.contact.trim()
    if (draft.note !== undefined) payload.note = draft.note.trim()
    if (draft.isHome !== undefined) payload.is_home = draft.isHome
    if (draft.sortOrder !== undefined) payload.sort_order = draft.sortOrder
    const { error } = await supabase.from('alliances').update(payload).eq('id', id)
    if (error) {
      toast.error(i18n.t('notify.alliance_update_error'))
      return
    }
    set((s) => ({
      alliances: s.alliances
        .map((a) =>
          a.id === id
            ? {
                ...a,
                name: draft.name?.trim() ?? a.name,
                tag: draft.tag?.trim() ?? a.tag,
                recruiting: draft.recruiting ?? a.recruiting,
                contact: draft.contact?.trim() ?? a.contact,
                note: draft.note?.trim() ?? a.note,
                isHome: draft.isHome ?? a.isHome,
                sortOrder: draft.sortOrder ?? a.sortOrder,
              }
            : a,
        )
        .sort(sortFn),
    }))
  },

  remove: async (id) => {
    const { error } = await supabase.from('alliances').delete().eq('id', id)
    if (error) {
      toast.error(i18n.t('notify.alliance_delete_error'))
      return
    }
    set((s) => ({ alliances: s.alliances.filter((a) => a.id !== id) }))
  },
}))
