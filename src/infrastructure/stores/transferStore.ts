import { create } from 'zustand'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { withTimeout } from '@/lib/timeout'
import type { TransferApplication, TransferDraft, TransferStatus } from '@/domain/entities/Transfer'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toApp = (r: any): TransferApplication => ({
  id: r.id,
  inGameName: r.in_game_name,
  uid: r.uid ?? '',
  currentServer: r.current_server ?? '',
  country: r.country ?? '',
  cp: r.cp ?? '',
  tierId: r.tier_id ?? null,
  status: r.status,
  adminMessage: r.admin_message ?? '',
  reviewedAt: r.reviewed_at,
  reviewedBy: r.reviewed_by,
  createdAt: r.created_at,
})

interface TransferStore {
  apps: TransferApplication[]
  loading: boolean
  initialized: boolean
  submit: (draft: TransferDraft) => Promise<boolean>
  loadAll: (force?: boolean) => Promise<void>
  updateStatus: (id: string, status: TransferStatus, reviewerId: string, adminMessage?: string) => Promise<void>
  updateAdminMessage: (id: string, adminMessage: string) => Promise<void>
  updateTier: (id: string, tierId: string | null) => Promise<void>
  remove: (id: string) => Promise<void>
  /** 신청자가 본인 신청서 내용 수정 + 상태 PENDING 재설정 */
  updateApplication: (id: string, draft: TransferDraft) => Promise<boolean>
  /** 게스트가 UID 로 본인 신청 조회 (anon RPC 호출). inGameName 은 더 이상 사용 안 함 (호환용) */
  lookupByCredentials: (uid: string) => Promise<TransferApplication[]>
}

export const useTransferStore = create<TransferStore>((set, get) => ({
  apps: [],
  loading: false,
  initialized: false,

  submit: async (draft) => {
    const inGameName = draft.inGameName.trim()
    if (!inGameName) {
      toast.error('인게임명을 입력해주세요.')
      return false
    }
    const { error } = await supabase.from('transfer_applications').insert({
      in_game_name: inGameName,
      uid: draft.uid.trim(),
      current_server: draft.currentServer.trim(),
      country: draft.country.trim(),
      cp: draft.cp.trim(),
      tier_id: draft.tierId,
    })
    if (error) {
      console.error('transfer submit error', error)
      toast.error('신청 중 오류가 발생했습니다.')
      return false
    }
    return true
  },

  loadAll: async (force = false) => {
    if (!force && get().initialized) return
    set({ loading: true })
    try {
      const { data, error } = await supabase
        .from('transfer_applications')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      set({ apps: (data ?? []).map(toApp), initialized: true })
    } catch (err) {
      console.error('transfer load error', err)
    } finally {
      set({ loading: false })
    }
  },

  updateStatus: async (id, status, reviewerId, adminMessage) => {
    const payload: Record<string, unknown> = {
      status,
      reviewed_at: new Date().toISOString(),
      reviewed_by: reviewerId,
    }
    if (typeof adminMessage === 'string') payload.admin_message = adminMessage
    const { error } = await supabase
      .from('transfer_applications')
      .update(payload)
      .eq('id', id)
    if (error) {
      console.error('transfer update error', error)
      toast.error('상태 변경 중 오류가 발생했습니다.')
      return
    }
    set((s) => ({
      apps: s.apps.map((a) =>
        a.id === id
          ? {
              ...a,
              status,
              reviewedAt: new Date().toISOString(),
              reviewedBy: reviewerId,
              ...(typeof adminMessage === 'string' ? { adminMessage } : {}),
            }
          : a,
      ),
    }))
  },

  updateAdminMessage: async (id, adminMessage) => {
    const { error } = await supabase
      .from('transfer_applications')
      .update({ admin_message: adminMessage })
      .eq('id', id)
    if (error) {
      console.error('transfer updateAdminMessage error', error)
      toast.error('메시지 저장 중 오류가 발생했습니다.')
      return
    }
    set((s) => ({
      apps: s.apps.map((a) => (a.id === id ? { ...a, adminMessage } : a)),
    }))
  },

  updateApplication: async (id, draft) => {
    const { error } = await supabase
      .from('transfer_applications')
      .update({
        in_game_name: draft.inGameName.trim(),
        uid: draft.uid.trim(),
        current_server: draft.currentServer.trim(),
        country: draft.country.trim(),
        cp: draft.cp.trim(),
        tier_id: draft.tierId,
        status: 'PENDING',
        reviewed_at: null,
        reviewed_by: null,
      })
      .eq('id', id)
    if (error) {
      console.error('transfer updateApplication error', error)
      toast.error('수정 중 오류가 발생했습니다.')
      return false
    }
    set((s) => ({
      apps: s.apps.map((a) =>
        a.id === id
          ? { ...a, ...draft, status: 'PENDING' as TransferStatus, reviewedAt: null, reviewedBy: null }
          : a,
      ),
    }))
    return true
  },

  lookupByCredentials: async (uid) => {
    const trimmedUid = uid.trim()
    if (!trimmedUid) return []
    try {
      // RPC 가 hang 되어도 8초 안에 반드시 풀리도록 race
      // p_name 은 RPC 시그니처 호환을 위해 빈 문자열로 전달 (서버에서 무시됨)
      const res = await withTimeout(
        Promise.resolve(
          supabase.rpc('get_my_transfer', {
            p_name: '',
            p_uid: trimmedUid,
          }),
        ),
        8000,
      )
      if (res.error) {
        console.error('transfer lookup error', res.error)
        toast.error('조회 중 오류가 발생했습니다.')
        return []
      }
      return ((res.data ?? []) as unknown[]).map(toApp)
    } catch (err) {
      console.error('transfer lookup timeout/exception', err)
      toast.error('조회 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.')
      return []
    }
  },

  updateTier: async (id, tierId) => {
    const { error } = await supabase
      .from('transfer_applications')
      .update({ tier_id: tierId })
      .eq('id', id)
    if (error) {
      console.error('transfer updateTier error', error)
      toast.error('등급 변경 중 오류가 발생했습니다.')
      return
    }
    set((s) => ({
      apps: s.apps.map((a) => (a.id === id ? { ...a, tierId } : a)),
    }))
  },

  remove: async (id) => {
    const { error } = await supabase.from('transfer_applications').delete().eq('id', id)
    if (error) {
      console.error('transfer delete error', error)
      toast.error('삭제 중 오류가 발생했습니다.')
      return
    }
    set((s) => ({ apps: s.apps.filter((a) => a.id !== id) }))
  },
}))
