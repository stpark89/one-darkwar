import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const mockData = JSON.parse(readFileSync(join(__dirname, '../src/infrastructure/mockData.json'), 'utf-8'))
const envFile = readFileSync(join(__dirname, '../.env.local'), 'utf-8')
const env = Object.fromEntries(
  envFile.split('\n').filter(l => l.includes('=')).map(l => l.replace(/"/g, '').split('=').map(s => s.trim()))
)

const supabase = createClient(env['VITE_PUBLIC_SUPABASE_URL'], env['VITE_PUBLIC_SUPABASE_ANON_KEY'])

// 1. 이벤트 삽입 (old eventKey → new UUID 매핑)
const eventKeyToId = {}
for (const e of mockData.events) {
  const { data, error } = await supabase
    .from('events')
    .insert({ name: e.name, event_date: e.date || null })
    .select().single()
  if (error) { console.error('❌ 이벤트 삽입 오류:', error.message); continue }
  eventKeyToId[e.eventKey] = data.id
}
console.log(`✅ 이벤트 삽입: ${Object.keys(eventKeyToId).length}개`)

// 2. members UUID 로드
const { data: members } = await supabase.from('members').select('id, in_game_name')
const memberMap = Object.fromEntries(members.map(m => [m.in_game_name, m.id]))

// 3. attendance 삽입 (CT/DB 상태인 것만)
const entries = []
for (const a of mockData.attendance) {
  const memberId = memberMap[a.inGameName]
  if (!memberId) continue
  for (const [eventKey, status] of Object.entries(a.records)) {
    if (status === 'CT' || status === 'DB') {
      const eventId = eventKeyToId[eventKey]
      if (eventId) entries.push({ member_id: memberId, event_id: eventId, status })
    }
  }
}

const { data: inserted, error } = await supabase.from('attendance').insert(entries).select()
if (error) console.error('❌ 오류:', error.message)
else console.log(`✅ 출석 기록 삽입: ${inserted.length}개`)
