import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { withTimeout } from '@/lib/timeout'

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

/**
 * 승인된 계정을 멤버 명단에 연결한다.
 *  - 이미 명단에 있으면 profile_id 만 채워 연결(중복 행을 만들지 않는다)
 *  - 없으면 새 행을 만들면서 profile_id 를 함께 넣는다
 * members.id 는 auth 계정 id 가 아니므로 연결은 반드시 profile_id 로 한다.
 */
const linkOrCreateMember = async (userId: string, inGameName: string) => {
  // 1) profile_id 또는 예전 방식(id = 계정 id)으로 이미 연결된 행이 있는지
  const { data: linked } = await supabase
    .from('members')
    .select('id, profile_id')
    .or(`profile_id.eq.${userId},id.eq.${userId}`)
    .limit(1)
  if (linked && linked.length > 0) {
    if (!linked[0].profile_id) {
      await supabase.from('members').update({ profile_id: userId }).eq('id', linked[0].id)
    }
    return
  }

  // 2) 같은 인게임명으로 이미 명단에 있으면 새로 만들지 말고 연결만 한다
  const { data: byName } = await supabase
    .from('members')
    .select('id, profile_id')
    .eq('in_game_name', inGameName)
    .limit(1)
  if (byName && byName.length > 0) {
    if (!byName[0].profile_id) {
      await supabase.from('members').update({ profile_id: userId }).eq('id', byName[0].id)
    }
    return
  }

  // 3) 명단에 없으면 새로 추가
  await supabase.from('members').insert({
    id: userId,
    profile_id: userId,
    in_game_name: inGameName,
    zalo_name: '',
    cp: '',
    house_level: '',
    note: '',
  })
}

interface ApprovalStore {
  pendingUsers: PendingUser[]
  pendingCount: number
  loading: boolean
  pendingInitialized: boolean
  rejectedUsers: PendingUser[]
  rejectedLoading: boolean
  rejectedInitialized: boolean
  approvedUsers: ApprovedUser[]
  approvedLoading: boolean
  approvedInitialized: boolean
  loadPending: (force?: boolean) => Promise<void>
  loadRejected: (force?: boolean) => Promise<void>
  loadApproved: (force?: boolean) => Promise<void>
  approveUser: (userId: string) => Promise<void>
  rejectUser: (userId: string, adminMessage?: string) => Promise<void>
  restoreUser: (userId: string) => Promise<void>
  purgeUser: (userId: string) => Promise<void>
  changeRole: (userId: string, role: 'ROLE_ADMIN' | 'ROLE_USER') => Promise<void>
}

export const useApprovalStore = create<ApprovalStore>((set, get) => ({
  pendingUsers: [],
  pendingCount: 0,
  loading: false,
  pendingInitialized: false,
  rejectedUsers: [],
  rejectedLoading: false,
  rejectedInitialized: false,
  approvedUsers: [],
  approvedLoading: false,
  approvedInitialized: false,

  loadPending: async (force = false) => {
    if (!force && get().pendingInitialized) return
    set({ loading: true })
    try {
      const fetchPending = async () =>
        supabase
          .from('profiles')
          .select('id, in_game_name, created_at, status')
          .eq('status', 'PENDING')
          .order('created_at', { ascending: true })
      const { data, error } = await withTimeout(fetchPending())
      if (error) {
        console.error('[approvalStore] loadPending error:', error)
        return
      }
      const users: PendingUser[] = (data ?? []).map((r) => ({
        id: r.id,
        inGameName: r.in_game_name,
        createdAt: r.created_at,
      }))
      set({ pendingUsers: users, pendingCount: users.length, pendingInitialized: true })
    } catch (err) {
      console.error('[approvalStore] loadPending exception:', err)
    } finally {
      set({ loading: false })
    }
  },

  loadRejected: async (force = false) => {
    if (!force && get().rejectedInitialized) return
    set({ rejectedLoading: true })
    try {
      const fetchRejected = async () =>
        supabase
          .from('profiles')
          .select('id, in_game_name, created_at, status')
          .eq('status', 'REJECTED')
          .order('created_at', { ascending: false })
      const { data, error } = await withTimeout(fetchRejected())
      if (error) {
        console.error('[approvalStore] loadRejected error:', error)
        return
      }
      const users: PendingUser[] = (data ?? []).map((r) => ({
        id: r.id,
        inGameName: r.in_game_name,
        createdAt: r.created_at,
      }))
      set({ rejectedUsers: users, rejectedInitialized: true })
    } catch (err) {
      console.error('[approvalStore] loadRejected exception:', err)
    } finally {
      set({ rejectedLoading: false })
    }
  },

  approveUser: async (userId) => {
    const target = get().pendingUsers.find((u) => u.id === userId)
    await supabase.from('profiles').update({ status: 'APPROVED' }).eq('id', userId)
    if (target) {
      await linkOrCreateMember(userId, target.inGameName)
    }
    const users = get().pendingUsers.filter((u) => u.id !== userId)
    set({ pendingUsers: users, pendingCount: users.length })
  },

  rejectUser: async (userId, adminMessage) => {
    const target = get().pendingUsers.find((u) => u.id === userId)
    const payload: Record<string, string> = { status: 'REJECTED' }
    if (typeof adminMessage === 'string') payload.admin_message = adminMessage
    await supabase.from('profiles').update(payload).eq('id', userId)
    const pending = get().pendingUsers.filter((u) => u.id !== userId)
    const rejected = target ? [target, ...get().rejectedUsers] : get().rejectedUsers
    set({ pendingUsers: pending, pendingCount: pending.length, rejectedUsers: rejected })
  },

  restoreUser: async (userId) => {
    const target = get().rejectedUsers.find((u) => u.id === userId)
    await supabase.from('profiles').update({ status: 'APPROVED' }).eq('id', userId)
    if (target) {
      await linkOrCreateMember(userId, target.inGameName)
    }
    const users = get().rejectedUsers.filter((u) => u.id !== userId)
    set({ rejectedUsers: users })
  },

  purgeUser: async (userId) => {
    await supabase.from('profiles').delete().eq('id', userId)
    const users = get().rejectedUsers.filter((u) => u.id !== userId)
    set({ rejectedUsers: users })
  },

  loadApproved: async (force = false) => {
    if (!force && get().approvedInitialized) return
    set({ approvedLoading: true })
    try {
      const fetchApproved = async () =>
        supabase
          .from('profiles')
          .select('id, in_game_name, role, created_at')
          .eq('status', 'APPROVED')
          .order('role', { ascending: false })
      const { data, error } = await withTimeout(fetchApproved())
      if (error) {
        console.error('[approvalStore] loadApproved error:', error)
        return
      }
      const users: ApprovedUser[] = (data ?? []).map((r) => ({
        id: r.id,
        inGameName: r.in_game_name,
        role: r.role as 'ROLE_ADMIN' | 'ROLE_USER',
        createdAt: r.created_at,
      }))
      set({ approvedUsers: users, approvedInitialized: true })
    } catch (err) {
      console.error('[approvalStore] loadApproved exception:', err)
    } finally {
      set({ approvedLoading: false })
    }
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
