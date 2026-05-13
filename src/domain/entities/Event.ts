export type AttendanceStatus = 'CT' | 'DB' | ''  // CT=공식, DB=예비, ''=불참

export interface EventAttendance {
  memberId: string
  inGameName: string
  records: Record<string, AttendanceStatus>  // eventKey → status
}

export interface EventSession {
  id: string
  eventKey: string   // 고유 키 (날짜+이름)
  date: string
  name: string       // 예: "OASIS 3"
}
