import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Menu, Swords } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { cn } from '@/lib/utils'

export const Layout = () => {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex min-h-screen">
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((v) => !v)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <main
        className={cn(
          'flex-1 min-h-screen bg-[var(--color-bg-base)] transition-all duration-200',
          'ml-0',
          collapsed ? 'md:ml-14' : 'md:ml-56',
        )}
      >
        {/* 모바일 상단 헤더 */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-[var(--color-bg-surface)] border-b border-[var(--color-border-subtle)] sticky top-0 z-20">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-primary)]"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-[var(--color-brand)] flex items-center justify-center">
              <Swords className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-bold text-[var(--color-text-primary)]">ONE DARK WAR</span>
          </div>
        </div>

        <Outlet />
      </main>
    </div>
  )
}
