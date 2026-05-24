// 원본 이미지 → 다양한 크기 PNG 변환기.
// 우선순위: public/bunny-source.png > public/icon-source.svg
// 실행: node scripts/generate-icons.mjs  (또는 npm run icons)
import sharp from 'sharp'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const PNG_SRC = resolve(root, 'public/bunny-source.png')
const SVG_SRC = resolve(root, 'public/icon-source.svg')

let src
let label
if (existsSync(PNG_SRC)) {
  src = readFileSync(PNG_SRC)
  label = 'bunny-source.png'
} else if (existsSync(SVG_SRC)) {
  src = readFileSync(SVG_SRC)
  label = 'icon-source.svg'
} else {
  console.error('❌ 원본 이미지가 없습니다: public/bunny-source.png 또는 public/icon-source.svg')
  process.exit(1)
}
console.log(`📷 원본: ${label}`)

// 모든 아이콘 패딩을 앱 다크 테마(#0f1115)로 통일.
// splash screen 배경(manifest.background_color)과 같은 색이라 아이콘
// 외곽이 splash 와 자연스럽게 융합됨.
const BG = { r: 15, g: 17, b: 21, alpha: 1 }
const MASKABLE_BG = { r: 15, g: 17, b: 21, alpha: 1 }

// 일반 아이콘 (purpose: any) — 정사각형에 흰색 배경, 토끼 풀로 차게
const targets = [
  { size: 512, name: 'icon-512.png' },
  { size: 192, name: 'icon-192.png' },
  { size: 180, name: 'apple-touch-icon.png' },
  { size: 64, name: 'favicon.png' },
]

for (const { size, name } of targets) {
  const out = resolve(root, 'public', name)
  await sharp(src)
    .resize(size, size, { fit: 'contain', background: BG })
    .flatten({ background: BG })
    .png({ compressionLevel: 9 })
    .toFile(out)
  console.log(`✓ ${name} (${size}×${size})`)
}

// maskable 아이콘 — Android adaptive icon 가운데 80% 안전 영역 안에 토끼가
// 들어가도록 패딩. 외곽 10% 는 OS 가 잘라낼 영역이라 다크 테마 색.
const maskables = [
  { size: 512, name: 'icon-maskable-512.png' },
  { size: 192, name: 'icon-maskable-192.png' },
]

for (const { size, name } of maskables) {
  const inner = Math.floor(size * 0.8)
  const pad = Math.floor((size - inner) / 2)
  const out = resolve(root, 'public', name)
  await sharp(src)
    .resize(inner, inner, { fit: 'contain', background: MASKABLE_BG })
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: MASKABLE_BG })
    .flatten({ background: MASKABLE_BG })
    .png({ compressionLevel: 9 })
    .toFile(out)
  console.log(`✓ ${name} (${size}×${size}, maskable)`)
}
