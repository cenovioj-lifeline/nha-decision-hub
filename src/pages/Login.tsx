import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye } from 'lucide-react'
import { useAuth } from '../lib/auth'

export default function Login() {
  const { signIn, enterViewMode } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error: authError } = await signIn(email, password)

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    // Check admin status after sign-in by email
    const isAdminUser = email.toLowerCase() === 'cjaimes@nhaschools.com'
    navigate(isAdminUser ? '/inbox' : '/my-requests', { replace: true })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-nha-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-nha-blue rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-xl">DH</span>
          </div>
          <h1 className="text-2xl font-bold text-nha-gray-900">Decision Hub</h1>
          <p className="text-sm text-nha-gray-500 mt-1">NHA App Development</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-nha-gray-200 p-6 space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-nha-gray-700 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="you@nhaschools.com"
              className="w-full rounded-lg border border-nha-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-nha-sky focus:border-nha-sky"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-nha-gray-700 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="Enter your password"
              className="w-full rounded-lg border border-nha-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-nha-sky focus:border-nha-sky"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-nha-blue text-white rounded-lg text-sm font-semibold hover:bg-nha-blue/90 transition-colors disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-4 text-center">
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-nha-gray-200" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-nha-gray-50 px-3 text-xs text-nha-gray-400">or</span>
            </div>
          </div>

          <button
            onClick={() => {
              enterViewMode()
              navigate('/inbox', { replace: true })
            }}
            className="w-full py-2.5 rounded-lg border border-nha-gray-200 text-sm font-medium text-nha-gray-600 hover:bg-white hover:border-nha-gray-300 transition-colors flex items-center justify-center gap-2"
          >
            <Eye size={16} />
            View Only
          </button>
          <p className="text-xs text-nha-gray-400 mt-2">
            Browse requests and decisions without signing in
          </p>
        </div>

        <p className="text-center text-xs text-nha-gray-400 mt-4">
          Access restricted to @nhaschools.com accounts
        </p>
      </div>
    </div>
  )
}
