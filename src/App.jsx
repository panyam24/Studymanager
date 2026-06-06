import { useState } from 'react'
import { useAuthStore } from './store'
import AuthPage from './pages/AuthPage'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import SubjectsPage from './pages/SubjectsPage'
import AssignmentsPage from './pages/AssignmentsPage'
import TimetablePage from './pages/TimetablePage'
import GradesPage from './pages/GradesPage'
import NotesPage from './pages/NotesPage'
import GoalsPage from './pages/GoalsPage'
import AttendancePage from './pages/AttendancePage'

const PAGES = {
  dashboard:  Dashboard,
  subjects:   SubjectsPage,
  attendance: AttendancePage,
  assignments: AssignmentsPage,
  timetable:  TimetablePage,
  grades:     GradesPage,
  notes:      NotesPage,
  goals:      GoalsPage,
}

export default function App() {
  const { currentUser } = useAuthStore()
  const [active, setActive] = useState('dashboard')

  if (!currentUser) return <AuthPage />

  const Page = PAGES[active] || Dashboard

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar active={active} setActive={setActive} />
      <main style={{ flex: 1, overflowY: 'auto', minWidth: 0 }}>
        <Page setActive={setActive} />
      </main>
    </div>
  )
}
