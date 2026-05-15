import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { Season, WarRound, WarEntry, WarTeam, WarRole, MemberWarRow } from '@/domain/entities/War'

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
  members: { id: string; inGameName: string }[]
  loading: boolean
  searchQuery: string
  filterTeam: string

  loadData: () => Promise<void>
  addRound: (date: string) => Promise<void>
  deleteRound: (roundId: string) => Promise<void>
  updateEntry: (roundId: string, memberId: string, team: WarTeam, role: WarRole) => Promise<void>
  syncMemberName: (memberId: string, newName: string) => void
  setSearchQuery: (q: string) => void
  setFilterTeam: (team: string) => void
  getMemberRows: () => MemberWarRow[]
  getSummary: () => SummaryRow[]
}

export const nextEntry = (team: string, role: string): [WarTeam, WarRole] => {
  if (!team || !role) return ['A', 'CT']
  if (team === 'A' && role === 'CT') return ['A', 'DB']
  if (team === 'A' && role === 'DB') return ['B', 'CT']
  if (team === 'B' && role === 'CT') return ['B', 'DB']
  return ['', '']
}

export const useWarStore = create<WarStore>((set, get) => ({
  seasons: [],
  activeSeason: null,
  rounds: [],
  entries: [],
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
        set({ seasons, activeSeason: null, rounds: [], entries: [], members })
        return
      }

      const { data: roundRows } = await supabase
        .from('war_rounds').select('*')
        .eq('season_id', activeSeason.id).order('sort_order')

      const rounds: WarRound[] = (roundRows ?? []).map(r => ({
        id: r.id, seasonId: r.season_id, sortOrder: r.sort_order, date: r.round_date ?? '',
      }))

      const roundIds = rounds.map(r => r.id)
      const { data: entryRows } = roundIds.length > 0
        ? await supabase.from('war_entries').select('*').in('round_id', roundIds)
        : { data: [] }

      const entries: WarEntry[] = (entryRows ?? []).map(r => ({
        roundId: r.round_id, memberId: r.member_id,
        team: r.team as WarTeam, role: r.role as WarRole,
      }))

      set({ seasons, activeSeason, rounds, entries, members })
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
    const newRound: WarRound = { id: data.id, seasonId: data.season_id, sortOrder: data.sort_order, date: data.round_date ?? '' }
    set(s => ({ rounds: [...s.rounds, newRound] }))
  },

  deleteRound: async (roundId) => {
    // war_entries는 DB cascade로 자동 삭제
    await supabase.from('war_rounds').delete().eq('id', roundId)
    set(s => ({
      rounds: s.rounds.filter(r => r.id !== roundId),
      entries: s.entries.filter(e => e.roundId !== roundId),
    }))
  },

  updateEntry: async (roundId, memberId, team, role) => {
    // 낙관적 업데이트
    set(s => {
      const others = s.entries.filter(e => !(e.roundId === roundId && e.memberId === memberId))
      if (!team && !role) return { entries: others }
      return { entries: [...others, { roundId, memberId, team, role }] }
    })

    if (!team && !role) {
      await supabase.from('war_entries').delete().eq('round_id', roundId).eq('member_id', memberId)
    } else {
      await supabase.from('war_entries').upsert(
        { round_id: roundId, member_id: memberId, team, role },
        { onConflict: 'round_id,member_id' }
      )
    }
  },

  syncMemberName: (memberId, newName) =>
    set(s => ({ members: s.members.map(m => m.id === memberId ? { ...m, inGameName: newName } : m) })),

  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setFilterTeam: (filterTeam) => set({ filterTeam }),

  getMemberRows: () => {
    const { entries, rounds, members, searchQuery, filterTeam } = get()
    let rows: MemberWarRow[] = members.map(m => {
      const entryMap: Record<string, { team: WarTeam; role: WarRole }> = {}
      rounds.forEach(r => {
        const e = entries.find(en => en.roundId === r.id && en.memberId === m.id)
        entryMap[r.id] = { team: e?.team ?? '', role: e?.role ?? '' }
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
