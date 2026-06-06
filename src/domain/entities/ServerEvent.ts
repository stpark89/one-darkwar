export type EventCategory = 'siege' | 'armory' | 'event' | 'other'

export interface ServerEvent {
  id: string
  title: string
  eventAt: string // ISO timestamp
  category: EventCategory
  note: string
  createdAt: string
}

export interface ServerEventDraft {
  title: string
  eventAt: string // ISO timestamp
  category: EventCategory
  note: string
}
