import { create } from 'zustand'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { EventSession, EventAttendance, AttendanceStatus } from '@/domain/entities/Event'

interface EventStore {
  events: EventSession[]
  attendance: EventAttendance[]
  loading: boolean
  searchQuery: string
  showHidden: boolean

  loadData: () => Promise<void>
  addEvent: (name: string, date: string) => Promise<void>
  deleteEvent: (eventId: string) => Promise<void>
  toggleHidden: (eventId: string) => Promise<void>
  toggleShowHidden: () => void
  updateStatus: (memberId: string, eventKey: string, status: AttendanceStatus) => Promise<void>
  bulkUpdateEvent: (eventKey: string, updates: { memberId: string; status: AttendanceStatus }[]) => Promise<void>
  bulkUpdateMember: (memberId: string, updates: { eventKey: string; status: AttendanceStatus }[]) => Promise<void>
  batchSave: (changes: { memberId: string; eventKey: string; status: AttendanceStatus }[]) => Promise<boolean>
  syncMemberName: (memberId: string, newName: string) => void
  setSearchQuery: (q: string) => void
  getFiltered: () => EventAttendance[]
  getSummary: () => { memberId: string; inGameName: string; total: number; ct: number; db: number }[]
}

export const useEventStore = create<EventStore>((set, get) => ({
  events: [],
  attendance: [],
  loading: false,
  searchQuery: '',
  showHidden: false,

  loadData: async () => {
    set({ loading: true })
    try {
      const [{ data: eventRows }, { data: memberRows }, { data: attRows }] = await Promise.all([
        supabase.from('events').select('*').order('created_at'),
        supabase.from('members').select('id, in_game_name'),
        supabase.from('attendance').select('*'),
      ])

      const events: EventSession[] = (eventRows ?? []).map((r) => ({
        id: r.id,
        eventKey: r.id,
        name: r.name,
        date: r.event_date ?? '',
        hidden: r.hidden ?? false,
      }))

      const attendance: EventAttendance[] = (memberRows ?? []).map((m) => ({
        memberId: m.id,
        inGameName: m.in_game_name,
        records: Object.fromEntries(
          events.map((e) => {
            const row = (attRows ?? []).find((a) => a.member_id === m.id && a.event_id === e.id)
            return [e.eventKey, (row?.status ?? '') as AttendanceStatus]
          }),
        ),
      }))

      set({ events, attendance })
    } catch (err) {
      console.error('[eventStore] loadData exception:', err)
    } finally {
      set({ loading: false })
    }
  },

  addEvent: async (name, date) => {
    const { data } = await supabase
      .from('events')
      .insert({ name, event_date: date || null })
      .select()
      .single()
    if (!data) return

    const newEvent: EventSession = { id: data.id, eventKey: data.id, name, date: date ?? '', hidden: false }
    set((s) => ({
      events: [...s.events, newEvent],
      attendance: s.attendance.map((a) => ({
        ...a,
        records: { ...a.records, [data.id]: '' },
      })),
    }))
  },

  deleteEvent: async (eventId) => {
    // attendance rows는 DB cascade로 자동 삭제
    await supabase.from('events').delete().eq('id', eventId)
    set(s => ({
      events: s.events.filter(e => e.id !== eventId),
      attendance: s.attendance.map(a => {
        const records = { ...a.records }
        delete records[eventId]
        return { ...a, records }
      }),
    }))
  },

  toggleHidden: async (eventId) => {
    const event = get().events.find(e => e.id === eventId)
    if (!event) return
    const hidden = !event.hidden
    await supabase.from('events').update({ hidden }).eq('id', eventId)
    set(s => ({ events: s.events.map(e => e.id === eventId ? { ...e, hidden } : e) }))
  },

  toggleShowHidden: () => set(s => ({ showHidden: !s.showHidden })),

  updateStatus: async (memberId, eventKey, status) => {
    // 롤백용 스냅샷
    const prev = get().attendance
    // 낙관적 업데이트
    set((s) => ({
      attendance: s.attendance.map((a) =>
        a.memberId === memberId ? { ...a, records: { ...a.records, [eventKey]: status } } : a,
      ),
    }))

    let failed = false
    if (status === '') {
      const res = await supabase.from('attendance').delete().eq('member_id', memberId).eq('event_id', eventKey)
      if (res.error) { console.error('[updateStatus delete]', res.error); failed = true }
    } else {
      const res = await supabase
        .from('attendance')
        .upsert({ member_id: memberId, event_id: eventKey, status }, { onConflict: 'member_id,event_id' })
        .select()
      if (res.error) { console.error('[updateStatus upsert]', res.error); failed = true }
      // RLS 무음 차단: error 없이 data가 빈 배열이면 실제로 저장 안 된 것
      else if (!res.data || res.data.length === 0) { console.warn('[updateStatus] RLS blocked — no rows affected'); failed = true }
    }

    if (failed) {
      set({ attendance: prev })
      toast.error('출석 저장 실패 — Supabase 콘솔에서 RLS 정책을 확인하세요.')
    }
  },

  bulkUpdateEvent: async (eventKey, updates) => {
    const prev = get().attendance
    // 낙관적 업데이트
    set((s) => ({
      attendance: s.attendance.map((a) => {
        const u = updates.find((x) => x.memberId === a.memberId)
        if (!u) return a
        return { ...a, records: { ...a.records, [eventKey]: u.status } }
      }),
    }))

    const toUpsert = updates.filter((u) => u.status !== '')
    const toDelete = updates.filter((u) => u.status === '')
    const errors: unknown[] = []

    if (toUpsert.length > 0) {
      const res = await supabase.from('attendance').upsert(
        toUpsert.map((u) => ({ member_id: u.memberId, event_id: eventKey, status: u.status })),
        { onConflict: 'member_id,event_id' },
      )
      if (res.error) errors.push(res.error)
    }
    if (toDelete.length > 0) {
      const res = await supabase.from('attendance')
        .delete()
        .eq('event_id', eventKey)
        .in('member_id', toDelete.map((u) => u.memberId))
      if (res.error) errors.push(res.error)
    }

    if (errors.length > 0) {
      set({ attendance: prev })
      const msg = (errors[0] as { message?: string }).message ?? '저장 실패'
      console.error('[bulkUpdateEvent]', errors)
      toast.error(`일괄 저장 실패: ${msg}`)
    }
  },

  bulkUpdateMember: async (memberId, updates) => {
    const prev = get().attendance
    // 낙관적 업데이트
    set((s) => ({
      attendance: s.attendance.map((a) => {
        if (a.memberId !== memberId) return a
        const newRecords = { ...a.records }
        updates.forEach((u) => { newRecords[u.eventKey] = u.status })
        return { ...a, records: newRecords }
      }),
    }))

    const toUpsert = updates.filter((u) => u.status !== '')
    const toDelete = updates.filter((u) => u.status === '')
    const errors: unknown[] = []

    if (toUpsert.length > 0) {
      const res = await supabase.from('attendance').upsert(
        toUpsert.map((u) => ({ member_id: memberId, event_id: u.eventKey, status: u.status })),
        { onConflict: 'member_id,event_id' },
      )
      if (res.error) errors.push(res.error)
    }
    if (toDelete.length > 0) {
      const res = await supabase.from('attendance')
        .delete()
        .eq('member_id', memberId)
        .in('event_id', toDelete.map((u) => u.eventKey))
      if (res.error) errors.push(res.error)
    }

    if (errors.length > 0) {
      set({ attendance: prev })
      const msg = (errors[0] as { message?: string }).message ?? '저장 실패'
      console.error('[bulkUpdateMember]', errors)
      toast.error(`일괄 저장 실패: ${msg}`)
    }
  },

  batchSave: async (changes) => {
    const prev = get().attendance
    // 낙관적 업데이트
    set((s) => ({
      attendance: s.attendance.map((a) => {
        const mine = changes.filter((c) => c.memberId === a.memberId)
        if (mine.length === 0) return a
        const newRecords = { ...a.records }
        mine.forEach((c) => { newRecords[c.eventKey] = c.status })
        return { ...a, records: newRecords }
      }),
    }))

    const toUpsert = changes.filter((c) => c.status !== '')
    const toDelete = changes.filter((c) => c.status === '')
    const errors: unknown[] = []

    if (toUpsert.length > 0) {
      const res = await supabase
        .from('attendance')
        .upsert(
          toUpsert.map((c) => ({ member_id: c.memberId, event_id: c.eventKey, status: c.status })),
          { onConflict: 'member_id,event_id' },
        )
        .select()
      if (res.error) errors.push(res.error)
    }
    if (toDelete.length > 0) {
      const results = await Promise.all(
        toDelete.map((c) =>
          supabase.from('attendance').delete().eq('member_id', c.memberId).eq('event_id', c.eventKey),
        ),
      )
      results.forEach((r) => { if (r.error) errors.push(r.error) })
    }

    if (errors.length > 0) {
      set({ attendance: prev })
      const msg = (errors[0] as { message?: string }).message ?? '저장 실패'
      console.error('[batchSave]', errors)
      toast.error(`저장 실패: ${msg}`)
      return false
    }
    toast.success('저장되었습니다.')
    return true
  },

  syncMemberName: (memberId, newName) =>
    set(s => ({ attendance: s.attendance.map(a => a.memberId === memberId ? { ...a, inGameName: newName } : a) })),

  setSearchQuery: (searchQuery) => set({ searchQuery }),

  getFiltered: () => {
    const { attendance, searchQuery } = get()
    if (!searchQuery) return attendance
    const q = searchQuery.toLowerCase()
    return attendance.filter((a) => a.inGameName.toLowerCase().includes(q))
  },

  getSummary: () => {
    const { attendance, events, showHidden } = get()
    const visibleKeys = new Set(events.filter(e => showHidden || !e.hidden).map(e => e.eventKey))
    return attendance
      .map((a) => {
        const ct = Object.entries(a.records).filter(([k, v]) => visibleKeys.has(k) && v === 'CT').length
        const db = Object.entries(a.records).filter(([k, v]) => visibleKeys.has(k) && v === 'DB').length
        return { memberId: a.memberId, inGameName: a.inGameName, ct, db, total: ct + db }
      })
      .sort((a, b) => b.total - a.total)
  },
}))
