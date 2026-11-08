import { create } from 'zustand'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { OccupationTurn, OccupationTurnDraft, Facility } from '@/domain/entities/Occupation'
import i18n from '@/i18n'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toTurn = (r: any): OccupationTurn => ({
  id: r.id,
  facility: r.facility,
  allianceName: r.alliance_name,
  sortOrder: r.sort_order ?? 0,
  isCurrent: r.is_current ?? false,
  note: r.note ?? '',
  weekDate: r.week_date ?? null,
  createdAt: r.created_at,
})

interface OccupationStore {
  turns: OccupationTurn[]
  loading: boolean
  initialized: boolean
  loadAll: (force?: boolean) => Promise<void>
  add: (draft: OccupationTurnDraft) => Promise<boolean>
  update: (id: string, draft: Partial<OccupationTurnDraft>) => Promise<void>
  remove: (id: string) => Promise<void>
  /** 여러 항목 일괄 삭제 (주차 삭제) */
  removeMany: (ids: string[]) => Promise<boolean>
  /** 여러 항목의 주차 날짜 일괄 지정 */
  setWeekDate: (ids: string[], date: string | null) => Promise<void>
  /** 해당 시설에서 이 항목만 현재 차례로 지정 (나머지는 해제) */
  setCurrent: (facility: Facility, id: string) => Promise<void>
  /** 순서 이동 (위/아래) — 인접 항목과 sort_order 교환 */
  move: (id: string, dir: 'up' | 'down') => Promise<void>
}

export const useOccupationStore = create<OccupationStore>((set, get) => ({
  turns: [],
  loading: false,
  initialized: false,

  loadAll: async (force = false) => {
    if (!force && get().initialized) return
    set({ loading: true })
    try {
      const { data, error } = await supabase
        .from('occupation_turns')
        .select('*')
        .order('facility', { ascending: true })
        .order('sort_order', { ascending: true })
      if (error) throw error
      set({ turns: (data ?? []).map(toTurn), initialized: true })
    } catch (err) {
      console.error('[occupationStore] loadAll error', err)
    } finally {
      set({ loading: false })
    }
  },

  add: async (draft) => {
    const name = draft.allianceName.trim()
    if (!name) {
      toast.error(i18n.t('notify.alliance_name_required'))
      return false
    }
    const { data, error } = await supabase
      .from('occupation_turns')
      .insert({
        facility: draft.facility,
        alliance_name: name,
        sort_order: draft.sortOrder,
        is_current: draft.isCurrent,
        note: draft.note.trim(),
        // 마이그레이션 전에도 단건 추가가 깨지지 않도록 값이 있을 때만 보낸다
        ...(draft.weekDate ? { week_date: draft.weekDate } : {}),
      })
      .select()
      .single()
    if (error || !data) {
      toast.error(i18n.t('notify.add_error'))
      return false
    }
    set((s) => ({ turns: [...s.turns, toTurn(data)] }))
    return true
  },

  update: async (id, draft) => {
    const payload: Record<string, unknown> = {}
    if (draft.allianceName !== undefined) payload.alliance_name = draft.allianceName.trim()
    if (draft.sortOrder !== undefined) payload.sort_order = draft.sortOrder
    if (draft.isCurrent !== undefined) payload.is_current = draft.isCurrent
    if (draft.note !== undefined) payload.note = draft.note.trim()
    const { error } = await supabase.from('occupation_turns').update(payload).eq('id', id)
    if (error) {
      toast.error(i18n.t('notify.update_error'))
      return
    }
    set((s) => ({
      turns: s.turns.map((tn) => (tn.id === id ? { ...tn, ...draft, allianceName: draft.allianceName?.trim() ?? tn.allianceName, note: draft.note?.trim() ?? tn.note } : tn)),
    }))
  },

  remove: async (id) => {
    const { error } = await supabase.from('occupation_turns').delete().eq('id', id)
    if (error) {
      toast.error(i18n.t('notify.delete_error'))
      return
    }
    set((s) => ({ turns: s.turns.filter((tn) => tn.id !== id) }))
  },

  removeMany: async (ids) => {
    if (ids.length === 0) return true
    const { error } = await supabase.from('occupation_turns').delete().in('id', ids)
    if (error) {
      console.error('[occupationStore] removeMany error', error)
      toast.error(i18n.t('notify.delete_error'))
      return false
    }
    set((s) => ({ turns: s.turns.filter((tn) => !ids.includes(tn.id)) }))
    return true
  },

  setWeekDate: async (ids, date) => {
    if (ids.length === 0) return
    const { error } = await supabase.from('occupation_turns').update({ week_date: date }).in('id', ids)
    if (error) {
      console.error('[occupationStore] setWeekDate error', error)
      toast.error(i18n.t('notify.update_error'))
      return
    }
    set((s) => ({
      turns: s.turns.map((tn) => (ids.includes(tn.id) ? { ...tn, weekDate: date } : tn)),
    }))
  },

  setCurrent: async (facility, id) => {
    // 같은 시설의 다른 항목 current 해제 + 이 항목만 true
    const targets = get().turns.filter((tn) => tn.facility === facility)
    try {
      await Promise.all(
        targets.map((tn) =>
          supabase.from('occupation_turns').update({ is_current: tn.id === id }).eq('id', tn.id),
        ),
      )
      set((s) => ({
        turns: s.turns.map((tn) =>
          tn.facility === facility ? { ...tn, isCurrent: tn.id === id } : tn,
        ),
      }))
    } catch (err) {
      console.error('[occupationStore] setCurrent error', err)
      toast.error(i18n.t('notify.current_turn_error'))
    }
  },

  move: async (id, dir) => {
    const turn = get().turns.find((tn) => tn.id === id)
    if (!turn) return
    const sameFacility = get().turns
      .filter((tn) => tn.facility === turn.facility)
      .sort((a, b) => a.sortOrder - b.sortOrder)
    const idx = sameFacility.findIndex((tn) => tn.id === id)
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= sameFacility.length) return
    const other = sameFacility[swapIdx]
    // sort_order 교환
    try {
      await Promise.all([
        supabase.from('occupation_turns').update({ sort_order: other.sortOrder }).eq('id', turn.id),
        supabase.from('occupation_turns').update({ sort_order: turn.sortOrder }).eq('id', other.id),
      ])
      set((s) => ({
        turns: s.turns.map((tn) =>
          tn.id === turn.id ? { ...tn, sortOrder: other.sortOrder }
            : tn.id === other.id ? { ...tn, sortOrder: turn.sortOrder }
              : tn,
        ),
      }))
    } catch (err) {
      console.error('[occupationStore] move error', err)
      toast.error(i18n.t('notify.reorder_error'))
    }
  },
}))
