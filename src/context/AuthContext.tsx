import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { User, UserRole } from '@kaamgar/shared'
import { getSupabaseClient } from '@/lib/supabase'
import { checkPhoneRegistration, recordPhoneRegistered } from '@/services/authCheck'

interface AuthContextType {
  user: User | null
  isLoading: boolean
  login: (user: User) => void
  logout: () => Promise<void>
  updateUser: (updates: Partial<User>) => void
  signInWithEmail: (email: string, password: string) => Promise<void>
  signUpWithEmail: (email: string, password: string, fullName: string) => Promise<{ needsConfirmation: boolean }>
  signInWithGoogle: (redirectTo?: string) => Promise<void>
  loginWithVerifiedPhone: (name: string, phone: string, role?: UserRole, email?: string, customPassword?: string) => Promise<User>
  registerWithPhone: (name: string, phone: string, role?: UserRole, email?: string, customPassword?: string) => Promise<User>
  updatePhone: (phone: string) => Promise<void>
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
          localStorage.removeItem('kaamgar-user')
        }

        const authState = supabase.auth.onAuthStateChange((_event, session) => {
          if (!isMounted) return
          if (!session) {
            setUser(null)
            localStorage.removeItem('kaamgar-user')
            return
          }
          void loadSupabaseUser(session.user)
        })
        subscription = authState.data.subscription
      } catch {
        if (isMounted) {
          setUser(null)
          localStorage.removeItem('kaamgar-user')
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
    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, full_name, phone, email, role, language, avatar_url, created_at')
      .eq('id', authUser.id)
      .maybeSingle()
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

    // Determine clean email (ignore internal phone dummy domain)
    const rawEmail = profile?.email || authUser.email || ''
    const cleanEmail = rawEmail.includes('@phone.kaamgar.local') ? null : rawEmail || null

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
    localStorage.setItem('kaamgar-user', JSON.stringify(resolvedUser))
  }

  const login = (userData: User) => {
    setUser(userData)
    localStorage.setItem('kaamgar-user', JSON.stringify(userData))
  }

  const logout = async () => {
    setUser(null)
    localStorage.removeItem('kaamgar-user')
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('admin_2fa_verified')
      sessionStorage.removeItem('admin_2fa_timestamp')
      sessionStorage.removeItem('kaamgar_guest_mode')
    }
    try {
      const { error } = await getSupabaseClient().auth.signOut()
      if (error) console.warn('Supabase sign-out notice:', error.message)
    } catch (err) {
      console.warn('Sign out notice:', err)
    }
  }

  const signInWithEmail = async (email: string, password: string) => {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    if (data?.user) {
      await loadSupabaseUser(data.user)
    }
  }

  const signUpWithEmail = async (email: string, password: string, fullName: string) => {
    const { data, error } = await getSupabaseClient().auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })
    if (error) throw error
    return { needsConfirmation: !data.session }
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

  const loginWithVerifiedPhone = async (
    name: string,
    rawPhone: string,
    role: UserRole = 'customer',
    optionalEmail?: string,
    customPassword?: string
  ): Promise<User> => {
    const cleanPhone = rawPhone.replace(/\D/g, '').slice(-10)
    const formattedPhone = `+91${cleanPhone}`
    const cleanEmail = optionalEmail?.trim() || undefined
    const supabase = getSupabaseClient()

    // 1. Verify user is already registered. Block if not found!
    const check = await checkPhoneRegistration(cleanPhone)
    if (!check.isRegistered) {
      throw new Error('No account found with this mobile number. Please sign up to create your Jugnu account first.')
    }

    // Role mismatch verification for Worker portal
    if (role === 'worker' && check.role === 'customer' && !check.isWorker) {
      throw new Error('This mobile number is registered as a Customer. Please sign in under Customer Login or register as a Worker.')
    }

    // 2. Check if Supabase session already exists
    const { data: sessionData } = await supabase.auth.getSession()
    let authUser = sessionData.session?.user

    // 3. If no session, sign into existing account. DO NOT auto-signup unregistered users!
    if (!authUser) {
      const phoneEmail = cleanEmail || `${cleanPhone}@phone.kaamgar.local`
      const phonePassword = customPassword || `kaamgar_phone_${cleanPhone}_secure`

      try {
        const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
          email: phoneEmail,
          password: phonePassword,
        })

        if (signInData?.user) {
          authUser = signInData.user
        } else if (signInErr) {
          console.warn('Supabase phone sign-in notice:', signInErr.message)
        }
      } catch (e) {
        console.warn('Supabase phone-credential auth notice:', e)
      }
    }

    const resolvedRole = check.role || role
    const resolvedName = check.fullName || name || authUser?.user_metadata?.full_name || 'User'

    // 4. Construct and save resolved user
    const resolvedUser: User = {
      id: authUser?.id || `user_${cleanPhone}`,
      name: resolvedName,
      phone: formattedPhone,
      email: cleanEmail || null,
      role: resolvedRole,
      language: 'en',
      avatar_url: (authUser?.user_metadata?.avatar_url as string) || null,
      created_at: new Date().toISOString(),
    }

    login(resolvedUser)
    return resolvedUser
  }

  const registerWithPhone = async (
    name: string,
    rawPhone: string,
    role: UserRole = 'customer',
    optionalEmail?: string,
    customPassword?: string
  ): Promise<User> => {
    const cleanPhone = rawPhone.replace(/\D/g, '').slice(-10)
    const formattedPhone = `+91${cleanPhone}`
    const cleanEmail = optionalEmail?.trim() || undefined
    const supabase = getSupabaseClient()

    // 1. Verify user is NOT already registered. Block if already exists!
    const check = await checkPhoneRegistration(cleanPhone)
    if (check.isRegistered) {
      throw new Error('An account with this mobile number is already registered. Please log in instead.')
    }

    const phoneEmail = cleanEmail || `${cleanPhone}@phone.kaamgar.local`
    const phonePassword = customPassword || `kaamgar_phone_${cleanPhone}_secure`

    // 2. Perform SignUp in Supabase Auth
    let authUser: any = null
    try {
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email: phoneEmail,
        password: phonePassword,
        options: {
          data: {
            full_name: name || 'User',
            phone: formattedPhone,
            role: role,
          },
        },
      })

      if (signUpErr) {
        if (
          signUpErr.message?.toLowerCase().includes('already') ||
          (signUpErr as any).code === 'user_already_exists'
        ) {
          throw new Error('An account with this mobile number is already registered. Please log in instead.')
        }
        throw signUpErr
      }

      authUser = signUpData?.user || null
    } catch (err: any) {
      if (err.message?.toLowerCase().includes('already')) {
        throw new Error('An account with this mobile number is already registered. Please log in instead.')
      }
      throw err
    }

    if (!authUser) {
      const { data: signInData } = await supabase.auth.signInWithPassword({
        email: phoneEmail,
        password: phonePassword,
      })
      authUser = signInData?.user || null
    }

    // 3. Record in local device cache
    recordPhoneRegistered(cleanPhone, role, name)

    // 4. Upsert profile row in Supabase
    if (authUser) {
      try {
        await (supabase.from('profiles') as any).upsert({
          id: authUser.id,
          full_name: name || authUser.user_metadata?.full_name || 'User',
          phone: formattedPhone,
          email: cleanEmail || authUser.email || null,
          role: role,
        })
      } catch (e) {
        console.warn('Profile upsert notice:', e)
      }
    }

    // 5. Construct and save resolved user
    const resolvedUser: User = {
      id: authUser?.id || `user_${cleanPhone}`,
      name: name || authUser?.user_metadata?.full_name || 'User',
      phone: formattedPhone,
      email: cleanEmail || null,
      role: role,
      language: 'en',
      avatar_url: (authUser?.user_metadata?.avatar_url as string) || null,
      created_at: new Date().toISOString(),
    }

    login(resolvedUser)
    return resolvedUser
  }

  const updatePhone = async (rawPhone: string) => {
    const cleanPhone = rawPhone.replace(/\D/g, '').slice(-10)
    const formattedPhone = `+91${cleanPhone}`
    const supabase = getSupabaseClient()

    if (user) {
      const updated = { ...user, phone: formattedPhone }
      setUser(updated)
      localStorage.setItem('kaamgar-user', JSON.stringify(updated))

      try {
        const { data: sessionData } = await supabase.auth.getSession()
        if (sessionData.session?.user) {
          await (supabase.from('profiles') as any)
            .update({ phone: formattedPhone })
            .eq('id', sessionData.session.user.id)
        }
      } catch (err) {
        console.warn('Error persisting updated phone:', err)
      }
    }
  }

  const updateEmail = async (rawEmail: string) => {
    const cleanEmail = rawEmail.trim()
    const supabase = getSupabaseClient()

    if (user) {
      const updated = { ...user, email: cleanEmail || null }
      setUser(updated)
      localStorage.setItem('kaamgar-user', JSON.stringify(updated))

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
      localStorage.setItem('kaamgar-user', JSON.stringify(updated))
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
        signInWithEmail,
        signUpWithEmail,
        signInWithGoogle,
        loginWithVerifiedPhone,
        registerWithPhone,
        updatePhone,
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