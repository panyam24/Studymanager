import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// ── Simple hash (not cryptographic, but better than plaintext) ───────────────
const hashPassword = (pw) => {
  let hash = 0
  for (let i = 0; i < pw.length; i++) {
    const char = pw.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  return hash.toString(36) + '_' + pw.length
}

// ── Auth store ──────────────────────────────────────────────────────────────
export const useAuthStore = create(
  persist(
    (set, get) => ({
      users: [],          // [{id, name, email, passwordHash, avatar, createdAt}]
      currentUser: null,
      resetTokens: {},    // { email: { token, expiresAt } }

      register: (name, email, password) => {
        const users = get().users
        if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
          return { ok: false, error: 'Email already registered' }
        }
        if (password.length < 6) {
          return { ok: false, error: 'Password must be at least 6 characters' }
        }
        const user = {
          id: crypto.randomUUID(),
          name: name.trim(),
          email: email.toLowerCase().trim(),
          passwordHash: hashPassword(password),
          avatar: name.trim()[0].toUpperCase(),
          createdAt: new Date().toISOString(),
        }
        const safeUser = { ...user }
        delete safeUser.passwordHash
        set({ users: [...users, user], currentUser: safeUser })
        return { ok: true }
      },

      login: (email, password) => {
        const user = get().users.find(
          u => u.email.toLowerCase() === email.toLowerCase().trim() &&
               u.passwordHash === hashPassword(password)
        )
        if (!user) return { ok: false, error: 'Invalid email or password' }
        const safeUser = { ...user }
        delete safeUser.passwordHash
        set({ currentUser: safeUser })
        return { ok: true }
      },

      logout: () => set({ currentUser: null }),

      updateProfile: (updates) => {
        const curr = get().currentUser
        const updated = { ...curr, ...updates }
        if (updates.password) {
          const userRecord = get().users.find(u => u.id === curr.id)
          const fullUpdated = { ...userRecord, passwordHash: hashPassword(updates.password) }
          delete updated.password
          set(s => ({
            currentUser: updated,
            users: s.users.map(u => u.id === curr.id ? fullUpdated : u)
          }))
        } else {
          set(s => ({
            currentUser: updated,
            users: s.users.map(u => u.id === curr.id ? { ...u, ...updates } : u)
          }))
        }
      },

      // Password reset (simulated — token shown in UI since no email server)
      requestPasswordReset: (email) => {
        const user = get().users.find(u => u.email.toLowerCase() === email.toLowerCase().trim())
        if (!user) return { ok: false, error: 'No account found with that email' }
        const token = Math.random().toString(36).slice(2, 8).toUpperCase()
        const expiresAt = Date.now() + 15 * 60 * 1000 // 15 min
        set(s => ({ resetTokens: { ...s.resetTokens, [email.toLowerCase()]: { token, expiresAt } } }))
        return { ok: true, token } // In real app, this would email the token
      },

      resetPassword: (email, token, newPassword) => {
        const emailKey = email.toLowerCase().trim()
        const stored = get().resetTokens[emailKey]
        if (!stored) return { ok: false, error: 'No reset request found' }
        if (stored.token !== token.toUpperCase()) return { ok: false, error: 'Invalid token' }
        if (Date.now() > stored.expiresAt) return { ok: false, error: 'Token expired' }
        if (newPassword.length < 6) return { ok: false, error: 'Password must be at least 6 characters' }
        set(s => ({
          users: s.users.map(u =>
            u.email.toLowerCase() === emailKey
              ? { ...u, passwordHash: hashPassword(newPassword) }
              : u
          ),
          resetTokens: Object.fromEntries(
            Object.entries(s.resetTokens).filter(([k]) => k !== emailKey)
          )
        }))
        return { ok: true }
      },
    }),
    { name: 'studysync-auth' }
  )
)

// ── App store ───────────────────────────────────────────────────────────────
const initialData = () => ({
  subjects: [],
  assignments: [],
  timetable: [],
  grades: [],
  notes: [],
  goals: [],
  // Attendance: [{id, subjectId, userId, date (YYYY-MM-DD), status ('present'|'absent'|'late'), note}]
  attendance: [],
})

