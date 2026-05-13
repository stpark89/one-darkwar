import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'

export const Layout = () => (
  <div className="flex min-h-screen">
    <Sidebar />
    <main className="flex-1 ml-56 min-h-screen bg-[var(--color-bg-base)]">
      <Outlet />
    </main>
  </div>
)
