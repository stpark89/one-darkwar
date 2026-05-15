import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { Member, CreateMemberInput } from '@/domain/entities/Member'
import { useWarStore } from './warStore'
import { useEventStore } from './eventStore'

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

const parseCp = (cp: string): number => {
  const v = parseFloat(cp)
  if (isNaN(v)) return 0
  if (cp.toUpperCase().includes('G')) return v * 1000
  if (cp.toUpperCase().includes('M')) return v
  return v
}

const sortBycp = (a: Member, b: Member) => parseCp(b.cp) - parseCp(a.cp)

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
    if (get().loading) return
    set({ loading: true })
    try {
      const { data } = await supabase.from('members').select('*')
      set({ members: (data ?? []).map(toMember).sort(sortBycp) })
    } finally {
      set({ loading: false })
    }
  },

  setMembers: (members) => set({ members: [...members].sort(sortBycp) }),

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
    set((s) => ({ members: [...s.members, newMember].sort(sortBycp) }))
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
    set((s) => ({
      members: s.members.map((m) => (m.id === id ? { ...m, ...input } : m)).sort(sortBycp),
    }))
    if (input.inGameName !== undefined) {
      useWarStore.getState().syncMemberName(id, input.inGameName)
      useEventStore.getState().syncMemberName(id, input.inGameName)
    }
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
