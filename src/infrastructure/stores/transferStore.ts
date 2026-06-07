import { create } from 'zustand'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { withTimeout } from '@/lib/timeout'
import type {
  TransferApplication,
  TransferDraft,
  TransferStatus,
  ApplicationGroup,
  GroupSubmitDraft,
  DesiredAlliance,
} from '@/domain/entities/Transfer'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toApp = (r: any): TransferApplication => ({
  id: r.id,
  inGameName: r.in_game_name,
  uid: r.uid ?? '',
  currentServer: r.current_server ?? '',
  country: r.country ?? '',
  cp: r.cp ?? '',
  totalPower: r.total_power ?? '',
  note: r.note ?? '',
  tierId: r.tier_id ?? null,
  status: r.status,
  adminMessage: r.admin_message ?? '',
  groupId: r.group_id ?? null,
  desiredAlliance: (r.desired_alliance ?? 'ONE') as DesiredAlliance,
  desiredAllianceOther: r.desired_alliance_other ?? '',
  reviewedAt: r.reviewed_at,
  reviewedBy: r.reviewed_by,
  createdAt: r.created_at,
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toGroup = (r: any): ApplicationGroup => ({
  id: r.id,
  leaderName: r.leader_name,
  leaderUid: r.leader_uid ?? '',
  leaderContact: r.leader_contact ?? '',
  desiredAlliance: (r.desired_alliance ?? 'ONE') as DesiredAlliance,
  desiredAllianceOther: r.desired_alliance_other ?? '',
  memberCount: r.member_count ?? 0,
  createdAt: r.created_at,
})

interface TransferStore {
  apps: TransferApplication[]
  groups: ApplicationGroup[]
  loading: boolean
  initialized: boolean
  /** 단독(본인만) 신청 — 그룹 안 만들고 바로 INSERT */
  submit: (draft: TransferDraft) => Promise<boolean>
  /** 단체 신청 — application_groups + transfer_applications N개 한 트랜잭션으로 (RPC) */
  submitGroup: (draft: GroupSubmitDraft) => Promise<string | null>  // 그룹 id 반환
  loadAll: (force?: boolean) => Promise<void>
  /** 게스트 조회용 — 대기/승인 상태만 (RLS) */
  loadPublic: (force?: boolean) => Promise<void>
  updateStatus: (id: string, status: TransferStatus, reviewerId: string, adminMessage?: string) => Promise<void>
  /** 그룹 전체 멤버 상태 일괄 변경 */
  updateGroupStatus: (groupId: string, status: TransferStatus, reviewerId: string) => Promise<void>
  updateAdminMessage: (id: string, adminMessage: string) => Promise<void>
  updateTier: (id: string, tierId: string | null) => Promise<void>
  remove: (id: string) => Promise<void>
  /** 그룹 전체 삭제 (멤버들도 cascade 로) */
  removeGroup: (groupId: string) => Promise<void>
  /** 신청자가 본인 신청서 내용 수정 + 상태 PENDING 재설정 */
  updateApplication: (id: string, draft: TransferDraft) => Promise<boolean>
  /** 게스트가 UID 로 본인 신청 조회 (anon RPC 호출). inGameName 은 더 이상 사용 안 함 (호환용) */
  lookupByCredentials: (uid: string) => Promise<TransferApplication[]>
}

export const useTransferStore = create<TransferStore>((set, get) => ({
  apps: [],
  groups: [],
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
      total_power: draft.totalPower.trim(),
      note: draft.note.trim(),
      tier_id: draft.tierId,
      desired_alliance: draft.desiredAlliance,
      desired_alliance_other: draft.desiredAllianceOther.trim(),
    })
    if (error) {
      console.error('transfer submit error', error)
      toast.error('신청 중 오류가 발생했습니다.')
      return false
    }
    return true
  },

  submitGroup: async (draft) => {
    const leaderName = draft.leaderName.trim()
    if (!leaderName) {
      toast.error('대표자 인게임명을 입력해주세요.')
      return null
    }
    if (draft.members.length === 0) {
      toast.error('최소 1명 이상의 멤버 정보가 필요합니다.')
      return null
    }
    // 멤버 데이터를 jsonb 로 변환 (서버 RPC 가 jsonb 받음)
    const membersPayload = draft.members.map((m) => ({
      in_game_name: m.inGameName.trim(),
      uid: m.uid.trim(),
      current_server: m.currentServer.trim(),
      country: m.country.trim(),
      cp: m.cp.trim(),
      total_power: m.totalPower.trim(),
      note: m.note.trim(),
      tier_id: m.tierId ?? null,
    }))

    try {
      const res = await withTimeout(
        Promise.resolve(
          supabase.rpc('submit_transfer_group', {
            p_leader_name: leaderName,
            p_leader_uid: draft.leaderUid.trim(),
            p_leader_contact: draft.leaderContact.trim(),
            p_desired_alliance: draft.desiredAlliance,
            p_desired_alliance_other: draft.desiredAllianceOther.trim(),
            p_members: membersPayload,
          }),
        ),
        10000,
      )
      if (res.error) {
        console.error('submit_transfer_group error', res.error)
        toast.error('단체 신청 중 오류가 발생했습니다.')
        return null
      }
      return res.data as string
    } catch (err) {
      console.error('submit_transfer_group timeout', err)
      toast.error('신청 시간 초과. 다시 시도해주세요.')
      return null
    }
  },

  loadAll: async (force = false) => {
    if (!force && get().initialized) return
    set({ loading: true })
    try {
      const [appsRes, groupsRes] = await Promise.all([
        supabase
          .from('transfer_applications')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('application_groups')
          .select('*')
          .order('created_at', { ascending: false }),
      ])
      if (appsRes.error) throw appsRes.error
      if (groupsRes.error) throw groupsRes.error
      set({
        apps: (appsRes.data ?? []).map(toApp),
        groups: (groupsRes.data ?? []).map(toGroup),
        initialized: true,
      })
    } catch (err) {
      console.error('transfer load error', err)
    } finally {
      set({ loading: false })
    }
  },

  loadPublic: async (force = false) => {
    if (!force && get().initialized) return
    set({ loading: true })
    try {
      // RLS 가 status IN (PENDING, APPROVED) 만 허용 — 거절은 자동 필터링됨
      const [appsRes, groupsRes] = await Promise.all([
        supabase
          .from('transfer_applications')
          .select('id, in_game_name, uid, current_server, country, cp, total_power, tier_id, status, group_id, desired_alliance, desired_alliance_other, created_at')
          .order('created_at', { ascending: false }),
        supabase
          .from('application_groups')
          .select('*')
          .order('created_at', { ascending: false }),
      ])
      if (appsRes.error) throw appsRes.error
      if (groupsRes.error) throw groupsRes.error
      // 공개 조회용이라 admin_message / reviewed_* 는 비워둠
      const apps: TransferApplication[] = (appsRes.data ?? []).map((r) => ({
        ...toApp(r),
        adminMessage: '',
        reviewedAt: null,
        reviewedBy: null,
      }))
      set({
        apps,
        groups: (groupsRes.data ?? []).map(toGroup),
        initialized: true,
      })
    } catch (err) {
      console.error('transfer loadPublic error', err)
    } finally {
      set({ loading: false })
    }
  },

  removeGroup: async (groupId) => {
    // ON DELETE CASCADE 라 그룹 삭제 시 자식 신청도 함께 삭제됨
    const { error } = await supabase.from('application_groups').delete().eq('id', groupId)
    if (error) {
      console.error('group delete error', error)
      toast.error('그룹 삭제 중 오류가 발생했습니다.')
      return
    }
    set((s) => ({
      groups: s.groups.filter((g) => g.id !== groupId),
      apps: s.apps.filter((a) => a.groupId !== groupId),
    }))
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

  updateGroupStatus: async (groupId, status, reviewerId) => {
    const now = new Date().toISOString()
    const { error } = await supabase
      .from('transfer_applications')
      .update({ status, reviewed_at: now, reviewed_by: reviewerId })
      .eq('group_id', groupId)
    if (error) {
      console.error('transfer group update error', error)
      toast.error('그룹 상태 변경 중 오류가 발생했습니다.')
      return
    }
    set((s) => ({
      apps: s.apps.map((a) =>
        a.groupId === groupId
          ? { ...a, status, reviewedAt: now, reviewedBy: reviewerId }
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
        total_power: draft.totalPower.trim(),
        note: draft.note.trim(),
        tier_id: draft.tierId,
        desired_alliance: draft.desiredAlliance,
        desired_alliance_other: draft.desiredAllianceOther.trim(),
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
