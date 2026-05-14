import { create } from 'zustand'
import { supabase } from '@/lib/supabase'

export type UserRole = 'ROLE_USER' | 'ROLE_ADMIN'

export interface AuthUser {
  id: string
  inGameName: string
  role: UserRole
}

interface AuthStore {
  user: AuthUser | null
  loading: boolean
  isGuest: boolean
  loadSession: () => Promise<void>
  signIn: (inGameName: string, password: string) => Promise<string | null>
  signUp: (inGameName: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
  guestLogin: () => void
  updateLastSeen: () => Promise<void>
}

// 인게임명 → Supabase email 변환 (내부용)
const toEmail = (name: string) =>
  `${encodeURIComponent(name.trim().toLowerCase())}@onedarkwar.app`

// 승인 대기 사용자임을 알리는 특수 에러 코드
export const PENDING_APPROVAL_ERROR = 'PENDING_APPROVAL'

async function fetchProfile(userId: string): Promise<AuthUser | null> {
  const { data } = await supabase
    .from('profiles')
    .select('id, in_game_name, role, status')
    .eq('id', userId)
    .single()
  if (!data) return null
  if (data.status === 'PENDING') return null  // 미승인 → 로그인 불가
  return { id: data.id, inGameName: data.in_game_name, role: data.role as UserRole }
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  loading: true,
  isGuest: false,

  loadSession: async () => {
    set({ loading: true })
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      const profile = await fetchProfile(session.user.id)
      set({ user: profile, loading: false })
    } else {
      set({ user: null, loading: false })
    }

    // 세션 변경 감지 (탭 간 동기화, 비밀번호 변경 후 USER_UPDATED 포함)
    supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const profile = await fetchProfile(session.user.id)
        set({ user: profile, loading: false })
      } else {
        set({ user: null, loading: false })
      }
    })
  },

  signIn: async (inGameName, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: toEmail(inGameName),
      password,
    })
    if (error) return error.message
    if (data.user) {
      // status 직접 조회하여 PENDING 판별
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, in_game_name, role, status')
        .eq('id', data.user.id)
        .single()
      if (profile?.status === 'PENDING') {
        await supabase.auth.signOut()
        return PENDING_APPROVAL_ERROR
      }
      set({ user: profile ? { id: profile.id, inGameName: profile.in_game_name, role: profile.role as UserRole } : null })
    }
    return null
  },

  signUp: async (inGameName, password) => {
    const trimmed = inGameName.trim()
    if (!trimmed) return '인게임명을 입력해주세요.'

    const { data, error } = await supabase.auth.signUp({
      email: toEmail(trimmed),
      password,
    })
    if (error) return error.message
    if (!data.user) return '회원가입에 실패했습니다.'

    // 프로필 생성 (status: PENDING — 관리자 승인 필요)
    const { error: profileError } = await supabase.from('profiles').insert({
      id: data.user.id,
      in_game_name: trimmed,
      role: 'ROLE_USER',
      status: 'PENDING',
    })
    if (profileError) return profileError.message

    // 가입 후 즉시 로그아웃 (승인 전 접근 차단)
    await supabase.auth.signOut()
    return null
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null, isGuest: false })
  },

  guestLogin: () => {
    set({ isGuest: true, user: null, loading: false })
  },

  updateLastSeen: async () => {
    const { user } = useAuthStore.getState()
    if (!user) return
    await supabase
      .from('profiles')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', user.id)
  },
}))
