import { create } from 'zustand'
import type { EventSession, EventAttendance, AttendanceStatus } from '@/domain/entities/Event'
import mockData from '../mockData.json'

interface EventStore {
  events: EventSession[]
  attendance: EventAttendance[]
  searchQuery: string

  setEvents: (events: EventSession[]) => void
  setAttendance: (attendance: EventAttendance[]) => void
  addEvent: (name: string, date: string) => void
  updateStatus: (memberId: string, eventKey: string, status: AttendanceStatus) => void
  setSearchQuery: (q: string) => void
  syncMembers: (members: { id: string; inGameName: string }[]) => void
  getFiltered: () => EventAttendance[]
  getSummary: () => { memberId: string; inGameName: string; total: number; ct: number; db: number }[]
}

export const useEventStore = create<EventStore>((set, get) => ({
  events: mockData.events as EventSession[],
  attendance: mockData.attendance as EventAttendance[],
  searchQuery: '',

  setEvents: (events) => set({ events }),
  setAttendance: (attendance) => set({ attendance }),

  addEvent: (name, date) => {
    const { events, attendance } = get()
    const eventKey = `e_${Date.now()}`
    const newEvent: EventSession = { id: eventKey, eventKey, date, name }
    set({
      events: [...events, newEvent],
      attendance: attendance.map((a) => ({
        ...a,
        records: { ...a.records, [eventKey]: '' },
      })),
    })
  },

  updateStatus: (memberId, eventKey, status) => {
    set((s) => ({
      attendance: s.attendance.map((a) =>
        a.memberId === memberId
          ? { ...a, records: { ...a.records, [eventKey]: status } }
          : a,
      ),
    }))
  },

  setSearchQuery: (searchQuery) => set({ searchQuery }),

  syncMembers: (members) => {
    const { attendance, events } = get()
    const existingIds = new Set(attendance.map((a) => a.memberId))
    const newRows: EventAttendance[] = members
      .filter((m) => !existingIds.has(m.id))
      .map((m) => ({
        memberId: m.id,
        inGameName: m.inGameName,
        records: Object.fromEntries(events.map((e) => [e.eventKey, ''])),
      }))
    if (newRows.length > 0) {
      set({ attendance: [...attendance, ...newRows] })
    }
  },

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
