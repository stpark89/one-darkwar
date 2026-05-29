import { create } from 'zustand'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { VsPointEntry } from '@/domain/entities/War'

// VS POINT 전용 회차. BLACK GOLD 의 war_rounds 와는 완전히 별개.
// BG 는 격주, VS 는 매주처럼 주기가 다르므로 회차를 분리해서 관리.
export interface VsRound {
  id: string
  seasonId: string
  sortOrder: number
  date: string
}

interface Season {
  id: string
  name: string
  isActive: boolean
}

interface MemberLite {
  id: string
  inGameName: string
}

interface VsPointStore {
  activeSeason: Season | null
  rounds: VsRound[]
  vsPoints: VsPointEntry[]
  members: MemberLite[]
  loading: boolean
  initialized: boolean

  loadData: (force?: boolean) => Promise<void>
  addRound: (date: string) => Promise<void>
  deleteRound: (roundId: string) => Promise<void>
  updateRoundDate: (roundId: string, date: string) => Promise<void>
  batchSaveVs: (changes: { roundId: string; memberId: string; points: string }[]) => Promise<boolean>
  deleteVsPointsForRound: (roundId: string) => Promise<void>
  syncMemberName: (memberId: string, newName: string) => void
  syncDeleteMember: (memberId: string) => void
}

function sortRoundsByDate(rounds: VsRound[]): VsRound[] {
  return [...rounds]
    .sort((a, b) => {
      if (a.date < b.date) return -1
      if (a.date > b.date) return 1
      return 0
    })
    .map((r, idx) => ({ ...r, sortOrder: idx + 1 }))
}

export const useVsPointStore = create<VsPointStore>((set, get) => ({
  activeSeason: null,
  rounds: [],
  vsPoints: [],
  members: [],
  loading: false,
  initialized: false,

  loadData: async (force = false) => {
    if (!force && get().initialized) return
    set({ loading: true })
    try {
      const [{ data: seasonRows }, { data: memberRows }] = await Promise.all([
        supabase.from('seasons').select('*').order('created_at'),
        supabase.from('members').select('id, in_game_name').order('created_at'),
      ])

      const seasons: Season[] = (seasonRows ?? []).map((r) => ({
        id: r.id, name: r.name, isActive: r.is_active,
      }))
      const activeSeason = seasons.find((s) => s.isActive) ?? seasons[seasons.length - 1] ?? null
      const members = (memberRows ?? []).map((r) => ({ id: r.id, inGameName: r.in_game_name }))

      if (!activeSeason) {
        set({ activeSeason: null, rounds: [], vsPoints: [], members, initialized: true })
        return
      }

      const { data: roundRows } = await supabase
        .from('vs_rounds').select('*').eq('season_id', activeSeason.id)
      const rawRounds: VsRound[] = (roundRows ?? []).map((r) => ({
        id: r.id, seasonId: r.season_id, sortOrder: 0, date: r.round_date ?? '',
      }))
      const rounds = sortRoundsByDate(rawRounds)

      let vsPoints: VsPointEntry[] = []
      const roundIds = rounds.map((r) => r.id)
      if (roundIds.length > 0) {
        const { data: vsRows } = await supabase
          .from('war_vs_points').select('*').in('round_id', roundIds)
        vsPoints = (vsRows ?? []).map((r) => ({
          roundId: r.round_id,
          memberId: r.member_id,
          points: r.points != null ? String(r.points) : '',
        }))
      }

      set({ activeSeason, rounds, vsPoints, members, initialized: true })
    } catch (err) {
      console.error('[vsPointStore] loadData exception:', err)
    } finally {
      set({ loading: false })
    }
  },

  addRound: async (date) => {
    const { activeSeason, rounds } = get()
    if (!activeSeason) return
    const { data } = await supabase
      .from('vs_rounds')
      .insert({ season_id: activeSeason.id, sort_order: rounds.length + 1, round_date: date || null })
      .select().single()
    if (!data) return
    const newRound: VsRound = { id: data.id, seasonId: data.season_id, sortOrder: 0, date: data.round_date ?? '' }
    const sorted = sortRoundsByDate([...rounds, newRound])
    set({ rounds: sorted })
  },

  deleteRound: async (roundId) => {
    await supabase.from('vs_rounds').delete().eq('id', roundId)
    set((s) => ({
      rounds: s.rounds.filter((r) => r.id !== roundId).map((r, idx) => ({ ...r, sortOrder: idx + 1 })),
      vsPoints: s.vsPoints.filter((v) => v.roundId !== roundId),
    }))
  },

  updateRoundDate: async (roundId, date) => {
    await supabase.from('vs_rounds').update({ round_date: date }).eq('id', roundId)
    set((s) => {
      const updated = s.rounds.map((r) => (r.id === roundId ? { ...r, date } : r))
      return { rounds: sortRoundsByDate(updated) }
    })
  },

  batchSaveVs: async (changes) => {
    try {
      const toUpsert = changes.filter((c) => c.points.trim() !== '')
      const toDelete = changes.filter((c) => c.points.trim() === '')

      if (toUpsert.length > 0) {
        const { error } = await supabase.from('war_vs_points').upsert(
          toUpsert.map((c) => ({
            round_id: c.roundId,
            member_id: c.memberId,
            points: c.points,
          })),
          { onConflict: 'round_id,member_id' },
        )
        if (error) throw error
      }

      for (const c of toDelete) {
        await supabase.from('war_vs_points')
          .delete()
          .eq('round_id', c.roundId)
          .eq('member_id', c.memberId)
      }

      set((s) => {
        let vsPoints = [...s.vsPoints]
        for (const c of changes) {
          vsPoints = vsPoints.filter((v) => !(v.roundId === c.roundId && v.memberId === c.memberId))
          if (c.points.trim() !== '') {
            vsPoints.push({ roundId: c.roundId, memberId: c.memberId, points: c.points })
          }
        }
        return { vsPoints }
      })

      return true
    } catch (err) {
      console.error('[vsPointStore] batchSaveVs error', err)
      toast.error('VS 포인트 저장 중 오류가 발생했습니다.')
      return false
    }
  },

  syncMemberName: (memberId, newName) =>
    set((s) => ({
      members: s.members.map((m) => m.id === memberId ? { ...m, inGameName: newName } : m),
    })),

  syncDeleteMember: (memberId) =>
    set((s) => ({
      members: s.members.filter((m) => m.id !== memberId),
      vsPoints: s.vsPoints.filter((v) => v.memberId !== memberId),
    })),

  // 회차는 유지하고 해당 회차의 VS 포인트 데이터만 삭제 (잘못 입력한 경우 리셋)
  deleteVsPointsForRound: async (roundId) => {
    await supabase.from('war_vs_points').delete().eq('round_id', roundId)
    set((s) => ({
      vsPoints: s.vsPoints.filter((v) => v.roundId !== roundId),
    }))
  },
}))
