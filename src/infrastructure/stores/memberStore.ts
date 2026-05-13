import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { Member, CreateMemberInput } from '@/domain/entities/Member'

interface MemberStore {
  members: Member[]
  loading: boolean
  searchQuery: string

  loadMembers: () => Promise<void>
  setMembers: (members: Member[]) => void
  addMember: (input: CreateMemberInput) => Promise<string>
  updateMember: (id: string, input: Partial<Member>) => Promise<void>
  deleteMember: (id: string) => Promise<void>
  setSearchQuery: (q: string) => void
  getFiltered: () => Member[]
}

const toMember = (row: Record<string, string>): Member => ({
  id: row.id,
  inGameName: row.in_game_name,
  zaloName: row.zalo_name,
  cp: row.cp,
  houseLevel: row.house_level,
  note: row.note,
})

export const useMemberStore = create<MemberStore>((set, get) => ({
  members: [],
  loading: false,
  searchQuery: '',

  loadMembers: async () => {
    set({ loading: true })
    const { data } = await supabase.from('members').select('*').order('created_at')
    set({ members: (data ?? []).map(toMember), loading: false })
  },

  setMembers: (members) => set({ members }),

  addMember: async (input) => {
    const { data } = await supabase
      .from('members')
      .insert({
        in_game_name: input.inGameName,
        zalo_name: input.zaloName ?? '',
        cp: input.cp ?? '',
        house_level: input.houseLevel ?? '',
        note: input.note ?? '',
      })
      .select()
      .single()
    if (!data) return ''
    const newMember = toMember(data)
    set((s) => ({ members: [...s.members, newMember] }))
    return newMember.id
  },

  updateMember: async (id, input) => {
    const updates: Record<string, string> = {}
    if (input.inGameName !== undefined) updates.in_game_name = input.inGameName
    if (input.zaloName !== undefined) updates.zalo_name = input.zaloName
    if (input.cp !== undefined) updates.cp = input.cp
    if (input.houseLevel !== undefined) updates.house_level = input.houseLevel
    if (input.note !== undefined) updates.note = input.note

    await supabase.from('members').update(updates).eq('id', id)
    set((s) => ({ members: s.members.map((m) => (m.id === id ? { ...m, ...input } : m)) }))
  },

  deleteMember: async (id) => {
    await supabase.from('members').delete().eq('id', id)
    set((s) => ({ members: s.members.filter((m) => m.id !== id) }))
    // attendance rows are cascade deleted by DB foreign key
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
