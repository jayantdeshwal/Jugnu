import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { User, UserRole } from '@kaamgar/shared'
import { getSupabaseClient } from '@/lib/supabase'

export interface PhoneAuthResult {
  user: User
  isNewUser: boolean
  role: UserRole
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  login: (user: User) => void
  logout: () => Promise<void>
  updateUser: (updates: Partial<User>) => void
  signInWithGoogle: (redirectTo?: string) => Promise<void>
  verifyAndLoginWithOtp: (phone: string, accessToken: string, fullName?: string, email?: string) => Promise<PhoneAuthResult>
  updateEmail: (email: string) => Promise<void>
  isAuthenticated: boolean
  isWorker: boolean
  isAdmin: boolean
  isSuperAdmin: boolean
  isSubAdmin: boolean
  needsPhoneVerification: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface ProfileRow {
  id: string
  full_name: string
  phone: string | null
  email?: string | null
  role: UserRole
  language: 'en' | 'hi'
  avatar_url: string | null
  created_at: string | null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true
    let subscription: { unsubscribe: () => void } | undefined

    const loadSession = async () => {
      try {
        const supabase = getSupabaseClient()
        const { data, error } = await supabase.auth.getSession()
        if (error) throw error

        if (data.session && isMounted) {
          await loadSupabaseUser(data.session.user)
        } else if (isMounted) {
          setUser(null)
        }

        const authState = supabase.auth.onAuthStateChange((_event, session) => {
          if (!isMounted) return
          if (!session) {
            setUser(null)
            return
          }
          void loadSupabaseUser(session.user)
        })
        subscription = authState.data.subscription
      } catch {
        if (isMounted) {
          setUser(null)
        }
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    void loadSession()

    return () => {
      isMounted = false
      subscription?.unsubscribe()
    }
  }, [])

  const loadSupabaseUser = async (authUser: {
    id: string
    email?: string
    phone?: string
    user_metadata?: Record<string, unknown>
    created_at?: string
  }) => {
    const supabase = getSupabaseClient()
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name, phone, email, role, language, avatar_url, created_at')
      .eq('id', authUser.id)
      .maybeSingle()

    // Successful query with no row = account deleted. Sign out immediately.
    // A query error (network/DB failure) is NOT treated as deletion — fall through normally.
    if (!profileError && profileData === null) {
      console.warn('[AuthContext] Profile not found for authenticated user — account deleted. Signing out.')
      setUser(null)
      void supabase.auth.signOut()
      return
    }

    const profile = profileData as ProfileRow | null

    let role = profile?.role as UserRole | undefined

    if (role !== 'worker' && role !== 'super_admin' && role !== 'sub_admin') {
      const { data: workerCheck } = (await supabase
        .from('worker_profiles' as any)
        .select('id')
        .eq('id', authUser.id)
        .maybeSingle()) as { data: { id: string } | null }
      if (workerCheck?.id) {
        role = 'worker'
      }
    }

    // Filter out internal synthetic email domains from personal email display
    const rawEmail = profile?.email || authUser.email || ''
    const isSyntheticEmail =
      rawEmail.includes('@phone.kaamgar.local') || rawEmail.includes('@phone.jugnu.in')
    const cleanEmail = isSyntheticEmail ? null : rawEmail || null

    const resolvedUser: User = {
      id: authUser.id,
      name:
        profile?.full_name ||
        String(authUser.user_metadata?.full_name ?? authUser.user_metadata?.name ?? authUser.email ?? 'User'),
      phone: profile?.phone || authUser.phone || '',
      email: cleanEmail,
      role: role ?? 'customer',
      language: profile?.language ?? 'en',
      avatar_url: profile?.avatar_url ?? (authUser.user_metadata?.avatar_url as string) ?? null,
      created_at: profile?.created_at ?? authUser.created_at,
    }
    setUser(resolvedUser)
  }

  const login = (userData: User) => {
    setUser(userData)
  }

  const logout = async () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('kaamgar_guest_mode')
    }
    try {
      const supabase = getSupabaseClient()
      // Revoke server-side 2FA authorization before signing out
      try { await supabase.rpc('revoke_admin_2fa') } catch { /* non-admin sessions have no record */ }
      const { error } = await supabase.auth.signOut()
      if (error) console.warn('Supabase sign-out notice:', error.message)
    } catch (err) {
      console.warn('Sign out notice:', err)
    }
    setUser(null)
  }

  const signInWithGoogle = async (redirectTo?: string) => {
    const supabase = getSupabaseClient()
    const redirectUrl =
      redirectTo || (typeof window !== 'undefined' ? `${window.location.origin}/login` : undefined)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
      },
    })
    if (error) throw error
  }

  /**
   * Authoritative passwordless login / registration with MSG91 OTP token.
   * Invokes the server-side verify-phone-auth Edge Function, installs the legitimate Supabase session,
   * loads the authoritative database profile, and synchronizes React state.
   */
  const verifyAndLoginWithOtp = async (
    rawPhone: string,
    accessToken: string,
    fullName?: string,
    optionalEmail?: string
  ): Promise<PhoneAuthResult> => {
    const cleanPhone = rawPhone.replace(/\D/g, '').slice(-10)
    const formattedPhone = `+91${cleanPhone}`
    const supabase = getSupabaseClient()

    const { data, error } = await supabase.functions.invoke('verify-phone-auth', {
      body: {
        phone: formattedPhone,
        accessToken,
        fullName: fullName?.trim() || undefined,
        email: optionalEmail?.trim() || undefined,
      },
    })

    if (error || !data || !data.session) {
      let serverErrorMsg = data?.error
      if (!serverErrorMsg && error) {
        try {
          const errorBody = await (error as any).context?.json()
          if (errorBody?.error) {
            serverErrorMsg = errorBody.error
          } else if (errorBody?.message) {
            serverErrorMsg = errorBody.message
          }
        } catch {
          // Ignore context JSON parse errors
        }
      }
      const errorMsg =
        serverErrorMsg || error?.message || 'OTP verification failed on server. Please check and retry.'
      console.error('[verifyAndLoginWithOtp] Edge Function error:', { errorMsg, error, data })
      throw new Error(errorMsg)
    }

    // Install genuine Supabase GoTrue session
    const { data: sessionData, error: sessionErr } = await supabase.auth.setSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    })

    if (sessionErr || !sessionData.user) {
      throw new Error(sessionErr?.message || 'Failed to install authenticated session. Please retry.')
    }

    // Load authoritative profile
    await loadSupabaseUser(sessionData.user)

    const resolvedUser: User = {
      id: data.user.id,
      name: data.user.name || fullName || 'User',
      phone: data.user.phone || formattedPhone,
      email: data.user.email || (optionalEmail?.trim() ?? null),
      role: (data.role as UserRole) || 'customer',
      language: 'en',
      avatar_url: null,
      created_at: new Date().toISOString(),
    }

    return {
      user: resolvedUser,
      isNewUser: Boolean(data.isNewUser),
      role: (data.role as UserRole) || 'customer',
    }
  }

  const updateEmail = async (rawEmail: string) => {
    const cleanEmail = rawEmail.trim()
    const supabase = getSupabaseClient()

    if (user) {
      const updated = { ...user, email: cleanEmail || null }
      setUser(updated)

      try {
        const { data: sessionData } = await supabase.auth.getSession()
        if (sessionData.session?.user) {
          await (supabase.from('profiles') as any)
            .update({ email: cleanEmail || null })
            .eq('id', sessionData.session.user.id)
        }
      } catch (err) {
        console.warn('Error persisting updated email:', err)
      }
    }
  }

  const needsPhoneVerification = !!user && (!user.phone || user.phone.trim() === '')

  const updateUser = (updates: Partial<User>) => {
    if (user) {
      const updated = { ...user, ...updates }
      setUser(updated)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        logout,
        updateUser,
        signInWithGoogle,
        verifyAndLoginWithOtp,
        updateEmail,
        isAuthenticated: !!user,
        isWorker: user?.role === 'worker',
        isAdmin: user?.role === 'super_admin' || user?.role === 'sub_admin',
        isSuperAdmin: user?.role === 'super_admin',
        isSubAdmin: user?.role === 'sub_admin',
        needsPhoneVerification,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}