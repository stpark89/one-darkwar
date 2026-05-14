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
  loadSession: () => Promise<void>
  signIn: (inGameName: string, password: string) => Promise<string | null>
  signUp: (inGameName: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
}

// 인게임명 → Supabase email 변환 (내부용)
const toEmail = (name: string) =>
  `${encodeURIComponent(name.trim().toLowerCase())}@onedarkwar.local`

async function fetchProfile(userId: string): Promise<AuthUser | null> {
  const { data } = await supabase
    .from('profiles')
    .select('id, in_game_name, role')
    .eq('id', userId)
    .single()
  if (!data) return null
  return { id: data.id, inGameName: data.in_game_name, role: data.role as UserRole }
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  loading: true,

  loadSession: async () => {
    set({ loading: true })
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      const profile = await fetchProfile(session.user.id)
      set({ user: profile, loading: false })
    } else {
      set({ user: null, loading: false })
    }

    // 세션 변경 감지 (탭 간 동기화)
    supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const profile = await fetchProfile(session.user.id)
        set({ user: profile })
      } else {
        set({ user: null })
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
      const profile = await fetchProfile(data.user.id)
      set({ user: profile })
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

    // 프로필 생성
    const { error: profileError } = await supabase.from('profiles').insert({
      id: data.user.id,
      in_game_name: trimmed,
      role: 'ROLE_USER',
    })
    if (profileError) return profileError.message

    const profile: AuthUser = { id: data.user.id, inGameName: trimmed, role: 'ROLE_USER' }
    set({ user: profile })
    return null
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null })
  },
}))
