import { create } from 'zustand'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { Member, CreateMemberInput } from '@/domain/entities/Member'
import { useWarStore } from './warStore'
import { useVsPointStore } from './vsPointStore'
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
  updateMember: (id: string, input: Partial<Member>) => Promise<boolean>
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
      // 이름 변경: RPC 로 members + profiles + auth.users 동기화 시도
      // RPC 미배포 시(함수 없음)엔 직접 members.update 로 fallback
      const newEmail = toLoginEmail(input.inGameName!)
      const { data, error } = await supabase.rpc('rename_member_with_profile', {
        p_member_id: id,
        p_new_name: input.inGameName,
        p_new_email: newEmail,
      })

      if (error) {
        // 함수 자체가 없는 경우(미배포) → 직접 update fallback
        const isFunctionMissing =
          error.code === 'PGRST202' || error.code === '42883' ||
          error.message?.includes('Could not find the function') ||
          error.message?.includes('does not exist')

        if (isFunctionMissing) {
          // RPC 없이 members 테이블만 직접 업데이트
          const { error: directErr } = await supabase
            .from('members')
            .update({ in_game_name: input.inGameName })
            .eq('id', id)
          if (directErr) {
            console.error('[memberStore] direct rename error:', directErr)
            toast.error('이름 변경 중 오류가 발생했습니다.')
            return false
          }
          // fallback 성공 — 이름 외 다른 필드는 아래 updates 에서 처리
        } else {
          console.error('[memberStore] rename RPC error:', error)
          toast.error('이름 변경 중 오류가 발생했습니다.')
          return false
        }
      } else {
        // RPC 응답 처리
        const result = (data ?? {}) as { ok: boolean; reason?: string; profile_updated?: boolean }
        if (!result.ok) {
          if (result.reason === 'email_conflict') {
            toast.error('해당 인게임명의 로그인 계정이 이미 존재합니다. 다른 이름을 사용하세요.')
          } else if (result.reason === 'member_not_found') {
            toast.error('멤버를 찾을 수 없습니다.')
          } else if (result.reason !== 'no_change') {
            toast.error('이름 변경에 실패했습니다.')
          }
          if (result.reason !== 'no_change') return false
        }
        if (result.profile_updated) {
          toast.success('이름이 멤버 명단 + 로그인 계정에 함께 반영되었습니다.')
        }
      }
    }

    // 이름 외 나머지 필드 (혹은 이름이 안 바뀐 경우 모든 필드) 업데이트
    const updates: Record<string, string> = {}
    if (!nameChanged && input.inGameName !== undefined) updates.in_game_name = input.inGameName
    if (input.zaloName !== undefined) updates.zalo_name = input.zaloName ?? ''
    if (input.cp !== undefined) updates.cp = input.cp ?? ''
    if (input.houseLevel !== undefined) updates.house_level = input.houseLevel ?? ''
    if (input.note !== undefined) updates.note = input.note ?? ''

    if (Object.keys(updates).length > 0) {
      const { error } = await supabase.from('members').update(updates).eq('id', id)
      if (error) {
        console.error('[memberStore] updateMember error:', error)
        toast.error('저장 중 오류가 발생했습니다.')
        return false
      }
    }

    set((s) => ({
      members: s.members.map((m) => (m.id === id ? { ...m, ...input } : m)).sort(sortBycp),
    }))
    if (!nameChanged) toast.success('저장되었습니다.')
    if (input.inGameName !== undefined) {
      useWarStore.getState().syncMemberName(id, input.inGameName)
      useEventStore.getState().syncMemberName(id, input.inGameName)
      useVsPointStore.getState().syncMemberName(id, input.inGameName)
    }
    return true
  },

  deleteMember: async (id) => {
    await supabase.from('members').delete().eq('id', id)
    set((s) => ({ members: s.members.filter((m) => m.id !== id) }))
    // in-memory sync: related rows cascade-deleted in DB, mirror locally
    useWarStore.getState().syncDeleteMember(id)
    useVsPointStore.getState().syncDeleteMember(id)
    useEventStore.getState().syncDeleteMember(id)
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
