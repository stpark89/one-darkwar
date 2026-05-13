import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from '@/presentation/components/Layout'
import { MembersPage } from '@/presentation/pages/MembersPage'
import { WarPage } from '@/presentation/pages/WarPage'
import { EventsPage } from '@/presentation/pages/EventsPage'
import { ExcelPage } from '@/presentation/pages/ExcelPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/members" replace />} />
          <Route path="/members" element={<MembersPage />} />
          <Route path="/war" element={<WarPage />} />
          <Route path="/events" element={<EventsPage />} />
          <Route path="/excel" element={<ExcelPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
