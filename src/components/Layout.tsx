import { Outlet, NavLink, Link, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLanguage } from '../context/LanguageContext'
import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../context/NotificationContext'
import { useAiAssistant } from '../context/AiAssistantContext'
import { Button, Avatar, Badge } from '@kaamgar/ui'
import {
  Menu, X, Bell, User, LogOut, Settings, Shield, Home, Search, List, UserPlus,
  Truck, Star, Briefcase, ChevronDown, Globe, Phone, Mail, MapPin, ShieldCheck,
  ArrowRight, ArrowLeft, Heart, Smartphone, LogIn, Sparkles, Sun, Moon,
  Bot, Grid, Zap, Calendar, ClipboardList, UserCheck
} from 'lucide-react'
import { CATEGORIES, getCategoryName } from '@kaamgar/shared'
import { useState, useRef, useEffect } from 'react'
import { useTheme } from '../context/ThemeContext'
import NetworkStatus from './NetworkStatus'
import PWAInstallPrompt, { triggerPWAInstall } from './PWAInstallPrompt'
import AiAssistantModal from './ai/AiAssistantModal'
import AiFloatingTrigger from './ai/AiFloatingTrigger'
import JugnuLogo from './common/JugnuLogo'

export default function Layout() {
  const { t } = useTranslation()
  const { language, toggleLanguage } = useLanguage()
  const { theme, toggleTheme, isDark } = useTheme()
  const { user, isAuthenticated, isWorker, isAdmin, logout, isLoading } = useAuth()
  const { notifications, removeNotification, unreadCount } = useNotifications()
  const { openAssistant } = useAiAssistant()
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

  // Handle click outside and Escape key to close user menu dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setUserMenuOpen(false)
      }
    }

    if (userMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [userMenuOpen])

  // Close user dropdown and mobile menu when route changes
  useEffect(() => {
    setUserMenuOpen(false)
    setMobileMenuOpen(false)
  }, [location.pathname])
  
  interface NavItem {
    path: string
    label: string
    icon: any
    badge?: number
  }

  // Dedicated role-based navigation menus: Clean and focused
  const customerNavItems: NavItem[] = [
    { path: '/search', label: t('nav.search'), icon: Search },
    { path: '/bookings', label: t('nav.bookings'), icon: List },
    { path: '/notifications', label: t('nav.notifications'), icon: Bell, badge: unreadCount },
  ]

  // Worker navigation: ultra-simple and direct for ease of understanding
  const workerNavItems: NavItem[] = [
    { path: '/worker/dashboard', label: t('nav.workerDashboard'), icon: Briefcase },
    { path: '/notifications', label: t('nav.notifications'), icon: Bell, badge: unreadCount },
  ]

  const adminNavItems: NavItem[] = [
    { path: '/admin', label: t('nav.adminDashboard'), icon: Shield },
    { path: '/notifications', label: t('nav.notifications'), icon: Bell, badge: unreadCount },
  ]

  const guestNavItems: NavItem[] = [
    { path: '/search', label: t('nav.search'), icon: Search },
  ]

  const currentNavItems = !isAuthenticated
    ? guestNavItems
    : isAdmin
    ? adminNavItems
    : isWorker
    ? workerNavItems
    : customerNavItems

  // Urban Company Style 5-button Mobile Bottom Navigation Tabs per role
  interface BottomTabItem {
    id: string
    label: string
    path?: string
    icon: any
    badge?: number
    action?: () => void
  }

  // 1. Customer: Home, Services, Search, Bookings, Account
  const customerBottomTabs: BottomTabItem[] = [
    { id: 'home', label: t('nav.home', 'Home'), path: '/', icon: Home },
    { id: 'services', label: t('nav.categories', 'Services'), path: '/search?view=services', icon: Grid },
    { id: 'search', label: t('nav.search', 'Search'), path: '/search', icon: Search },
    { id: 'bookings', label: t('nav.bookings', 'Bookings'), path: '/bookings', icon: ClipboardList, badge: unreadCount },
    { id: 'account', label: t('nav.account', 'Account'), path: '/profile', icon: User },
  ]

  // 2. Worker: Home, Dashboard, New Leads, Alerts, Account
  const workerBottomTabs: BottomTabItem[] = [
    { id: 'home', label: t('nav.home', 'Home'), path: '/', icon: Home },
    { id: 'dashboard', label: t('nav.workerDashboard', 'Dashboard'), path: '/worker/dashboard', icon: Briefcase },
    { id: 'leads', label: t('worker.newLeads', 'Leads'), path: '/worker/dashboard?tab=leads', icon: Zap },
    { id: 'alerts', label: t('nav.alerts', 'Alerts'), path: '/notifications', icon: Bell, badge: unreadCount },
    { id: 'account', label: t('nav.account', 'Account'), path: '/profile', icon: User },
  ]

  // 3. Admin: Dashboard, Approvals, Alerts, All Bookings, Account
  const adminBottomTabs: BottomTabItem[] = [
    { id: 'dashboard', label: t('admin.dashboard', 'Dashboard'), path: '/admin', icon: Shield },
    { id: 'approvals', label: t('admin.approvals', 'Approvals'), path: '/admin?tab=workers', icon: UserCheck },
    { id: 'alerts', label: t('admin.alerts', 'Alerts'), path: '/admin?tab=notifications', icon: Bell, badge: unreadCount },
    { id: 'bookings', label: t('admin.allBookings', 'All Bookings'), path: '/admin?tab=bookings', icon: Calendar },
    { id: 'account', label: t('nav.account', 'Account'), path: '/profile', icon: User },
  ]

  // 4. Guest Mode: Home, Services, Search, AI Help, Account
  const guestBottomTabs: BottomTabItem[] = [
    { id: 'home', label: t('nav.home', 'Home'), path: '/', icon: Home },
    { id: 'services', label: t('nav.categories', 'Services'), path: '/search?view=services', icon: Grid },
    { id: 'search', label: t('nav.search', 'Search'), path: '/search', icon: Search },
    { id: 'ai', label: 'AI Help', icon: Bot, action: () => openAssistant('customer_booking') },
    { id: 'account', label: t('nav.login', 'Account'), path: '/login', icon: LogIn },
  ]

  const currentBottomTabs = !isAuthenticated
    ? guestBottomTabs
    : isAdmin
    ? adminBottomTabs
    : isWorker
    ? workerBottomTabs
    : customerBottomTabs
  
  const isGuestMode = typeof window !== 'undefined' && sessionStorage.getItem('kaamgar_guest_mode') === 'true'

  const handleBackToLogin = () => {
    sessionStorage.removeItem('kaamgar_guest_mode')
    window.dispatchEvent(new Event('storage'))
    navigate('/login')
  }

  const isActive = (path: string) => location.pathname === path || (path !== '/' && location.pathname.startsWith(path))
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-semantic-bg-primary flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
      </div>
    )
  }

  // NotificationToast component
  function NotificationToast({ notifications, onClose }: { notifications: any[]; onClose: (id: string) => void }) {
    if (notifications.length === 0) return null
    
    return (
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2" role="region" aria-label="Notifications">
        {notifications.map(notification => (
          <div
            key={notification.id}
            className={`
              flex items-start gap-3 w-80 bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 p-4 animate-slide-in text-slate-900 dark:text-zinc-100
              ${notification.type === 'success' ? 'border-l-4 border-emerald-500' : ''}
              ${notification.type === 'error' ? 'border-l-4 border-rose-500' : ''}
              ${notification.type === 'warning' ? 'border-l-4 border-amber-500' : ''}
              ${notification.type === 'info' ? 'border-l-4 border-blue-500' : ''}
            `}
            role="alert"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-900 dark:text-white">{notification.title}</p>
              {notification.message && <p className="mt-1 text-xs text-slate-600 dark:text-zinc-400">{notification.message}</p>}
            </div>
            <button
              onClick={() => onClose(notification.id)}
              className="flex-shrink-0 text-slate-400 hover:text-slate-700 dark:text-zinc-500 dark:hover:text-zinc-200 p-1 transition-colors cursor-pointer"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    )
  }

  const isAuthPage =
    location.pathname === '/login' ||
    location.pathname === '/auth' ||
    location.pathname.startsWith('/register') ||
    location.pathname === '/signup'

  if (isAuthPage || (!isAuthenticated && !isGuestMode)) {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 flex flex-col transition-colors">
        <NetworkStatus />
        <main className="min-h-screen flex-1">
          <Outlet />
        </main>
        <NotificationToast
          notifications={notifications}
          onClose={removeNotification}
        />
        <PWAInstallPrompt />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 flex flex-col transition-colors">
      <NetworkStatus />
      <header className="sticky top-0 z-40 bg-white/85 dark:bg-zinc-950/90 backdrop-blur-md border-b border-slate-200/80 dark:border-zinc-800/80 transition-colors pt-[env(safe-area-inset-top)]">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" aria-label="Main navigation">
          
          {/* ========================================================= */}
          {/* MOBILE TOP BAR (Visible on screens < 768px: md:hidden)   */}
          {/* Left: 3-lines menu + Jugnu Brand | Right: AI Support     */}
          {/* ========================================================= */}
          <div className="flex md:hidden h-14 items-center justify-between">
            {/* Left Group: 3-lines button + Jugnu logo & name placed close together */}
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="flex items-center justify-center w-9 h-9 -ml-1 rounded-xl text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800/80 active:scale-95 transition-all cursor-pointer shrink-0"
                aria-label="Open navigation sidebar"
                title="Menu"
              >
                <Menu className="w-6 h-6" />
              </button>

              <NavLink to="/" className="flex items-center gap-2 min-w-0" aria-label={t('app.name')}>
                <JugnuLogo className="w-8 h-8 rounded-xl shrink-0 shadow-sm" />
                <span className="font-black text-lg tracking-tight text-slate-900 dark:text-white truncate">
                  {t('app.name')}
                </span>
              </NavLink>
            </div>

            {/* Top Right: AI Support Button */}
            <button
              type="button"
              onClick={() => openAssistant('customer_booking')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-extrabold text-xs shadow-md shadow-amber-500/25 hover:brightness-105 active:scale-95 transition-all border border-amber-400/40 cursor-pointer shrink-0"
              aria-label="AI Support"
              title="AI Support Assistant"
            >
              <Bot className="w-3.5 h-3.5 text-slate-950 animate-bounce" />
              <span className="tracking-tight">AI Support</span>
            </button>
          </div>

          {/* ========================================================= */}
          {/* DESKTOP TOP BAR (Laptop/Desktop: hidden md:flex)          */}
          {/* 100% UNCHANGED: Left logo+nav, Right theme+lang+profile   */}
          {/* ========================================================= */}
          <div className="hidden md:flex h-16 items-center justify-between">
            <div className="flex items-center gap-6">
              <NavLink to="/" className="flex items-center gap-2.5" aria-label={t('app.name')}>
                <JugnuLogo className="w-9 h-9 rounded-xl shadow-sm" />
                <span className="font-black text-xl text-slate-900 dark:text-white">
                  {t('app.name')}
                </span>
              </NavLink>

              {/* Navigation Items (Distinct per Role) */}
              <div className="flex items-center gap-1 bg-slate-100/90 dark:bg-zinc-900/80 border border-slate-200/80 dark:border-zinc-800 rounded-2xl p-1">
                {currentNavItems.map(({ path, label, icon: Icon, badge }) => (
                  <NavLink
                    key={path}
                    to={path}
                    className={({ isActive }) =>
                      `flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-semibold transition-all ${
                        isActive
                          ? 'bg-white dark:bg-zinc-800 text-amber-600 dark:text-amber-400 shadow-xs border border-slate-200/80 dark:border-zinc-700'
                          : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 hover:bg-white/60 dark:hover:bg-zinc-800/60'
                      }`
                    }
                    aria-current={isActive(path) ? 'page' : undefined}
                  >
                    <Icon className="w-4 h-4" aria-hidden="true" />
                    <span>{label}</span>
                    {Boolean(badge && badge > 0) && (
                      <Badge variant="danger" size="sm" className="ml-1">
                        {badge}
                      </Badge>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-2.5">
              {/* Theme Switcher Button */}
              <button
                type="button"
                onClick={toggleTheme}
                className="flex items-center justify-center w-8 h-8 rounded-full border border-slate-200 dark:border-zinc-700 bg-white/80 dark:bg-zinc-800 text-slate-700 dark:text-amber-400 hover:bg-slate-100 dark:hover:bg-zinc-700 hover:scale-105 active:scale-95 transition-all shadow-xs cursor-pointer"
                aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                title={isDark ? 'Light Theme (सफेद थीम)' : 'Dark Theme (नाइट थीम)'}
              >
                {isDark ? (
                  <Sun className="w-4 h-4 text-amber-400" />
                ) : (
                  <Moon className="w-4 h-4 text-slate-700" />
                )}
              </button>

              {/* Language Switcher Button */}
              <button
                onClick={toggleLanguage}
                className="flex items-center gap-1.5 px-2.5 py-1.5 border border-slate-200 dark:border-zinc-700 bg-white/80 dark:bg-zinc-800 rounded-full text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-700 transition-all shadow-xs cursor-pointer"
                aria-label={language === 'en' ? 'Switch to Hindi' : 'Switch to English'}
                title={language === 'en' ? 'हिन्दी में बदलें' : 'Switch to English'}
              >
                <Globe className="w-3.5 h-3.5 text-amber-500" />
                <span className="font-hindi tracking-wide">{language === 'en' ? 'EN' : 'हि'}</span>
              </button>
              
              {isAuthenticated ? (
                /* Professional Desktop User Menu Dropdown */
                <div className="relative" ref={userMenuRef}>
                  <button
                    type="button"
                    onClick={() => setUserMenuOpen(prev => !prev)}
                    className={`flex items-center gap-2.5 py-1 pl-1.5 pr-3 rounded-full border transition-all duration-150 cursor-pointer ${
                      userMenuOpen
                        ? 'bg-slate-100 dark:bg-zinc-800 border-amber-500/50 shadow-xs'
                        : 'bg-white/80 dark:bg-zinc-800/80 border-slate-200 dark:border-zinc-700 hover:border-slate-300 dark:hover:border-zinc-600 hover:bg-slate-50 dark:hover:bg-zinc-750'
                    }`}
                    aria-expanded={userMenuOpen}
                    aria-haspopup="true"
                    aria-label="User profile menu"
                  >
                    <Avatar name={user?.name} size="sm" src={user?.avatar_url || undefined} />
                    <div className="hidden sm:flex flex-col text-left leading-tight">
                      <span className="text-sm font-bold text-slate-900 dark:text-zinc-100 truncate max-w-[130px]">
                        {user?.name}
                      </span>
                      <span className={`text-[11px] font-medium leading-none ${
                        isAdmin ? 'text-rose-500 dark:text-rose-400' : isWorker ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400'
                      }`}>
                        {isAdmin ? t('nav.roleAdmin', 'Admin') : isWorker ? t('nav.roleWorker', 'Worker') : t('nav.roleCustomer', 'Customer')}
                      </span>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-slate-400 dark:text-zinc-500 transition-transform duration-200 ${
                      userMenuOpen ? 'rotate-180 text-amber-500' : ''
                    }`} />
                  </button>

                  {/* Dropdown Menu Panel */}
                  {userMenuOpen && (
                    <div
                      className="absolute right-0 mt-2 w-72 bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-zinc-800 py-2 z-50 animate-in"
                      role="menu"
                      aria-orientation="vertical"
                    >
                      {/* User Info Header */}
                      <div className="px-4 py-3 border-b border-slate-100 dark:border-zinc-800">
                        <div className="flex items-center gap-3">
                          <Avatar name={user?.name} size="md" src={user?.avatar_url || undefined} />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-slate-900 dark:text-zinc-100 truncate">{user?.name}</p>
                            <p className="text-xs text-slate-500 dark:text-zinc-400 truncate mt-0.5">{user?.phone || 'Logged In'}</p>
                            <div className="mt-1.5">
                              {isAdmin && <Badge variant="danger" size="sm">{t('nav.roleAdmin', 'Admin')}</Badge>}
                              {isWorker && !isAdmin && <Badge variant="success" size="sm">{t('nav.roleWorker', 'Worker')}</Badge>}
                              {!isWorker && !isAdmin && <Badge variant="info" size="sm">{t('nav.roleCustomer', 'Customer')}</Badge>}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Primary Options */}
                      <div className="py-1">
                        {/* Profile Link */}
                        <NavLink
                          to="/profile"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                          role="menuitem"
                        >
                          <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-amber-500">
                            <User className="w-4 h-4" />
                          </div>
                          <div className="flex flex-col text-left">
                            <span className="font-semibold">{t('nav.profile')}</span>
                            <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-normal">{t('nav.accountPreferences', 'Account & preferences')}</span>
                          </div>
                        </NavLink>

                        {/* Become a Worker - Only for Customer */}
                        {!isWorker && !isAdmin && (
                          <button
                            type="button"
                            onClick={() => {
                              setUserMenuOpen(false)
                              navigate('/register/worker')
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/25 transition-colors text-left group cursor-pointer"
                            role="menuitem"
                          >
                            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-500/25 transition-colors">
                              <Briefcase className="w-4 h-4" />
                            </div>
                            <div className="flex flex-col text-left flex-1">
                              <div className="flex items-center justify-between">
                                <span className="font-semibold">{t('nav.becomeWorker')}</span>
                                <span className="text-[10px] bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Earn</span>
                              </div>
                              <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-normal">{t('nav.registerToGetJobs', 'Register to get customer jobs')}</span>
                            </div>
                          </button>
                        )}

                        {/* Worker Dashboard Link */}
                        {isWorker && (
                          <NavLink
                            to="/worker/dashboard"
                            onClick={() => setUserMenuOpen(false)}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                            role="menuitem"
                          >
                            <div className="w-8 h-8 rounded-xl bg-amber-500/15 flex items-center justify-center text-amber-500">
                              <Briefcase className="w-4 h-4" />
                            </div>
                            <div className="flex flex-col text-left">
                              <span className="font-semibold">{t('nav.workerDashboard')}</span>
                              <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-normal">{t('nav.manageJobsAvailability', 'Manage jobs & availability')}</span>
                            </div>
                          </NavLink>
                        )}

                        {/* Admin Dashboard & Manage Administrators Links */}
                        {isAdmin && (
                          <>
                            <NavLink
                              to="/admin"
                              onClick={() => setUserMenuOpen(false)}
                              className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                              role="menuitem"
                            >
                              <div className="w-8 h-8 rounded-xl bg-rose-500/15 flex items-center justify-center text-rose-500">
                                <Shield className="w-4 h-4" />
                              </div>
                              <div className="flex flex-col text-left">
                                <span className="font-semibold">{t('nav.adminDashboard')}</span>
                                <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-normal">{t('nav.platformManagement', 'Platform management')}</span>
                              </div>
                            </NavLink>

                            <NavLink
                              to="/admin?tab=admins"
                              onClick={() => setUserMenuOpen(false)}
                              className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/25 transition-colors"
                              role="menuitem"
                            >
                              <div className="w-8 h-8 rounded-xl bg-amber-500/15 flex items-center justify-center text-amber-500">
                                <Shield className="w-4 h-4" />
                              </div>
                              <div className="flex flex-col text-left">
                                <span className="font-semibold">Manage Administrators</span>
                                <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-normal">Team & console privileges</span>
                              </div>
                            </NavLink>
                          </>
                        )}
                      </div>

                      {/* Theme Toggle Section */}
                      <div className="pt-1 mt-1 border-t border-slate-100 dark:border-zinc-800">
                        <button
                          type="button"
                          onClick={() => {
                            toggleTheme()
                          }}
                          className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors text-left cursor-pointer"
                          role="menuitem"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-amber-500/15 flex items-center justify-center text-amber-500">
                              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                            </div>
                            <div className="flex flex-col text-left">
                              <span className="font-semibold text-slate-900 dark:text-zinc-100">{isDark ? 'Light Theme (सफेद)' : 'Dark Theme (नाइट)'}</span>
                              <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-normal">
                                {isDark ? 'Switch to clean white mode' : 'Switch to midnight dark mode'}
                              </span>
                            </div>
                          </div>
                          <Badge variant={isDark ? 'primary' : 'default'} size="sm">
                            {isDark ? 'Dark' : 'Light'}
                          </Badge>
                        </button>
                      </div>

                      {/* Language Switch Section */}
                      <div className="pt-1 mt-1 border-t border-slate-100 dark:border-zinc-800">
                        <button
                          type="button"
                          onClick={() => {
                            toggleLanguage()
                          }}
                          className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors text-left cursor-pointer"
                          role="menuitem"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-amber-500">
                              <Globe className="w-4 h-4" />
                            </div>
                            <div className="flex flex-col text-left">
                              <span className="font-semibold text-slate-900 dark:text-zinc-100">{t('common.language', 'Language')}</span>
                              <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-normal">
                                {language === 'en' ? 'Switch to हिन्दी' : 'Switch to English'}
                              </span>
                            </div>
                          </div>
                          <Badge variant="outline" size="sm" className="font-semibold text-amber-600 dark:text-amber-400 border-slate-200 dark:border-zinc-700">
                            {language === 'en' ? 'EN' : 'हि'}
                          </Badge>
                        </button>
                      </div>

                      {/* Sign Out Section */}
                      <div className="pt-1 mt-1 border-t border-slate-100 dark:border-zinc-800">
                        <button
                          type="button"
                          onClick={() => {
                            setUserMenuOpen(false)
                            void logout()
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/25 transition-colors text-left cursor-pointer"
                          role="menuitem"
                        >
                          <div className="w-8 h-8 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500">
                            <LogOut className="w-4 h-4" />
                          </div>
                          <div className="flex flex-col text-left">
                            <span className="font-semibold">{t('nav.logout')}</span>
                            <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-normal">{t('nav.securelySignOut', 'Securely sign out')}</span>
                          </div>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleBackToLogin}
                    className="text-xs text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white flex items-center gap-1.5 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>{t('common.backToLogin', 'Back to Login')}</span>
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>
                    {t('nav.loginSignup', 'Login / Sign Up')}
                  </Button>
                  <Button variant="primary" size="sm" onClick={() => navigate('/register/worker')}>
                    {t('nav.becomeWorker')}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </nav>
      </header>
      
      <main className="min-h-[calc(100vh-64px)] pb-[max(5rem,calc(4.5rem+env(safe-area-inset-bottom)))] md:pb-0">
        <Outlet />
      </main>
      
      <footer className={`bg-slate-50 dark:bg-zinc-950 text-slate-600 dark:text-zinc-400 border-t border-slate-200 dark:border-zinc-800 pt-14 ${!isAuthenticated ? 'pb-24 sm:pb-28' : 'pb-10'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 lg:gap-8 pb-12 border-b border-slate-200 dark:border-zinc-800">
            {/* Column 1: Brand & Identity (spans 2 cols on lg) */}
            <div className="lg:col-span-2 space-y-4">
              <Link to="/" className="inline-flex items-center gap-3 group">
                <JugnuLogo className="w-10 h-10 group-hover:scale-105 transition-transform" />
                <div>
                  <span className="font-extrabold text-xl tracking-tight text-slate-900 dark:text-white block">
                    {t('app.name')}
                  </span>
                  <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold">
                    {t('app.tagline')}
                  </span>
                </div>
              </Link>
              <p className="text-sm text-slate-600 dark:text-zinc-400 max-w-sm leading-relaxed">
                {t('footer.tagline')}
              </p>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs text-slate-600 dark:text-zinc-400 shadow-xs">
                <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>{t('footer.pilotNotice')}</span>
              </div>
            </div>

            {/* Column 2: Quick Links / Explore */}
            <div>
              <h4 className="font-bold text-slate-900 dark:text-white text-xs tracking-wider uppercase mb-4">
                {t('footer.explore')}
              </h4>
              <ul className="space-y-2.5 text-sm">
                <li>
                  <Link to="/search" className="hover:text-amber-600 dark:hover:text-amber-400 transition-colors flex items-center gap-1.5 group">
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 group-hover:text-amber-500 transition-colors" />
                    <span>{t('nav.search')}</span>
                  </Link>
                </li>
                <li>
                  <Link to="/bookings" className="hover:text-amber-600 dark:hover:text-amber-400 transition-colors flex items-center gap-1.5 group">
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 group-hover:text-amber-500 transition-colors" />
                    <span>{t('nav.bookings')}</span>
                  </Link>
                </li>
                <li>
                  <Link to="/register/worker" className="hover:text-amber-600 dark:hover:text-amber-400 transition-colors flex items-center gap-1.5 group">
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 group-hover:text-amber-500 transition-colors" />
                    <span>{t('nav.becomeWorker')}</span>
                  </Link>
                </li>
                <li>
                  <Link to="/auth" className="hover:text-amber-600 dark:hover:text-amber-400 transition-colors flex items-center gap-1.5 group">
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 group-hover:text-amber-500 transition-colors" />
                    <span>{t('nav.loginSignup', 'Login / Sign Up')}</span>
                  </Link>
                </li>
              </ul>
            </div>

            {/* Column 3: Popular Trades (Direct search filter links) */}
            <div>
              <h4 className="font-bold text-slate-900 dark:text-white text-xs tracking-wider uppercase mb-4">
                {t('nav.categories')}
              </h4>
              <ul className="space-y-2.5 text-sm">
                {CATEGORIES.map(cat => (
                  <li key={cat.id}>
                    <Link
                      to={`/search?category=${cat.id}`}
                      className="hover:text-amber-600 dark:hover:text-amber-400 transition-colors flex items-center gap-1.5"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500/70" />
                      <span>{getCategoryName(cat, language === 'hi' ? 'hi' : 'en')}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Column 4: Localities & Support */}
            <div>
              <h4 className="font-bold text-slate-900 dark:text-white text-xs tracking-wider uppercase mb-4">
                {t('footer.localities')}
              </h4>
              <ul className="space-y-2 text-xs mb-5">
                <li>
                  <Link
                    to="/search?area=251001"
                    className="hover:text-amber-600 dark:hover:text-amber-400 transition-colors flex items-center gap-1.5"
                  >
                    <MapPin className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>251001 - City / New Mandi</span>
                  </Link>
                </li>
                <li>
                  <Link
                    to="/search?area=251002"
                    className="hover:text-amber-600 dark:hover:text-amber-400 transition-colors flex items-center gap-1.5"
                  >
                    <MapPin className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>251002 - Cantt / Civil Lines</span>
                  </Link>
                </li>
              </ul>

              {/* Helpline direct links */}
              <div className="pt-3 border-t border-slate-200 dark:border-zinc-800 space-y-1.5">
                <a
                  href="tel:+919876543210"
                  className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 hover:text-amber-700 font-semibold transition-colors"
                >
                  <Phone className="w-3.5 h-3.5 shrink-0" />
                  <span>{t('footer.emergencyCall')}</span>
                </a>
                <a
                  href="mailto:support@muzaffarnagar-kaamgar.in"
                  className="flex items-center gap-2 text-xs text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  <Mail className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{t('footer.supportEmail')}</span>
                </a>
                <p className="text-[11px] text-slate-500 dark:text-zinc-500">
                  {t('footer.supportHelplineHours')}
                </p>
              </div>
            </div>
          </div>

          {/* Bottom Bar: Copyright, Made with love, Disclaimers */}
          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-zinc-500">
            <p>{t('footer.copyright')}</p>
            <div className="flex items-center gap-1 text-slate-600 dark:text-zinc-400">
              <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500/20" />
              <span>{t('footer.madeWith')}</span>
            </div>
          </div>
        </div>
      </footer>
      
      {/* Sticky Bottom Guest Mode Action Bar (Laptop/Desktop Only: hidden md:block) */}
      {!isAuthenticated && isGuestMode && (
        <div className="hidden md:block sticky bottom-0 z-40 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border-t border-amber-500/30 px-4 py-2.5 shadow-2xl">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300 font-medium truncate">
              <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
              <span className="truncate">{t('guestBar.exploringAsGuest', 'Exploring in Guest Mode')}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleBackToLogin}
                className="text-xs text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white px-2.5 py-1 rounded-lg border border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
              >
                {t('common.exit', 'Exit Guest')}
              </button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate('/login')}
                className="text-xs font-bold shadow-md shadow-amber-500/20"
              >
                {t('nav.loginSignup', 'Sign In / Register')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* URBAN COMPANY STYLE 5-BUTTON MOBILE BOTTOM NAVIGATION DOCK */}
      {/* Mobile only (md:hidden) | Tailored per role: Customer,    */}
      {/* Worker, Admin, Guest                                      */}
      {/* ========================================================= */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-xl border-t border-slate-200/80 dark:border-zinc-800 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] transition-colors px-1 py-1 pb-[max(0.35rem,env(safe-area-inset-bottom))]"
        aria-label="Mobile bottom navigation"
      >
        <div className="grid grid-cols-5 items-center justify-around max-w-md mx-auto">
          {currentBottomTabs.map((tab) => {
            const Icon = tab.icon
            const currentTabParam = new URLSearchParams(location.search).get('tab')
            const targetTabParam = tab.path && tab.path.includes('?') ? new URLSearchParams(tab.path.split('?')[1]).get('tab') : null
            const isTabActive = tab.path
              ? tab.path === '/'
                ? location.pathname === '/' && !location.search
                : targetTabParam
                ? location.pathname === tab.path.split('?')[0] && currentTabParam === targetTabParam
                : location.pathname === tab.path && (!currentTabParam || currentTabParam === 'dashboard' || currentTabParam === 'overview')
              : false

            if (tab.action) {
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={tab.action}
                  className="flex flex-col items-center justify-center py-1 px-0.5 text-slate-500 dark:text-zinc-400 hover:text-amber-500 active:scale-95 transition-all relative cursor-pointer"
                  aria-label={tab.label}
                >
                  <div className="relative p-1 rounded-xl transition-all">
                    <Icon className="w-5 h-5 transition-transform" />
                    {Boolean(tab.badge && tab.badge > 0) && (
                      <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-rose-500 text-[10px] font-extrabold text-white">
                        {tab.badge}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-semibold tracking-tight truncate max-w-[64px] mt-0.5">
                    {tab.label}
                  </span>
                </button>
              )
            }

            return (
              <NavLink
                key={tab.id}
                to={tab.path || '/'}
                onClick={() => {
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
                className={() => {
                  return `flex flex-col items-center justify-center py-1 px-0.5 transition-all relative ${
                    isTabActive
                      ? 'text-amber-600 dark:text-amber-400 font-bold'
                      : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 font-medium'
                  }`
                }}
                aria-label={tab.label}
              >
                {() => {
                  return (
                    <>
                      <div className={`relative p-1 rounded-xl transition-all ${isTabActive ? 'bg-amber-500/15 scale-105' : ''}`}>
                        <Icon className={`w-5 h-5 transition-transform ${isTabActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
                        {Boolean(tab.badge && tab.badge > 0) && (
                          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-rose-500 text-[10px] font-extrabold text-white">
                            {tab.badge}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] tracking-tight truncate max-w-[64px] mt-0.5 leading-tight">
                        {tab.label}
                      </span>
                      {isTabActive && (
                        <span className="w-1 h-1 rounded-full bg-amber-500 mt-0.5 animate-pulse" />
                      )}
                    </>
                  )
                }}
              </NavLink>
            )
          })}
        </div>
      </nav>

      {/* ========================================================= */}
      {/* MOBILE SLIDE-IN SIDEBAR DRAWER (Triggered by ☰ on Left)    */}
      {/* Rendered at ROOT LEVEL with z-[9999] so it is NEVER       */}
      {/* clipped or overridden by header or homepage elements.     */}
      {/* ========================================================= */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[9999] md:hidden" role="dialog" aria-modal="true" aria-label="Mobile Navigation Sidebar">
          {/* Fullscreen Backdrop Blur Overlay */}
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity cursor-pointer animate-fade-in"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />

          {/* Slide-In Aside from Left */}
          <aside className="fixed inset-y-0 left-0 w-[85vw] max-w-xs sm:max-w-sm bg-white dark:bg-zinc-950 shadow-2xl border-r border-slate-200 dark:border-zinc-800 flex flex-col z-[10000] animate-slide-right overflow-y-auto pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
            
            {/* 1. Sidebar Header: Logo & Close X Button */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-zinc-800/80 sticky top-0 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md z-10">
              <div className="flex items-center gap-2.5">
                <JugnuLogo className="w-8 h-8" />
                <div>
                  <span className="font-extrabold text-base text-slate-900 dark:text-zinc-100 block leading-tight">
                    {t('app.name')}
                  </span>
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold tracking-wide">
                    {t('app.tagline')}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="w-9 h-9 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100 bg-slate-100 dark:bg-zinc-800/80 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                aria-label="Close sidebar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 2. User Profile / Guest Card */}
            <div className="p-4 border-b border-slate-100 dark:border-zinc-800/80 bg-slate-50/70 dark:bg-zinc-900/50">
              {isAuthenticated ? (
                <div className="flex items-center gap-3">
                  <Avatar name={user?.name} size="md" src={user?.avatar_url || undefined} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 dark:text-zinc-100 truncate">{user?.name}</p>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 truncate mt-0.5">{user?.phone || 'Logged In'}</p>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      {isAdmin && <Badge variant="danger" size="sm">{t('nav.roleAdmin', 'Admin')}</Badge>}
                      {isWorker && !isAdmin && <Badge variant="success" size="sm">{t('nav.roleWorker', 'Worker')}</Badge>}
                      {!isWorker && !isAdmin && <Badge variant="info" size="sm">{t('nav.roleCustomer', 'Customer')}</Badge>}
                    </div>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          setMobileMenuOpen(false)
                          navigate('/admin?tab=admins')
                        }}
                        className="mt-2 w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-bold hover:bg-amber-500/25 transition-colors cursor-pointer"
                      >
                        <Shield className="w-3.5 h-3.5" />
                        <span>Manage Administrators</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center text-amber-500">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-zinc-100">{t('common.welcome', 'Welcome!')}</p>
                      <p className="text-xs text-slate-500 dark:text-zinc-400">{t('common.guestMode', 'Exploring as Guest')}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => { setMobileMenuOpen(false); navigate('/login') }}
                      className="w-full py-2 text-xs font-bold rounded-xl bg-amber-500 text-slate-950 shadow-xs hover:bg-amber-400 transition-colors cursor-pointer text-center"
                    >
                      {t('nav.loginSignup', 'Login / Register')}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setMobileMenuOpen(false); navigate('/register/worker') }}
                      className="w-full py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-700 transition-colors cursor-pointer text-center"
                    >
                      {t('nav.becomeWorker', 'Earn as Worker')}
                    </button>
                  </div>
                </div>
              )}
            </div>



            {/* 4. PROMINENT APP OPTIONS & PREFERENCES (Requested by User) */}
            <div className="p-3 border-t border-slate-100 dark:border-zinc-800/80 space-y-2.5">
              <p className="px-1 text-[11px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
                {t('nav.preferences', 'Options & Preferences')}
              </p>

              {/* Option 1: Light & Dark Theme Toggle Button */}
              <button
                type="button"
                onClick={toggleTheme}
                className="w-full flex items-center justify-between p-3 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-900/60 hover:bg-slate-100 dark:hover:bg-zinc-850 active:scale-[0.98] transition-all cursor-pointer"
                aria-label="Toggle Light and Dark Theme"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center text-amber-500">
                    {isDark ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-slate-700" />}
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                      {isDark ? 'Light Theme (सफेद थीम)' : 'Dark Theme (नाइट थीम)'}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                      {isDark ? 'सफेद मोड पर स्विच करें' : 'नाइट मोड पर स्विच करें'}
                    </p>
                  </div>
                </div>
                <Badge variant={isDark ? 'primary' : 'default'} size="sm" className="font-bold">
                  {isDark ? 'Dark' : 'Light'}
                </Badge>
              </button>

              {/* Option 2: Language Switcher Button (English / Hindi) */}
              <button
                type="button"
                onClick={toggleLanguage}
                className="w-full flex items-center justify-between p-3 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-900/60 hover:bg-slate-100 dark:hover:bg-zinc-850 active:scale-[0.98] transition-all cursor-pointer"
                aria-label="Toggle Language"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/15 flex items-center justify-center text-blue-500">
                    <Globe className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                      {language === 'en' ? 'हिन्दी में बदलें' : 'Switch to English'}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                      {language === 'en' ? 'English Language Active' : 'हिंदी भाषा सक्रिय है'}
                    </p>
                  </div>
                </div>
                <Badge variant="outline" size="sm" className="font-bold text-amber-600 dark:text-amber-400 border-slate-200 dark:border-zinc-700">
                  {language === 'en' ? 'EN' : 'हिन्दी'}
                </Badge>
              </button>

              {/* Option 3: Help & Support Card (AI Assistant + Helpline) */}
              <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold shadow-xs">
                      <Bot className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">Help & Support (24/7)</p>
                      <p className="text-[10px] text-slate-600 dark:text-zinc-400">सहायता और कस्टमर केयर</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false)
                      openAssistant('customer_booking')
                    }}
                    className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs shadow-xs hover:bg-amber-400 active:scale-95 transition-all cursor-pointer text-center"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>AI Support</span>
                  </button>

                  <a
                    href="tel:+919876543210"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 font-bold text-xs hover:bg-slate-50 dark:hover:bg-zinc-700 active:scale-95 transition-all text-center"
                  >
                    <Phone className="w-3.5 h-3.5 text-emerald-500" />
                    <span>कॉल हेल्पलाइन</span>
                  </a>
                </div>
              </div>

              {/* Option 4: Install Mobile App (PWA) */}
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false)
                  triggerPWAInstall()
                }}
                className="w-full flex items-center justify-between p-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/15 active:scale-[0.98] transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-bold shadow-xs">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                      {t('pwa.installApp', 'Install Mobile App')}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                      फ़ोन में ऐप डाउनलोड करें
                    </p>
                  </div>
                </div>
                <Badge variant="success" size="sm" className="font-bold">
                  Install
                </Badge>
              </button>
            </div>

            {/* 5. Prominent Logout / Back to Login Button */}
            <div className="p-4 border-t border-slate-100 dark:border-zinc-800/80 bg-slate-50/70 dark:bg-zinc-900/60 mt-auto">
              {isAuthenticated ? (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false)
                    void logout()
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 font-bold text-sm border border-rose-500/20 active:scale-[0.98] transition-all cursor-pointer shadow-xs"
                >
                  <LogOut className="w-4.5 h-4.5" />
                  <span>{t('nav.logout', 'Sign Out')} (लॉग आउट)</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false)
                    handleBackToLogin()
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold text-sm border border-amber-500/20 active:scale-[0.98] transition-all cursor-pointer shadow-xs"
                >
                  <ArrowLeft className="w-4.5 h-4.5" />
                  <span>{t('common.backToLogin', 'Back to Login')} (लॉगिन पर जाएं)</span>
                </button>
              )}
            </div>
          </aside>
        </div>
      )}

      <NotificationToast
        notifications={notifications}
        onClose={removeNotification}
      />
      
      <PWAInstallPrompt />
      <AiFloatingTrigger />
      <AiAssistantModal />
    </div>
  )
}
