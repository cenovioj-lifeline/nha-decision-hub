import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Inbox from './pages/Inbox'
import RequestDetail from './pages/RequestDetail'
import Upload from './pages/Upload'
import MyRequests from './pages/MyRequests'
import DecisionsLog from './pages/DecisionsLog'
import Tracking from './pages/Tracking'
import Dashboard from './pages/Dashboard'

function RootRedirect() {
  const { user, isAdmin, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-nha-blue" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={isAdmin ? '/inbox' : '/my-requests'} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<RootRedirect />} />
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/inbox" element={<ProtectedRoute adminOnly><Inbox /></ProtectedRoute>} />
            <Route path="/requests/:id" element={<ProtectedRoute adminOnly><RequestDetail /></ProtectedRoute>} />
            <Route path="/upload" element={<ProtectedRoute adminOnly><Upload /></ProtectedRoute>} />
            <Route path="/decisions" element={<ProtectedRoute adminOnly><DecisionsLog /></ProtectedRoute>} />
            <Route path="/tracking" element={<ProtectedRoute adminOnly><Tracking /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute adminOnly><Dashboard /></ProtectedRoute>} />
            <Route path="/my-requests" element={<MyRequests />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
