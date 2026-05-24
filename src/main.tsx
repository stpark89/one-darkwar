import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n'
import App from './App.tsx'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      // 새 SW 가 발견되어 활성화 단계로 진입하면 즉시 한 번 reload.
      // (옛 HTML/JS 메모리 잔여물 제거)
      reg.addEventListener('updatefound', () => {
        const next = reg.installing
        if (!next) return
        next.addEventListener('statechange', () => {
          if (next.state === 'activated') {
            // 무한 reload 방지를 위해 sessionStorage 플래그로 한 번만 실행
            if (!sessionStorage.getItem('odw_sw_reloaded')) {
              sessionStorage.setItem('odw_sw_reloaded', '1')
              window.location.reload()
            }
          }
        })
      })
    }).catch((err) => {
      console.warn('SW 등록 실패:', err)
    })
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
