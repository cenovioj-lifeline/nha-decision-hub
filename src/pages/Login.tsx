import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'

export default function Login() {
  const { signIn, enterViewMode } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [signupSuccess, setSignupSuccess] = useState(false)

  async function handleSignIn(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error: authError } = await signIn(email, password)

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    navigate('/inbox', { replace: true })
  }

  async function handleSignUp(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)

    // Check if email is on the allowed list
    const { data: allowed } = await supabase
      .from('allowed_users')
      .select('email')
      .eq('email', email.toLowerCase())
      .single()

    if (!allowed) {
      setError('This email is not authorized to create an account.')
      setLoading(false)
      return
    }

    const { error: signupError } = await supabase.auth.signUp({
      email: email.toLowerCase(),
      password,
      options: {
        emailRedirectTo: window.location.origin + '/inbox',
      },
    })

    if (signupError) {
      setError(signupError.message)
      setLoading(false)
      return
    }

    setSignupSuccess(true)
    setLoading(false)
  }

  if (signupSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-nha-gray-50 px-4">
        <div className="w-full max-w-sm text-center">
          <div className="w-14 h-14 bg-green-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-2xl">✓</span>
          </div>
          <h1 className="text-2xl font-bold text-nha-gray-900 mb-2">Check Your Email</h1>
          <p className="text-sm text-nha-gray-600 mb-6">
            We sent a verification link to <strong>{email}</strong>. Click the link in the email to activate your account, then come back here to sign in.
          </p>
          <button
            onClick={() => { setSignupSuccess(false); setMode('signin'); setPassword(''); setConfirmPassword('') }}
            className="w-full py-2.5 bg-nha-blue text-white rounded-lg text-sm font-semibold hover:bg-nha-blue/90 transition-colors"
          >
            Back to Sign In
          </button>
        </div>
      </div>
    )
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

        <div className="bg-white rounded-2xl shadow-sm border border-nha-gray-200 p-6">
          {/* Tab switcher */}
          <div className="flex rounded-lg bg-nha-gray-100 p-1 mb-5">
            <button
              onClick={() => { setMode('signin'); setError('') }}
              className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${
                mode === 'signin' ? 'bg-white text-nha-gray-900 shadow-sm' : 'text-nha-gray-500'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setMode('signup'); setError('') }}
              className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${
                mode === 'signup' ? 'bg-white text-nha-gray-900 shadow-sm' : 'text-nha-gray-500'
              }`}
            >
              Create Account
            </button>
          </div>

          <form onSubmit={mode === 'signin' ? handleSignIn : handleSignUp} className="space-y-4">
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
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                placeholder={mode === 'signin' ? 'Enter your password' : 'Choose a password'}
                className="w-full rounded-lg border border-nha-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-nha-sky focus:border-nha-sky"
              />
            </div>

            {mode === 'signup' && (
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-nha-gray-700 mb-1">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  placeholder="Confirm your password"
                  className="w-full rounded-lg border border-nha-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-nha-sky focus:border-nha-sky"
                />
              </div>
            )}

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-nha-blue text-white rounded-lg text-sm font-semibold hover:bg-nha-blue/90 transition-colors disabled:opacity-50"
            >
              {loading
                ? (mode === 'signin' ? 'Signing in...' : 'Creating account...')
                : (mode === 'signin' ? 'Sign In' : 'Create Account')}
            </button>
          </form>
        </div>

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
          {mode === 'signup'
            ? 'Only pre-approved @nhaschools.com emails can create accounts'
            : 'Access restricted to @nhaschools.com accounts'}
        </p>
      </div>
    </div>
  )
}
