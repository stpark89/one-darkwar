import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { EventSession, EventAttendance, AttendanceStatus } from '@/domain/entities/Event'

interface EventStore {
  events: EventSession[]
  attendance: EventAttendance[]
  loading: boolean
  searchQuery: string

  loadData: () => Promise<void>
  addEvent: (name: string, date: string) => Promise<void>
  updateStatus: (memberId: string, eventKey: string, status: AttendanceStatus) => Promise<void>
  setSearchQuery: (q: string) => void
  getFiltered: () => EventAttendance[]
  getSummary: () => { memberId: string; inGameName: string; total: number; ct: number; db: number }[]
}

export const useEventStore = create<EventStore>((set, get) => ({
  events: [],
  attendance: [],
  loading: false,
  searchQuery: '',

  loadData: async () => {
    set({ loading: true })

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

    set({ events, attendance, loading: false })
  },

  addEvent: async (name, date) => {
    const { data } = await supabase
      .from('events')
      .insert({ name, event_date: date || null })
      .select()
      .single()
    if (!data) return

    const newEvent: EventSession = { id: data.id, eventKey: data.id, name, date: date ?? '' }
    set((s) => ({
      events: [...s.events, newEvent],
      attendance: s.attendance.map((a) => ({
        ...a,
        records: { ...a.records, [data.id]: '' },
      })),
    }))
  },

  updateStatus: async (memberId, eventKey, status) => {
    // 낙관적 업데이트 (즉시 UI 반영)
    set((s) => ({
      attendance: s.attendance.map((a) =>
        a.memberId === memberId ? { ...a, records: { ...a.records, [eventKey]: status } } : a,
      ),
    }))

    if (status === '') {
      await supabase.from('attendance').delete().eq('member_id', memberId).eq('event_id', eventKey)
    } else {
      await supabase
        .from('attendance')
        .upsert({ member_id: memberId, event_id: eventKey, status }, { onConflict: 'member_id,event_id' })
    }
  },

  setSearchQuery: (searchQuery) => set({ searchQuery }),

  getFiltered: () => {
    const { attendance, searchQuery } = get()
    if (!searchQuery) return attendance
    const q = searchQuery.toLowerCase()
    return attendance.filter((a) => a.inGameName.toLowerCase().includes(q))
  },

  getSummary: () => {
    const { attendance } = get()
    return attendance
      .map((a) => {
        const values = Object.values(a.records)
        const ct = values.filter((v) => v === 'CT').length
        const db = values.filter((v) => v === 'DB').length
        return { memberId: a.memberId, inGameName: a.inGameName, ct, db, total: ct + db }
      })
      .sort((a, b) => b.total - a.total)
  },
}))
