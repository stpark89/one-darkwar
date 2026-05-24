export interface GuestQuestion {
  id: string
  authorName: string
  title: string
  content: string
  createdAt: string
  answers: GuestAnswer[]
}

export interface GuestAnswer {
  id: string
  questionId: string
  authorId: string | null
  authorName: string
  content: string
  createdAt: string
}

export interface GuestQuestionDraft {
  authorName: string
  title: string
  content: string
}
