import { create } from 'zustand'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { Member, CreateMemberInput } from '@/domain/entities/Member'
import { useWarStore } from './warStore'
import { useEventStore } from './eventStore'

// authStore 의 toEmail 과 동일 규칙 (signIn 시 사용)
const toLoginEmail = (name: string) =>
  `${encodeURIComponent(name.trim().toLowerCase())}@onedarkwar.app`

interface MemberStore {
  members: Member[]
  loading: boolean
  initialized: boolean
  searchQuery: string

  loadMembers: (force?: boolean) => Promise<void>
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
  initialized: false,
  searchQuery: '',

  loadMembers: async (force = false) => {
    if (!force && get().initialized) return
    set({ loading: true })
    try {
      const { data } = await supabase.from('members').select('*')
      set({ members: (data ?? []).map(toMember).sort(sortBycp), initialized: true })
    } catch (err) {
      console.error('[memberStore] loadMembers exception:', err)
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
    // 이름 변경 여부 감지
    const current = get().members.find((m) => m.id === id)
    const nameChanged =
      input.inGameName !== undefined && current !== undefined && current.inGameName !== input.inGameName

    if (nameChanged) {
      // 이름 변경은 RPC 로 처리 — members + profiles + auth.users 동기화
      const newEmail = toLoginEmail(input.inGameName!)
      const { data, error } = await supabase.rpc('rename_member_with_profile', {
        p_member_id: id,
        p_new_name: input.inGameName,
        p_new_email: newEmail,
      })
      if (error) {
        console.error('[memberStore] rename RPC error:', error)
        toast.error('이름 변경 중 오류가 발생했습니다.')
        return
      }
      const result = (data ?? {}) as { ok: boolean; reason?: string; profile_updated?: boolean }
      if (!result.ok) {
        if (result.reason === 'email_conflict') {
          toast.error('해당 인게임명의 로그인 계정이 이미 존재합니다. 다른 이름을 사용하세요.')
        } else if (result.reason === 'member_not_found') {
          toast.error('멤버를 찾을 수 없습니다.')
        } else {
          toast.error('이름 변경에 실패했습니다.')
        }
        return
      }
      // 멤버는 이미 RPC 안에서 update 됨 → 추가 update 는 다른 필드만
      if (result.profile_updated) {
        toast.success('이름이 멤버 명단 + 로그인 계정에 함께 반영되었습니다.')
      }
    }

    // 이름 외 나머지 필드 (혹은 이름이 안 바뀐 경우 모든 필드) 업데이트
    const updates: Record<string, string> = {}
    if (!nameChanged && input.inGameName !== undefined) updates.in_game_name = input.inGameName
    if (input.zaloName !== undefined) updates.zalo_name = input.zaloName
    if (input.cp !== undefined) updates.cp = input.cp
    if (input.houseLevel !== undefined) updates.house_level = input.houseLevel
    if (input.note !== undefined) updates.note = input.note
    if (Object.keys(updates).length > 0) {
      await supabase.from('members').update(updates).eq('id', id)
    }

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
