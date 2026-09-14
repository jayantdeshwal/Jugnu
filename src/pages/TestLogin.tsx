import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Card, Input, Button } from '@kaamgar/ui'
import { useAuth } from '../context/AuthContext'
import { User } from '../shared'
import { Shield, Lock, Mail, AlertCircle, ArrowLeft, Wrench, User as UserIcon, CheckCircle2 } from 'lucide-react'

export default function TestLogin() {
  const navigate = useNavigate()
  const { user, login, signInWithEmail } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // If already logged in, redirect based on role
  useEffect(() => {
    if (user) {
      if (user.role === 'admin') {
        navigate('/admin')
      }
    }
  }, [user, navigate])

  const handleEmailPasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccessMsg('')

    if (!email.trim() || !password) {
      setError('Please enter both email and password.')
      return
    }

    setLoading(true)
    try {
      await signInWithEmail(email.trim(), password)
      setSuccessMsg('Authenticated successfully! Redirecting...')
      setTimeout(() => {
        // Will be picked up by AuthContext, fallback redirect
        navigate('/admin')
      }, 500)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  const handleQuickLogin = (role: 'admin' | 'worker' | 'customer') => {
    if (role === 'admin') {
      const adminData: User = {
        id: 'test-admin-1',
        name: 'Administrator',
        email: 'admin@kaamgar.local',
        phone: '+919876543212',
        role: 'admin',
        language: 'en',
        avatar_url: null,
        created_at: new Date().toISOString(),
      }
      login(adminData)
      navigate('/admin')
    } else if (role === 'worker') {
      const workerData: User = {
        id: 'test-worker-1',
        name: 'Test Worker (Mahesh Kumar)',
        email: 'worker@kaamgar.local',
        phone: '+919876543211',
        role: 'worker',
        language: 'hi',
        avatar_url: null,
        created_at: new Date().toISOString(),
      }
      login(workerData)
      navigate('/worker/dashboard')
    } else {
      const customerData: User = {
        id: 'test-customer-1',
        name: 'Test Customer (Rahul Verma)',
        email: 'customer@kaamgar.local',
        phone: '+919876543210',
        role: 'customer',
        language: 'en',
        avatar_url: null,
        created_at: new Date().toISOString(),
      }
      login(customerData)
      navigate('/')
    }
  }

  return (
    <div className="min-h-screen bg-semantic-bg-primary flex items-center justify-center py-12 px-4">
      <Card className="w-full max-w-lg p-8 bg-surface-100 border border-semantic-border-light shadow-2xl">
        {/* Top Notice */}
        <div className="mb-6 p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300 flex items-start gap-2.5">
          <Shield className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
          <div>
            <strong className="font-semibold block text-amber-200 mb-0.5">Temporary Test & Admin Login Page</strong>
            This separate page (<code>/test-login</code>) allows you to log in with your email/password or instant test accounts. You can delete this page later without touching the main customer flow.
          </div>
        </div>

        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto mb-3 bg-brand-500/10 border border-brand-500/20 rounded-2xl flex items-center justify-center">
            <Lock className="w-7 h-7 text-brand-400" />
          </div>
          <h1 className="text-2xl font-bold text-semantic-text-primary">
            Sign In with Email & Password
          </h1>
          <p className="mt-1 text-sm text-semantic-text-secondary">
            Use your registered Supabase administrator credentials.
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-5 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-center gap-2 text-emerald-400 text-sm">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Real Email & Password Form */}
        <form onSubmit={handleEmailPasswordLogin} className="space-y-4">
          <Input
            label="Email Address"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="admin@example.com"
            leftIcon={<Mail className="w-5 h-5 text-semantic-text-tertiary" />}
            required
            autoFocus
          />

          <Input
            label="Password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••••••"
            leftIcon={<Lock className="w-5 h-5 text-semantic-text-tertiary" />}
            required
          />

          <Button
            type="submit"
            variant="primary"
            className="w-full mt-2"
            size="lg"
            loading={loading}
          >
            Sign In to Account
          </Button>
        </form>

        {/* 1-Click Instant Test Logins */}
        <div className="mt-8 pt-6 border-t border-semantic-border-light">
          <div className="text-center mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-semantic-text-tertiary">
              Or 1-Click Instant Test Login
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleQuickLogin('admin')}
              className="py-2 text-xs text-amber-400 border-amber-500/30 hover:bg-amber-500/10 flex flex-col items-center gap-1"
            >
              <Shield className="w-4 h-4" />
              <span>Admin</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleQuickLogin('worker')}
              className="py-2 text-xs text-brand-300 border-brand-500/30 hover:bg-brand-500/10 flex flex-col items-center gap-1"
            >
              <Wrench className="w-4 h-4" />
              <span>Worker</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleQuickLogin('customer')}
              className="py-2 text-xs text-semantic-text-primary border-semantic-border-light hover:bg-surface-200 flex flex-col items-center gap-1"
            >
              <UserIcon className="w-4 h-4" />
              <span>Customer</span>
            </Button>
          </div>
        </div>

        {/* Return to Public Login */}
        <div className="mt-6 pt-4 border-t border-semantic-border-light text-center">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-xs text-semantic-text-tertiary hover:text-semantic-text-primary transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Go to Customer Mobile OTP Login (`/login`)</span>
          </Link>
        </div>
      </Card>
    </div>
  )
}
