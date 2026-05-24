import { create } from 'zustand'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { TransferTier, TransferTierDraft } from '@/domain/entities/TransferTier'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toTier = (r: any): TransferTier => ({
  id: r.id,
  name: r.name,
  minCp: r.min_cp ?? 0,
  maxCp: r.max_cp,
  capacity: r.capacity ?? 0,
  sortOrder: r.sort_order ?? 0,
  seasonName: r.season_name ?? '',
  createdAt: r.created_at,
})

interface TransferTierStore {
  tiers: TransferTier[]
  loading: boolean
  loadAll: () => Promise<void>
  upsert: (draft: TransferTierDraft & { id?: string }) => Promise<boolean>
  remove: (id: string) => Promise<void>
}

export const useTransferTierStore = create<TransferTierStore>((set) => ({
  tiers: [],
  loading: false,

  loadAll: async () => {
    set({ loading: true })
    try {
      const { data, error } = await supabase
        .from('transfer_tiers')
        .select('*')
        .order('sort_order', { ascending: true })
      if (error) throw error
      set({ tiers: (data ?? []).map(toTier) })
    } catch (err) {
      console.error('tier load error', err)
    } finally {
      set({ loading: false })
    }
  },

  upsert: async (draft) => {
    const payload = {
      name: draft.name.trim(),
      min_cp: draft.minCp,
      max_cp: draft.maxCp,
      capacity: draft.capacity,
      sort_order: draft.sortOrder,
      season_name: draft.seasonName.trim(),
    }
    if (draft.id) {
      const { error } = await supabase.from('transfer_tiers').update(payload).eq('id', draft.id)
      if (error) {
        toast.error('등급 저장 중 오류가 발생했습니다.')
        return false
      }
      set((s) => ({
        tiers: s.tiers.map((t) =>
          t.id === draft.id
            ? { ...t, ...{
                name: payload.name,
                minCp: payload.min_cp,
                maxCp: payload.max_cp,
                capacity: payload.capacity,
                sortOrder: payload.sort_order,
                seasonName: payload.season_name,
              } }
            : t,
        ).sort((a, b) => a.sortOrder - b.sortOrder),
      }))
    } else {
      const { data, error } = await supabase.from('transfer_tiers').insert(payload).select().single()
      if (error || !data) {
        toast.error('등급 추가 중 오류가 발생했습니다.')
        return false
      }
      set((s) => ({ tiers: [...s.tiers, toTier(data)].sort((a, b) => a.sortOrder - b.sortOrder) }))
    }
    return true
  },

  remove: async (id) => {
    const { error } = await supabase.from('transfer_tiers').delete().eq('id', id)
    if (error) {
      toast.error('등급 삭제 중 오류가 발생했습니다.')
      return
    }
    set((s) => ({ tiers: s.tiers.filter((t) => t.id !== id) }))
  },
}))

// 주어진 CP(M단위)에 매칭되는 tier 반환. 매칭 없으면 null.
export function findTierForCp(tiers: TransferTier[], cpMega: number): TransferTier | null {
  for (const t of tiers) {
    const inMin = cpMega >= t.minCp
    const inMax = t.maxCp == null || cpMega < t.maxCp
    if (inMin && inMax) return t
  }
  return null
}
