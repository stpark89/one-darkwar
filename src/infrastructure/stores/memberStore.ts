import { create } from 'zustand'
import type { Member, CreateMemberInput } from '@/domain/entities/Member'
import mockData from '../mockData.json'

interface MemberStore {
  members: Member[]
  searchQuery: string

  setMembers: (members: Member[]) => void
  addMember: (input: CreateMemberInput) => string
  updateMember: (id: string, input: Partial<Member>) => void
  deleteMember: (id: string) => void
  setSearchQuery: (q: string) => void
  getFiltered: () => Member[]
}

export const useMemberStore = create<MemberStore>((set, get) => ({
  members: mockData.members as Member[],
  searchQuery: '',

  setMembers: (members) => set({ members }),

  addMember: (input) => {
    const newMember: Member = {
      id: String(Date.now()),
      inGameName: input.inGameName,
      zaloName: input.zaloName ?? '',
      cp: input.cp ?? '',
      houseLevel: input.houseLevel ?? '',
      note: input.note ?? '',
    }
    set((s) => ({ members: [...s.members, newMember] }))
    return newMember.id
  },

  updateMember: (id, input) => {
    set((s) => ({
      members: s.members.map((m) => (m.id === id ? { ...m, ...input } : m)),
    }))
  },

  deleteMember: (id) => {
    set((s) => ({ members: s.members.filter((m) => m.id !== id) }))
  },

  setSearchQuery: (searchQuery) => set({ searchQuery }),

  getFiltered: () => {
    const { members, searchQuery } = get()
    if (!searchQuery) return members
    const q = searchQuery.toLowerCase()
    return members.filter(
      (m) =>
        m.inGameName.toLowerCase().includes(q) ||
        m.zaloName.toLowerCase().includes(q) ||
        m.cp.toLowerCase().includes(q),
    )
  },
}))