export const useAppStore = create(
  persist(
    (set, get) => ({
      ...initialData(),

      forUser: (list, userId) => list.filter(i => i.userId === userId),

      // ── Subjects ──
      addSubject: (data, userId) => {
        const s = { id: crypto.randomUUID(), userId, ...data }
        set(st => ({ subjects: [...st.subjects, s] }))
        return s
      },
      updateSubject: (id, data) =>
        set(st => ({ subjects: st.subjects.map(s => s.id === id ? { ...s, ...data } : s) })),
      deleteSubject: (id) =>
        set(st => ({
          subjects: st.subjects.filter(s => s.id !== id),
          assignments: st.assignments.filter(a => a.subjectId !== id),
          timetable: st.timetable.filter(t => t.subjectId !== id),
          grades: st.grades.filter(g => g.subjectId !== id),
          notes: st.notes.filter(n => n.subjectId !== id),
          attendance: st.attendance.filter(a => a.subjectId !== id),
        })),

      // ── Assignments ──
      addAssignment: (data, userId) =>
        set(st => ({ assignments: [...st.assignments, { id: crypto.randomUUID(), userId, status: 'pending', ...data }] })),
      updateAssignment: (id, data) =>
        set(st => ({ assignments: st.assignments.map(a => a.id === id ? { ...a, ...data } : a) })),
      deleteAssignment: (id) =>
        set(st => ({ assignments: st.assignments.filter(a => a.id !== id) })),

      // ── Timetable ──
      addSlot: (data, userId) =>
        set(st => ({ timetable: [...st.timetable, { id: crypto.randomUUID(), userId, ...data }] })),
      updateSlot: (id, data) =>
        set(st => ({ timetable: st.timetable.map(s => s.id === id ? { ...s, ...data } : s) })),
      deleteSlot: (id) =>
        set(st => ({ timetable: st.timetable.filter(s => s.id !== id) })),

      // ── Grades ──
      addGrade: (data, userId) =>
        set(st => ({ grades: [...st.grades, { id: crypto.randomUUID(), userId, ...data }] })),
      updateGrade: (id, data) =>
        set(st => ({ grades: st.grades.map(g => g.id === id ? { ...g, ...data } : g) })),
      deleteGrade: (id) =>
        set(st => ({ grades: st.grades.filter(g => g.id !== id) })),

      // ── Notes ──
      addNote: (data, userId) =>
        set(st => ({ notes: [...st.notes, { id: crypto.randomUUID(), userId, updatedAt: new Date().toISOString(), ...data }] })),
      updateNote: (id, data) =>
        set(st => ({ notes: st.notes.map(n => n.id === id ? { ...n, ...data, updatedAt: new Date().toISOString() } : n) })),
      deleteNote: (id) =>
        set(st => ({ notes: st.notes.filter(n => n.id !== id) })),

      // ── Goals ──
      addGoal: (data, userId) =>
        set(st => ({ goals: [...st.goals, { id: crypto.randomUUID(), userId, progress: 0, ...data }] })),
      updateGoal: (id, data) =>
        set(st => ({ goals: st.goals.map(g => g.id === id ? { ...g, ...data } : g) })),
      deleteGoal: (id) =>
        set(st => ({ goals: st.goals.filter(g => g.id !== id) })),

      // ── Attendance ──
      markAttendance: (data, userId) => {
        // data: { subjectId, date, status, note }
        const existing = get().attendance.find(
          a => a.userId === userId && a.subjectId === data.subjectId && a.date === data.date
        )
        if (existing) {
          set(st => ({
            attendance: st.attendance.map(a =>
              a.id === existing.id ? { ...a, ...data } : a
            )
          }))
        } else {
          set(st => ({
            attendance: [...st.attendance, { id: crypto.randomUUID(), userId, ...data }]
          }))
        }
      },
      deleteAttendance: (id) =>
        set(st => ({ attendance: st.attendance.filter(a => a.id !== id) })),

      getAttendanceRecord: (userId, subjectId, date) => {
        return get().attendance.find(
          a => a.userId === userId && a.subjectId === subjectId && a.date === date
        )
      },
    }),
    { name: 'studysync-data' }
  )
)

// ── Constants ───────────────────────────────────────────────────────────────
export const SUBJECT_COLORS = [
  '#7c6af7', '#f97066', '#34d8a2', '#f5a524', '#60a5fa',
  '#e879f9', '#fb923c', '#a3e635', '#22d3ee', '#f472b6',
]

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
export const PRIORITY = { high: { label: 'High', color: '#f97066' }, medium: { label: 'Medium', color: '#f5a524' }, low: { label: 'Low', color: '#34d8a2' } }
export const STATUS = { pending: 'Pending', in_progress: 'In Progress', done: 'Done', overdue: 'Overdue' }
export const GRADE_TYPES = ['Assignment', 'Quiz', 'Midterm', 'Final', 'Project', 'Lab', 'Other']
export const ATTENDANCE_STATUS = {
  present: { label: 'Present', color: '#34d8a2', icon: '✓' },
  absent:  { label: 'Absent',  color: '#f97066', icon: '✗' },
  late:    { label: 'Late',    color: '#f5a524', icon: '⏰' },
}
