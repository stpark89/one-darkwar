import { create } from 'zustand'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { Season, WarRound, WarEntry, WarTeam, WarRole, MemberWarRow, VsPointEntry } from '@/domain/entities/War'

interface SummaryRow {
  memberId: string
  inGameName: string
  total: number
  ct: number
  db: number
  teamA: number
  teamB: number
}

interface WarStore {
  seasons: Season[]
  activeSeason: Season | null
  rounds: WarRound[]
  entries: WarEntry[]
  vsPoints: VsPointEntry[]
  members: { id: string; inGameName: string }[]
  loading: boolean
  searchQuery: string
  filterTeam: string

  loadData: () => Promise<void>
  addRound: (date: string) => Promise<void>
  deleteRound: (roundId: string) => Promise<void>
  updateRoundDate: (roundId: string, date: string) => Promise<void>
  syncMemberName: (memberId: string, newName: string) => void
  setSearchQuery: (q: string) => void
  setFilterTeam: (team: string) => void
  getMemberRows: () => MemberWarRow[]
  getSummary: () => SummaryRow[]
  batchSave: (changes: { roundId: string; memberId: string; team: WarTeam; role: WarRole; note: string }[]) => Promise<boolean>
  batchSaveVs: (changes: { roundId: string; memberId: string; points: number }[]) => Promise<boolean>
}

function sortRoundsByDate(rounds: WarRound[]): WarRound[] {
  return [...rounds]
    .sort((a, b) => {
      if (a.date < b.date) return -1
      if (a.date > b.date) return 1
      return 0
    })
    .map((r, idx) => ({ ...r, sortOrder: idx + 1 }))
}

