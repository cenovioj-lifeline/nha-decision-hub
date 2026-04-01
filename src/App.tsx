import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import ErrorBoundary from './components/ErrorBoundary'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Inbox from './pages/Inbox'
import RequestDetail from './pages/RequestDetail'
import RequestsAndDecisions from './pages/MyRequests'
import Sprints from './pages/Sprints'
import Dashboard from './pages/Dashboard'
import Admin from './pages/Admin'

function RootRedirect() {
  const { user, isAdmin, isViewer, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-nha-blue" />
      </div>
    )
  }

  if (isViewer) return <Navigate to="/inbox" replace />
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={isAdmin ? '/inbox' : '/requests'} replace />
}

export default function App() {
  return (
    <ErrorBoundary>
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
            <Route path="/requests/:id" element={<RequestDetail />} />
            <Route path="/sprints" element={<ProtectedRoute adminOnly><Sprints /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute adminOnly><Dashboard /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute adminOnly><Admin /></ProtectedRoute>} />
            <Route path="/requests" element={<RequestsAndDecisions />} />
            {/* Legacy redirects */}
            <Route path="/my-requests" element={<Navigate to="/requests" replace />} />
            <Route path="/decisions" element={<Navigate to="/requests" replace />} />
            <Route path="/declined" element={<Navigate to="/requests" replace />} />
            <Route path="/tracking" element={<Navigate to="/requests" replace />} />
            <Route path="/upload" element={<Navigate to="/inbox" replace />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
    </ErrorBoundary>
  )
}
