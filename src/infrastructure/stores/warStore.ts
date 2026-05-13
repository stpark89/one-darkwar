import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { WarParticipant, WarSession, WarRoundEntry } from '@/domain/entities/War'

const defaultSession: Omit<WarSession, 'participants'> = {
  id: 'black-gold-1',
  name: 'BLACK GOLD',
  rounds: [
    { label: 'Đợt 1', date: '2026-03-29' },
    { label: 'Đợt 2', date: '2026-04-19' },
    { label: 'Đợt 3', date: '2026-04-26' },
    { label: 'Đợt 4', date: '2026-05-10' },
  ],
}

interface WarStore {
  session: WarSession
  loading: boolean
  searchQuery: string
  filterTeam: string
  filterRound: number

  loadParticipants: () => Promise<void>
  setParticipants: (participants: WarParticipant[]) => void
  updateEntry: (participantId: string, round: number, entry: Partial<WarRoundEntry>) => void
  setSearchQuery: (q: string) => void
  setFilterTeam: (team: string) => void
  setFilterRound: (round: number) => void
  getFiltered: () => WarParticipant[]
}

const toParticipant = (row: Record<string, string>): WarParticipant => ({
  id: row.id,
  inGameName: row.in_game_name,
  zaloName: row.zalo_name ?? '',
  cp: row.cp,
  round1: { team: row.r1_team as WarRoundEntry['team'], role: row.r1_role as WarRoundEntry['role'], note: row.r1_note },
  round2: { team: row.r2_team as WarRoundEntry['team'], role: row.r2_role as WarRoundEntry['role'], note: row.r2_note },
  round3: { team: row.r3_team as WarRoundEntry['team'], role: row.r3_role as WarRoundEntry['role'], note: row.r3_note },
  round4: { team: row.r4_team as WarRoundEntry['team'], role: row.r4_role as WarRoundEntry['role'], note: row.r4_note },
})

export const useWarStore = create<WarStore>((set, get) => ({
  session: { ...defaultSession, participants: [] },
  loading: false,
  searchQuery: '',
  filterTeam: '',
  filterRound: 0,

  loadParticipants: async () => {
    set({ loading: true })
    const { data } = await supabase.from('war_participants').select('*').order('created_at')
    set((s) => ({
      session: { ...s.session, participants: (data ?? []).map(toParticipant) },
      loading: false,
    }))
  },

  setParticipants: (participants) =>
    set((s) => ({ session: { ...s.session, participants } })),

  updateEntry: (participantId, round, entry) => {
    set((s) => ({
      session: {
        ...s.session,
        participants: s.session.participants.map((p) => {
          if (p.id !== participantId) return p
          const key = `round${round}` as keyof WarParticipant
          return { ...p, [key]: { ...(p[key] as WarRoundEntry), ...entry } }
        }),
      },
    }))
  },

  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setFilterTeam: (filterTeam) => set({ filterTeam }),
  setFilterRound: (filterRound) => set({ filterRound }),

  getFiltered: () => {
    const { session, searchQuery, filterTeam, filterRound } = get()
    let list = session.participants
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      list = list.filter((p) => p.inGameName.toLowerCase().includes(q))
    }
    if (filterTeam && filterRound > 0) {
      const key = `round${filterRound}` as keyof WarParticipant
      list = list.filter((p) => (p[key] as WarRoundEntry).team === filterTeam)
    }
    return list
  },
}))
