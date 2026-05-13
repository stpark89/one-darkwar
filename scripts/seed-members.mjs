import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const mockData = JSON.parse(readFileSync(join(__dirname, '../src/infrastructure/mockData.json'), 'utf-8'))

// .env.local 에서 환경변수 읽기
const envFile = readFileSync(join(__dirname, '../.env.local'), 'utf-8')
const env = Object.fromEntries(
  envFile.split('\n')
    .filter(l => l.includes('='))
    .map(l => l.replace(/"/g, '').split('=').map(s => s.trim()))
)

const supabase = createClient(
  env['VITE_PUBLIC_SUPABASE_URL'],
  env['VITE_PUBLIC_SUPABASE_ANON_KEY']
)

const rows = mockData.members.map(m => ({
  in_game_name: m.inGameName,
  zalo_name: m.zaloName ?? '',
  cp: m.cp ?? '',
  house_level: m.houseLevel ?? '',
  note: m.note ?? '',
}))

const { data, error } = await supabase.from('members').insert(rows).select()

if (error) {
  console.error('❌ 오류:', error.message)
} else {
  console.log(`✅ ${data.length}명 삽입 완료`)
}
