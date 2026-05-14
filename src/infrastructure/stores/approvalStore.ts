import { create } from 'zustand'
import { supabase } from '@/lib/supabase'

export interface PendingUser {
  id: string
  inGameName: string
  createdAt: string
}

export interface ApprovedUser {
  id: string
  inGameName: string
  role: 'ROLE_ADMIN' | 'ROLE_USER'
  createdAt: string
}

interface ApprovalStore {
  pendingUsers: PendingUser[]
  pendingCount: number
  loading: boolean
  rejectedUsers: PendingUser[]
  rejectedLoading: boolean
  approvedUsers: ApprovedUser[]
  approvedLoading: boolean
  loadPending: () => Promise<void>
  loadRejected: () => Promise<void>
  loadApproved: () => Promise<void>
  approveUser: (userId: string) => Promise<void>
  rejectUser: (userId: string) => Promise<void>
  restoreUser: (userId: string) => Promise<void>
  purgeUser: (userId: string) => Promise<void>
  changeRole: (userId: string, role: 'ROLE_ADMIN' | 'ROLE_USER') => Promise<void>
}

export const useApprovalStore = create<ApprovalStore>((set, get) => ({
  pendingUsers: [],
  pendingCount: 0,
  loading: false,
  rejectedUsers: [],
  rejectedLoading: false,
  approvedUsers: [],
  approvedLoading: false,

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

  loadRejected: async () => {
    set({ rejectedLoading: true })
    const { data, error } = await supabase
      .from('profiles')
      .select('id, in_game_name, created_at, status')
      .eq('status', 'REJECTED')
      .order('created_at', { ascending: false })
    if (error) console.error('[approvalStore] loadRejected error:', error)
    const users: PendingUser[] = (data ?? []).map((r) => ({
      id: r.id,
      inGameName: r.in_game_name,
      createdAt: r.created_at,
    }))
    set({ rejectedUsers: users, rejectedLoading: false })
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
    const target = get().pendingUsers.find((u) => u.id === userId)
    await supabase.from('profiles').update({ status: 'REJECTED' }).eq('id', userId)
    const pending = get().pendingUsers.filter((u) => u.id !== userId)
    const rejected = target ? [target, ...get().rejectedUsers] : get().rejectedUsers
    set({ pendingUsers: pending, pendingCount: pending.length, rejectedUsers: rejected })
  },

  restoreUser: async (userId) => {
    const target = get().rejectedUsers.find((u) => u.id === userId)
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
    const users = get().rejectedUsers.filter((u) => u.id !== userId)
    set({ rejectedUsers: users })
  },

  purgeUser: async (userId) => {
    await supabase.from('profiles').delete().eq('id', userId)
    const users = get().rejectedUsers.filter((u) => u.id !== userId)
    set({ rejectedUsers: users })
  },

  loadApproved: async () => {
    set({ approvedLoading: true })
    const { data, error } = await supabase
      .from('profiles')
      .select('id, in_game_name, role, created_at')
      .eq('status', 'APPROVED')
      .order('role', { ascending: false })
    if (error) console.error('[approvalStore] loadApproved error:', error)
    const users: ApprovedUser[] = (data ?? []).map((r) => ({
      id: r.id,
      inGameName: r.in_game_name,
      role: r.role as 'ROLE_ADMIN' | 'ROLE_USER',
      createdAt: r.created_at,
    }))
    set({ approvedUsers: users, approvedLoading: false })
  },

  changeRole: async (userId, role) => {
    await supabase.from('profiles').update({ role }).eq('id', userId)
    set((s) => ({
      approvedUsers: s.approvedUsers.map((u) =>
        u.id === userId ? { ...u, role } : u,
      ),
    }))
  },
}))
