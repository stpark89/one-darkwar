import { create } from 'zustand'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { TransferTier, TransferTierDraft } from '@/domain/entities/TransferTier'
import { useTransferSeasonStore } from './transferSeasonStore'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toTier = (r: any): TransferTier => ({
  id: r.id,
  name: r.name,
  minCp: r.min_cp ?? 0,
  maxCp: r.max_cp,
  capacity: r.capacity ?? 0,
  sortOrder: r.sort_order ?? 0,
  seasonName: r.season_name ?? '',
  color: (r.color ?? 'gray') as TransferTier['color'],
  createdAt: r.created_at,
})

interface TransferTierStore {
  tiers: TransferTier[]
  loading: boolean
  initialized: boolean
  loadAll: (force?: boolean) => Promise<void>
  upsert: (draft: TransferTierDraft & { id?: string }) => Promise<boolean>
  remove: (id: string) => Promise<void>
}

export const useTransferTierStore = create<TransferTierStore>((set, get) => ({
  tiers: [],
  loading: false,
  initialized: false,

  loadAll: async (force = false) => {
    if (!force && get().initialized) return
    set({ loading: true })
    try {
      // 등급·정원은 시즌마다 다르다 — 현재 시즌 것만 쓴다
      const seasonId = await useTransferSeasonStore.getState().ensureSeasonId()
      const base = supabase
        .from('transfer_tiers')
        .select('*')
        .order('sort_order', { ascending: true })
      const { data, error } = await (seasonId ? base.eq('season_id', seasonId) : base)
      if (error) throw error
      set({ tiers: (data ?? []).map(toTier), initialized: true })
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
      color: draft.color,
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
                color: payload.color,
              } }
            : t,
        ).sort((a, b) => a.sortOrder - b.sortOrder),
      }))
    } else {
      // 보고 있는 시즌에 넣는다. 명시하지 않으면 DB DEFAULT 가 활성 시즌에 넣어,
      // 과거 시즌을 열람하던 관리자가 엉뚱한 시즌에 등급을 만들게 된다.
      const seasonId = await useTransferSeasonStore.getState().ensureSeasonId()
      const { data, error } = await supabase
        .from('transfer_tiers')
        .insert({ ...payload, season_id: seasonId })
        .select()
        .single()
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
