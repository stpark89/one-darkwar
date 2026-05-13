import { create } from 'zustand'
import type { WarParticipant, WarSession, WarRoundEntry } from '@/domain/entities/War'
import mockData from '../mockData.json'

const defaultSession: WarSession = {
  id: 'black-gold-1',
  name: 'BLACK GOLD',
  rounds: [
    { label: 'Đợt 1', date: '2026-03-29' },
    { label: 'Đợt 2', date: '2026-04-19' },
    { label: 'Đợt 3', date: '2026-04-26' },
    { label: 'Đợt 4', date: '2026-05-10' },
  ],
  participants: mockData.warParticipants as WarParticipant[],
}

interface WarStore {
  session: WarSession
  searchQuery: string
  filterTeam: string   // '', 'A', 'B'
  filterRound: number  // 0=전체, 1~4

  setParticipants: (participants: WarParticipant[]) => void
  updateEntry: (participantId: string, round: number, entry: Partial<WarRoundEntry>) => void
  setSearchQuery: (q: string) => void
  setFilterTeam: (team: string) => void
  setFilterRound: (round: number) => void
  getFiltered: () => WarParticipant[]
}

export const useWarStore = create<WarStore>((set, get) => ({
  session: defaultSession,
  searchQuery: '',
  filterTeam: '',
  filterRound: 0,

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
