import { create } from 'zustand'
import { supabase } from '@/lib/supabase'

export interface PendingUser {
  id: string
  inGameName: string
  createdAt: string
}

interface ApprovalStore {
  pendingUsers: PendingUser[]
  pendingCount: number
  loading: boolean
  loadPending: () => Promise<void>
  approveUser: (userId: string) => Promise<void>
  rejectUser: (userId: string) => Promise<void>
}

export const useApprovalStore = create<ApprovalStore>((set, get) => ({
  pendingUsers: [],
  pendingCount: 0,
  loading: false,

  loadPending: async () => {
    set({ loading: true })
    const { data, error } = await supabase
      .from('profiles')
      .select('id, in_game_name, created_at, status')
      .eq('status', 'PENDING')
      .order('created_at', { ascending: true })
    if (error) console.error('[approvalStore] loadPending error:', error)
    const users: PendingUser[] = (data ?? []).map((r) => ({
      id: r.id,
      inGameName: r.in_game_name,
      createdAt: r.created_at,
    }))
    set({ pendingUsers: users, pendingCount: users.length, loading: false })
  },

  approveUser: async (userId) => {
    const target = get().pendingUsers.find((u) => u.id === userId)
    await supabase.from('profiles').update({ status: 'APPROVED' }).eq('id', userId)
    if (target) {
      const { data: existing } = await supabase.from('members').select('id').eq('id', userId).single()
      if (!existing) {
        await supabase.from('members').insert({
          id: userId,
          in_game_name: target.inGameName,
          zalo_name: '',
          cp: '',
          house_level: '',
          note: '',
        })
      }
    }
    const users = get().pendingUsers.filter((u) => u.id !== userId)
    set({ pendingUsers: users, pendingCount: users.length })
  },

  rejectUser: async (userId) => {
    // 프로필 삭제 → Supabase auth 사용자는 남지만 프로필이 없어 로그인 불가
    await supabase.from('profiles').delete().eq('id', userId)
    const users = get().pendingUsers.filter((u) => u.id !== userId)
    set({ pendingUsers: users, pendingCount: users.length })
  },
}))
