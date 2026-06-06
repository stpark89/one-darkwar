export interface Alliance {
  id: string
  name: string
  tag: string
  recruiting: boolean
  contact: string
  note: string
  isHome: boolean
  sortOrder: number
  createdAt: string
}

export interface AllianceDraft {
  name: string
  tag: string
  recruiting: boolean
  contact: string
  note: string
  isHome: boolean
  sortOrder: number
}
