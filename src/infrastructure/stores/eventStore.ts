import { create } from 'zustand'
import type { EventSession, EventAttendance, AttendanceStatus } from '@/domain/entities/Event'
import mockData from '../mockData.json'

interface EventStore {
  events: EventSession[]
  attendance: EventAttendance[]
  searchQuery: string

  setEvents: (events: EventSession[]) => void
  setAttendance: (attendance: EventAttendance[]) => void
  updateStatus: (memberId: string, eventKey: string, status: AttendanceStatus) => void
  setSearchQuery: (q: string) => void
  getFiltered: () => EventAttendance[]
  getSummary: () => { memberId: string; inGameName: string; total: number; online: number }[]
}

export const useEventStore = create<EventStore>((set, get) => ({
  events: mockData.events as EventSession[],
  attendance: mockData.attendance as EventAttendance[],
  searchQuery: '',

  setEvents: (events) => set({ events }),
  setAttendance: (attendance) => set({ attendance }),

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

  getFiltered: () => {
    const { attendance, searchQuery } = get()
    if (!searchQuery) return attendance
    const q = searchQuery.toLowerCase()
    return attendance.filter((a) => a.inGameName.toLowerCase().includes(q))
  },

  getSummary: () => {
    const { attendance } = get()
    return attendance.map((a) => {
      const values = Object.values(a.records)
      return {
        memberId: a.memberId,
        inGameName: a.inGameName,
        total: values.filter((v) => v === 'X').length,
        online: values.filter((v) => v === 'O').length,
      }
    }).sort((a, b) => b.total - a.total)
  },
}))
