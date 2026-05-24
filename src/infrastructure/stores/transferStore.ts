import { create } from 'zustand'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { TransferApplication, TransferDraft, TransferStatus } from '@/domain/entities/Transfer'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toApp = (r: any): TransferApplication => ({
  id: r.id,
  inGameName: r.in_game_name,
  currentServer: r.current_server ?? '',
  cp: r.cp ?? '',
  status: r.status,
  reviewedAt: r.reviewed_at,
  reviewedBy: r.reviewed_by,
  createdAt: r.created_at,
})

interface TransferStore {
  apps: TransferApplication[]
  loading: boolean
  submit: (draft: TransferDraft) => Promise<boolean>
  loadAll: () => Promise<void>
  updateStatus: (id: string, status: TransferStatus, reviewerId: string) => Promise<void>
  remove: (id: string) => Promise<void>
}

export const useTransferStore = create<TransferStore>((set, get) => ({
  apps: [],
  loading: false,

  submit: async (draft) => {
    const inGameName = draft.inGameName.trim()
    if (!inGameName) {
      toast.error('인게임명을 입력해주세요.')
      return false
    }
    const { error } = await supabase.from('transfer_applications').insert({
      in_game_name: inGameName,
      current_server: draft.currentServer.trim(),
      cp: draft.cp.trim(),
    })
    if (error) {
      console.error('transfer submit error', error)
      toast.error('신청 중 오류가 발생했습니다.')
      return false
    }
    return true
  },

  loadAll: async () => {
    if (get().loading) return
    set({ loading: true })
    try {
      const { data, error } = await supabase
        .from('transfer_applications')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      set({ apps: (data ?? []).map(toApp) })
    } catch (err) {
      console.error('transfer load error', err)
    } finally {
      set({ loading: false })
    }
  },

  updateStatus: async (id, status, reviewerId) => {
    const { error } = await supabase
      .from('transfer_applications')
      .update({
        status,
        reviewed_at: new Date().toISOString(),
        reviewed_by: reviewerId,
      })
      .eq('id', id)
    if (error) {
      console.error('transfer update error', error)
      toast.error('상태 변경 중 오류가 발생했습니다.')
      return
    }
    set((s) => ({
      apps: s.apps.map((a) =>
        a.id === id
          ? { ...a, status, reviewedAt: new Date().toISOString(), reviewedBy: reviewerId }
          : a,
      ),
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
