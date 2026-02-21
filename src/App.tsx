import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { UserProvider, useUser } from './context/UserContext'
import Login from './pages/Login'
import Terminal from './pages/Terminal'

function LoadingScreen() {
  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '1rem',
      backgroundColor: 'var(--bg)'
    }}>
      <p style={{ color: 'var(--text)' }}>CONNECTING...</p>
      <span className="cursor" />
    </div>
  )
}

function AppRoutes() {
  const { user, loading } = useUser()

  if (loading) return <LoadingScreen />

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={user ? <Navigate to="/terminal" replace /> : <Login />}
        />
        <Route
          path="/terminal"
          element={user ? <Terminal /> : <Navigate to="/login" replace />}
        />
        <Route
          path="*"
          element={<Navigate to={user ? '/terminal' : '/login'} replace />}
        />
      </Routes>
    </BrowserRouter>
  )
}

export default function App() {
  return (
    <UserProvider>
      <AppRoutes />
    </UserProvider>
  )
}
