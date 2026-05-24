// SVG → PNG 변환기. public/icon-source.svg 를 다양한 크기로 생성합니다.
// 실행: node scripts/generate-icons.mjs
import sharp from 'sharp'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const src = resolve(root, 'public/icon-source.svg')
const svg = readFileSync(src)

const targets = [
  { size: 512, name: 'icon-512.png' },
  { size: 192, name: 'icon-192.png' },
  { size: 180, name: 'apple-touch-icon.png' },
  { size: 64, name: 'favicon.png' },
]

for (const { size, name } of targets) {
  const out = resolve(root, 'public', name)
  await sharp(svg)
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(out)
  console.log(`✓ ${name} (${size}×${size})`)
}