export const useWarStore = create<WarStore>((set, get) => ({
  seasons: [],
  activeSeason: null,
  rounds: [],
  entries: [],
  vsPoints: [],
  members: [],
  loading: false,
  searchQuery: '',
  filterTeam: '',

  loadData: async () => {
    if (get().loading) return
    set({ loading: true })
    try {
      const [{ data: seasonRows }, { data: memberRows }] = await Promise.all([
        supabase.from('seasons').select('*').order('created_at'),
        supabase.from('members').select('id, in_game_name').order('created_at'),
      ])

      const seasons: Season[] = (seasonRows ?? []).map(r => ({
        id: r.id, name: r.name, isActive: r.is_active,
      }))
      const activeSeason = seasons.find(s => s.isActive) ?? seasons[seasons.length - 1] ?? null
      const members = (memberRows ?? []).map(r => ({ id: r.id, inGameName: r.in_game_name }))

      if (!activeSeason) {
        set({ seasons, activeSeason: null, rounds: [], entries: [], vsPoints: [], members })
        return
      }

      const { data: roundRows } = await supabase
        .from('war_rounds').select('*')
        .eq('season_id', activeSeason.id)

      const rawRounds: WarRound[] = (roundRows ?? []).map(r => ({
        id: r.id, seasonId: r.season_id, sortOrder: 0, date: r.round_date ?? '',
      }))
      const rounds = sortRoundsByDate(rawRounds)

      const roundIds = rounds.map(r => r.id)
      const { data: entryRows } = roundIds.length > 0
        ? await supabase.from('war_entries').select('*').in('round_id', roundIds)
        : { data: [] }

      const entries: WarEntry[] = (entryRows ?? []).map(r => ({
        roundId: r.round_id,
        memberId: r.member_id,
        team: r.team as WarTeam,
        role: r.role as WarRole,
        note: r.note ?? '',
      }))

      let vsPoints: VsPointEntry[] = []
      try {
        if (roundIds.length > 0) {
          const { data: vsRows } = await supabase
            .from('war_vs_points').select('*').in('round_id', roundIds)
          vsPoints = (vsRows ?? []).map(r => ({
            roundId: r.round_id,
            memberId: r.member_id,
            points: r.points ?? 0,
          }))
        }
      } catch {
        // table may not exist yet — graceful fallback
      }

      set({ seasons, activeSeason, rounds, entries, vsPoints, members })
    } finally {
      set({ loading: false })
    }
  },

  addRound: async (date) => {
    const { activeSeason, rounds } = get()
    if (!activeSeason) return
    const { data } = await supabase
      .from('war_rounds')
      .insert({ season_id: activeSeason.id, sort_order: rounds.length + 1, round_date: date || null })
      .select().single()
    if (!data) return
    const newRound: WarRound = { id: data.id, seasonId: data.season_id, sortOrder: 0, date: data.round_date ?? '' }
    const sorted = sortRoundsByDate([...rounds, newRound])
    set({ rounds: sorted })
  },

  deleteRound: async (roundId) => {
    await supabase.from('war_rounds').delete().eq('id', roundId)
    set(s => ({
      rounds: s.rounds.filter(r => r.id !== roundId).map((r, idx) => ({ ...r, sortOrder: idx + 1 })),
      entries: s.entries.filter(e => e.roundId !== roundId),
      vsPoints: s.vsPoints.filter(v => v.roundId !== roundId),
    }))
  },

  updateRoundDate: async (roundId, date) => {
    await supabase.from('war_rounds').update({ round_date: date }).eq('id', roundId)
    set(s => {
      const updated = s.rounds.map(r => r.id === roundId ? { ...r, date } : r)
      return { rounds: sortRoundsByDate(updated) }
    })
  },

  batchSave: async (changes) => {
    try {
      const toUpsert = changes.filter(c => c.team !== '' || c.role !== '')
      const toDelete = changes.filter(c => c.team === '' && c.role === '')

      if (toUpsert.length > 0) {
        const { error } = await supabase.from('war_entries').upsert(
          toUpsert.map(c => ({
            round_id: c.roundId,
            member_id: c.memberId,
            team: c.team,
            role: c.role,
            note: c.note,
          })),
          { onConflict: 'round_id,member_id' }
        )
        if (error) throw error
      }

      for (const c of toDelete) {
        await supabase.from('war_entries')
          .delete()
          .eq('round_id', c.roundId)
          .eq('member_id', c.memberId)
      }

      // update local state
      set(s => {
        let entries = [...s.entries]
        for (const c of changes) {
          entries = entries.filter(e => !(e.roundId === c.roundId && e.memberId === c.memberId))
          if (c.team !== '' || c.role !== '') {
            entries.push({ roundId: c.roundId, memberId: c.memberId, team: c.team, role: c.role, note: c.note })
          }
        }
        return { entries }
      })

      return true
    } catch (err) {
      console.error('batchSave error', err)
      toast.error('저장 중 오류가 발생했습니다.')
      return false
    }
  },

  batchSaveVs: async (changes) => {
    try {
      const toUpsert = changes.filter(c => c.points !== 0)
      const toDelete = changes.filter(c => c.points === 0)

      if (toUpsert.length > 0) {
        const { error } = await supabase.from('war_vs_points').upsert(
          toUpsert.map(c => ({
            round_id: c.roundId,
            member_id: c.memberId,
            points: c.points,
          })),
          { onConflict: 'round_id,member_id' }
        )
        if (error) throw error
      }

      for (const c of toDelete) {
        await supabase.from('war_vs_points')
          .delete()
          .eq('round_id', c.roundId)
          .eq('member_id', c.memberId)
      }

      set(s => {
        let vsPoints = [...s.vsPoints]
        for (const c of changes) {
          vsPoints = vsPoints.filter(v => !(v.roundId === c.roundId && v.memberId === c.memberId))
          if (c.points !== 0) {
            vsPoints.push({ roundId: c.roundId, memberId: c.memberId, points: c.points })
          }
        }
        return { vsPoints }
      })

      return true
    } catch (err) {
      console.error('batchSaveVs error', err)
      toast.error('VS 포인트 저장 중 오류가 발생했습니다.')
      return false
    }
  },

  syncMemberName: (memberId, newName) =>
    set(s => ({ members: s.members.map(m => m.id === memberId ? { ...m, inGameName: newName } : m) })),

  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setFilterTeam: (filterTeam) => set({ filterTeam }),

  getMemberRows: () => {
    const { entries, rounds, members, searchQuery, filterTeam } = get()
    let rows: MemberWarRow[] = members.map(m => {
      const entryMap: Record<string, { team: WarTeam; role: WarRole; note: string }> = {}
      rounds.forEach(r => {
        const e = entries.find(en => en.roundId === r.id && en.memberId === m.id)
        entryMap[r.id] = { team: e?.team ?? '', role: e?.role ?? '', note: e?.note ?? '' }
      })
      const total = Object.values(entryMap).filter(e => e.role !== '').length
      return { memberId: m.id, inGameName: m.inGameName, entryMap, total }
    })

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      rows = rows.filter(r => r.inGameName.toLowerCase().includes(q))
    }
    if (filterTeam) {
      rows = rows.filter(r =>
        Object.values(r.entryMap).some(e => e.team === filterTeam && e.role !== '')
      )
    }
    return rows
  },

  getSummary: () => {
    const { entries, members } = get()
    return members.map(m => {
      const me = entries.filter(e => e.memberId === m.id)
      const ct = me.filter(e => e.role === 'CT').length
      const db = me.filter(e => e.role === 'DB').length
      return {
        memberId: m.id, inGameName: m.inGameName,
        ct, db, total: ct + db,
        teamA: me.filter(e => e.team === 'A').length,
        teamB: me.filter(e => e.team === 'B').length,
      }
    }).sort((a, b) => b.total - a.total)
  },
}))
