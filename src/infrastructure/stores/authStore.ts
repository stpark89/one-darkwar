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

// 게스트 상태를 새로고침 후에도 유지하기 위한 localStorage 키
const GUEST_FLAG_KEY = 'odw_guest'

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
      // 로그인 성공했으면 게스트 플래그 정리
      localStorage.removeItem(GUEST_FLAG_KEY)
      set({ user: profile, isGuest: false, loading: false })
    } else {
      // 유저 세션이 없을 때는 게스트 플래그 복원 (새로고침 직후 보존용)
      const guest = localStorage.getItem(GUEST_FLAG_KEY) === '1'
      set({ user: null, isGuest: guest, loading: false })
    }

    // 세션 변경 감지 (탭 간 동기화, 비밀번호 변경 후 USER_UPDATED 포함)
    supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const profile = await fetchProfile(session.user.id)
        localStorage.removeItem(GUEST_FLAG_KEY)
        set({ user: profile, isGuest: false, loading: false })
      } else {
        const guest = localStorage.getItem(GUEST_FLAG_KEY) === '1'
        set({ user: null, isGuest: guest, loading: false })
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
    // supabase.auth.signOut() 이 어떤 이유로 hang 되어도 UI 가 멈추지 않도록 3초 안전망
    try {
      await Promise.race([
        supabase.auth.signOut(),
        new Promise<void>((resolve) => setTimeout(resolve, 3000)),
      ])
    } catch (err) {
      console.error('[authStore] signOut exception:', err)
    }
    localStorage.removeItem(GUEST_FLAG_KEY)
    set({ user: null, isGuest: false })
  },

  guestLogin: () => {
    localStorage.setItem(GUEST_FLAG_KEY, '1')
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
