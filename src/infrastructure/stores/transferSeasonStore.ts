import { create } from 'zustand'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { TransferSeason } from '@/domain/entities/TransferSeason'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toSeason = (r: any): TransferSeason => ({
  id: r.id,
  name: r.name,
  isActive: r.is_active ?? false,
  openedAt: r.opened_at,
  closedAt: r.closed_at ?? null,
  sortOrder: r.sort_order ?? 0,
  createdAt: r.created_at,
})

interface TransferSeasonStore {
  seasons: TransferSeason[]
  activeSeasonId: string | null
  /** 관리자가 과거 시즌을 열람할 때만 활성 시즌과 달라진다. 게스트는 늘 활성 시즌이다 */
  selectedSeasonId: string | null
  loading: boolean
  initialized: boolean
  load: (force?: boolean) => Promise<void>
  /**
   * 이주 데이터를 조회하기 직전에 부른다. 아직 시즌을 안 실었으면 실어서
   * 현재 봐야 할 시즌 id 를 돌려준다. null 이면 활성 시즌이 없는 것이다.
   */
  ensureSeasonId: () => Promise<string | null>
  selectSeason: (id: string | null) => void
}

export const useTransferSeasonStore = create<TransferSeasonStore>((set, get) => ({
  seasons: [],
  activeSeasonId: null,
  selectedSeasonId: null,
  loading: false,
  initialized: false,

  load: async (force = false) => {
    if (!force && get().initialized) return
    set({ loading: true })
    try {
      const { data, error } = await supabase
        .from('transfer_seasons')
        .select('*')
        .order('sort_order', { ascending: false })
      if (error) throw error
      const seasons = (data ?? []).map(toSeason)
      const activeId = seasons.find((s) => s.isActive)?.id ?? null
      set((prev) => ({
        seasons,
        activeSeasonId: activeId,
        // 관리자가 고른 시즌이 있으면 유지하고, 없으면 활성 시즌을 본다
        selectedSeasonId: prev.selectedSeasonId ?? activeId,
        initialized: true,
      }))
    } catch (err) {
      console.error('transfer season load error', err)
    } finally {
      set({ loading: false })
    }
  },

  ensureSeasonId: async () => {
    if (!get().initialized) await get().load()
    return get().selectedSeasonId ?? get().activeSeasonId
  },

  selectSeason: (id) => set({ selectedSeasonId: id }),
}))

/** 관리자 전용 — 새 시즌을 열고 이전 시즌을 닫는다. 활성 시즌은 항상 하나다. */
export const openNewTransferSeason = async (name: string): Promise<boolean> => {
  const trimmed = name.trim()
  if (!trimmed) {
    toast.error('시즌 이름을 입력해주세요.')
    return false
  }
  const { seasons } = useTransferSeasonStore.getState()
  const nextOrder = seasons.reduce((max, s) => Math.max(max, s.sortOrder), 0) + 1

  // 활성 시즌이 둘이 되면 DB unique index 가 막으므로 먼저 닫는다
  const { error: closeError } = await supabase
    .from('transfer_seasons')
    .update({ is_active: false, closed_at: new Date().toISOString() })
    .eq('is_active', true)
  if (closeError) {
    console.error('season close error', closeError)
    toast.error('이전 시즌을 닫는 중 오류가 발생했습니다.')
    return false
  }

  const { error } = await supabase
    .from('transfer_seasons')
    .insert({ name: trimmed, is_active: true, sort_order: nextOrder })
  if (error) {
    console.error('season open error', error)
    toast.error('새 시즌 생성 중 오류가 발생했습니다.')
    return false
  }
  // 새 시즌을 바로 보도록 선택도 옮긴다
  useTransferSeasonStore.setState({ selectedSeasonId: null })
  await useTransferSeasonStore.getState().load(true)
  useTransferSeasonStore.setState((s) => ({ selectedSeasonId: s.activeSeasonId }))
  return true
}
