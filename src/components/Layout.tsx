import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLanguage } from '../context/LanguageContext'
import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../context/NotificationContext'
import { Button, Avatar, Badge } from '@kaamgar/ui'
import { Menu, X, Bell, User, LogOut, Settings, Shield, Home, Search, List, UserPlus, Truck, Star, Briefcase, ChevronDown, Globe } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import NetworkStatus from './NetworkStatus'

export default function Layout() {
  const { t } = useTranslation()
  const { language, toggleLanguage } = useLanguage()
  const { user, isAuthenticated, isWorker, isAdmin, logout, isLoading } = useAuth()
  const { notifications, removeNotification, unreadCount } = useNotifications()
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

  // Close user dropdown when route changes
  useEffect(() => {
    setUserMenuOpen(false)
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
              flex items-start gap-3 w-80 bg-surface-100 rounded-xl shadow-2xl border border-semantic-border-medium p-4 animate-slide-in text-semantic-text-primary
              ${notification.type === 'success' ? 'border-l-4 border-green-500' : ''}
              ${notification.type === 'error' ? 'border-l-4 border-red-500' : ''}
              ${notification.type === 'warning' ? 'border-l-4 border-amber-500' : ''}
              ${notification.type === 'info' ? 'border-l-4 border-blue-500' : ''}
            `}
            role="alert"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-semantic-text-primary">{notification.title}</p>
              {notification.message && <p className="mt-1 text-sm text-semantic-text-secondary">{notification.message}</p>}
            </div>
            <button
              onClick={() => onClose(notification.id)}
              className="flex-shrink-0 text-semantic-text-tertiary hover:text-semantic-text-primary p-1"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    )
  }

  return (
    <>
      <NetworkStatus />
      <header className="sticky top-0 z-40 bg-surface-950/95 backdrop-blur-md border-b border-semantic-border-light">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" aria-label="Main navigation">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-6">
              <NavLink to="/" className="flex items-center gap-2.5" aria-label={t('app.name')}>
                <div className="w-8 h-8 bg-brand-500 text-surface-950 rounded-lg flex items-center justify-center font-bold">
                  <Truck className="w-5 h-5 text-surface-950" />
                </div>
                <span className="font-bold text-lg text-semantic-text-primary hidden sm:block">
                  {t('app.name')}
                </span>
              </NavLink>

              {/* Navigation Items (Distinct per Role) */}
              <div className="hidden md:flex items-center gap-1 bg-surface-200/80 border border-semantic-border-light rounded-xl p-1">
                {currentNavItems.map(({ path, label, icon: Icon, badge }) => (
                  <NavLink
                    key={path}
                    to={path}
                    className={({ isActive }) =>
                      `flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-surface-100 text-brand-400 shadow-sm border border-semantic-border-medium'
                          : 'text-semantic-text-secondary hover:text-semantic-text-primary hover:bg-surface-100'
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
            
            <div className="flex items-center gap-3">
              {/* Language Switcher Button */}
              <button
                onClick={toggleLanguage}
                className="flex items-center gap-1.5 px-2.5 py-1.5 border border-semantic-border-medium rounded-full text-xs font-semibold text-semantic-text-secondary hover:text-semantic-text-primary hover:bg-surface-200 transition-colors"
                aria-label={language === 'en' ? 'Switch to Hindi' : 'Switch to English'}
                title={language === 'en' ? 'हिन्दी में बदलें' : 'Switch to English'}
              >
                <Globe className="w-3.5 h-3.5 text-brand-400" />
                <span className="font-hindi tracking-wide">{language === 'en' ? 'EN' : 'हि'}</span>
              </button>
              
              {isAuthenticated ? (
                /* Professional User Menu Dropdown */
                <div className="relative" ref={userMenuRef}>
                  <button
                    type="button"
                    onClick={() => setUserMenuOpen(prev => !prev)}
                    className={`flex items-center gap-2.5 py-1 pl-1.5 pr-3 rounded-full border transition-all duration-150 ${
                      userMenuOpen
                        ? 'bg-surface-200 border-brand-500/50 shadow-sm'
                        : 'bg-surface-100/80 border-semantic-border-light hover:border-semantic-border-medium hover:bg-surface-200'
                    }`}
                    aria-expanded={userMenuOpen}
                    aria-haspopup="true"
                    aria-label="User profile menu"
                  >
                    <Avatar name={user?.name} size="sm" src={user?.avatar_url || undefined} />
                    <div className="hidden sm:flex flex-col text-left leading-tight">
                      <span className="text-sm font-semibold text-semantic-text-primary truncate max-w-[130px]">
                        {user?.name}
                      </span>
                      <span className={`text-[11px] font-medium leading-none ${
                        isAdmin ? 'text-rose-400' : isWorker ? 'text-emerald-400' : 'text-blue-400'
                      }`}>
                        {isAdmin ? 'Admin' : isWorker ? 'Worker' : 'Customer'}
                      </span>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-semantic-text-tertiary transition-transform duration-200 ${
                      userMenuOpen ? 'rotate-180 text-brand-400' : ''
                    }`} />
                  </button>

                  {/* Dropdown Menu Panel */}
                  {userMenuOpen && (
                    <div
                      className="absolute right-0 mt-2 w-72 bg-surface-100 rounded-2xl shadow-2xl border border-semantic-border-medium py-2 z-50 animate-in"
                      role="menu"
                      aria-orientation="vertical"
                    >
                      {/* User Info Header */}
                      <div className="px-4 py-3 border-b border-semantic-border-light">
                        <div className="flex items-center gap-3">
                          <Avatar name={user?.name} size="md" src={user?.avatar_url || undefined} />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-semantic-text-primary truncate">{user?.name}</p>
                            <p className="text-xs text-semantic-text-secondary truncate mt-0.5">{user?.phone || 'Logged In'}</p>
                            <div className="mt-1.5">
                              {isAdmin && <Badge variant="danger" size="sm">Admin</Badge>}
                              {isWorker && !isAdmin && <Badge variant="success" size="sm">Worker / कारीगर</Badge>}
                              {!isWorker && !isAdmin && <Badge variant="info" size="sm">Customer</Badge>}
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
                          className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-semantic-text-primary hover:bg-surface-200 hover:text-brand-400 transition-colors"
                          role="menuitem"
                        >
                          <div className="w-8 h-8 rounded-lg bg-surface-200 flex items-center justify-center text-brand-400">
                            <User className="w-4 h-4" />
                          </div>
                          <div className="flex flex-col text-left">
                            <span className="font-semibold">{t('nav.profile')}</span>
                            <span className="text-[11px] text-semantic-text-tertiary font-normal">Account & preferences</span>
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
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-emerald-400 hover:bg-emerald-950/25 transition-colors text-left group"
                            role="menuitem"
                          >
                            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-500/25 transition-colors">
                              <Briefcase className="w-4 h-4" />
                            </div>
                            <div className="flex flex-col text-left flex-1">
                              <div className="flex items-center justify-between">
                                <span className="font-semibold">{t('nav.becomeWorker')}</span>
                                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Earn</span>
                              </div>
                              <span className="text-[11px] text-semantic-text-tertiary font-normal">Register to get customer jobs</span>
                            </div>
                          </button>
                        )}

                        {/* Worker Dashboard Link */}
                        {isWorker && (
                          <NavLink
                            to="/worker/dashboard"
                            onClick={() => setUserMenuOpen(false)}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-semantic-text-primary hover:bg-surface-200 hover:text-brand-400 transition-colors"
                            role="menuitem"
                          >
                            <div className="w-8 h-8 rounded-lg bg-brand-500/15 flex items-center justify-center text-brand-400">
                              <Briefcase className="w-4 h-4" />
                            </div>
                            <div className="flex flex-col text-left">
                              <span className="font-semibold">{t('nav.workerDashboard')}</span>
                              <span className="text-[11px] text-semantic-text-tertiary font-normal">Manage jobs & availability</span>
                            </div>
                          </NavLink>
                        )}

                        {/* Admin Dashboard Link */}
                        {isAdmin && (
                          <NavLink
                            to="/admin"
                            onClick={() => setUserMenuOpen(false)}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-semantic-text-primary hover:bg-surface-200 hover:text-brand-400 transition-colors"
                            role="menuitem"
                          >
                            <div className="w-8 h-8 rounded-lg bg-rose-500/15 flex items-center justify-center text-rose-400">
                              <Shield className="w-4 h-4" />
                            </div>
                            <div className="flex flex-col text-left">
                              <span className="font-semibold">{t('nav.adminDashboard')}</span>
                              <span className="text-[11px] text-semantic-text-tertiary font-normal">Platform management</span>
                            </div>
                          </NavLink>
                        )}
                      </div>

                      {/* Sign Out Section */}
                      <div className="pt-1 mt-1 border-t border-semantic-border-light">
                        <button
                          type="button"
                          onClick={() => {
                            setUserMenuOpen(false)
                            void logout()
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-danger-400 hover:bg-red-950/25 transition-colors text-left"
                          role="menuitem"
                        >
                          <div className="w-8 h-8 rounded-lg bg-danger-500/10 flex items-center justify-center text-danger-400">
                            <LogOut className="w-4 h-4" />
                          </div>
                          <div className="flex flex-col text-left">
                            <span className="font-semibold">{t('nav.logout')}</span>
                            <span className="text-[11px] text-semantic-text-tertiary font-normal">Securely sign out</span>
                          </div>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>
                    {t('nav.login')}
                  </Button>
                  <Button variant="primary" size="sm" onClick={() => navigate('/register/worker')}>
                    {t('nav.becomeWorker')}
                  </Button>
                </div>
              )}
              
              <button
                className="md:hidden p-2 rounded-lg text-semantic-text-secondary hover:text-semantic-text-primary hover:bg-surface-200"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-expanded={mobileMenuOpen}
                aria-controls="mobile-menu"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
          
          {/* Mobile Navigation Drawer */}
          {mobileMenuOpen && (
            <div id="mobile-menu" className="md:hidden py-4 border-t border-semantic-border-light bg-surface-950/95 animate-slide-down">
              <div className="flex flex-col gap-2">
                {isAuthenticated ? (
                  <>
                    <div className="px-3 py-2 flex items-center justify-between border-b border-semantic-border-light mb-2">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={user?.name} size="sm" src={user?.avatar_url || undefined} />
                        <div>
                          <p className="text-sm font-semibold text-semantic-text-primary">{user?.name}</p>
                          <p className="text-xs text-semantic-text-secondary">{user?.phone || 'Logged In'}</p>
                        </div>
                      </div>
                      {isAdmin && <Badge variant="danger" size="sm">Admin</Badge>}
                      {isWorker && !isAdmin && <Badge variant="success" size="sm">Worker</Badge>}
                      {!isWorker && !isAdmin && <Badge variant="info" size="sm">Customer</Badge>}
                    </div>

                    {currentNavItems.map(({ path, label, icon: Icon, badge }) => (
                      <NavLink
                        key={path}
                        to={path}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-base font-medium transition-colors ${
                          isActive(path)
                            ? 'bg-surface-200 text-brand-400'
                            : 'text-semantic-text-secondary hover:bg-surface-100 hover:text-semantic-text-primary'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        <span>{label}</span>
                        {Boolean(badge && badge > 0) && (
                          <Badge variant="danger" size="sm" className="ml-auto">
                            {badge}
                          </Badge>
                        )}
                      </NavLink>
                    ))}

                    {/* Profile Link in Mobile */}
                    <NavLink
                      to="/profile"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-base font-medium text-semantic-text-secondary hover:bg-surface-100 hover:text-semantic-text-primary transition-colors"
                    >
                      <User className="w-5 h-5" />
                      <span>{t('nav.profile')}</span>
                    </NavLink>

                    {/* Become a Worker button in Mobile for Customers */}
                    {!isWorker && !isAdmin && (
                      <Button
                        variant="outline"
                        className="w-full justify-start mt-2 border-emerald-500/40 text-emerald-400 hover:bg-emerald-950/20"
                        onClick={() => { setMobileMenuOpen(false); navigate('/register/worker') }}
                      >
                        <Briefcase className="w-5 h-5 mr-2" />
                        {t('nav.becomeWorker')}
                      </Button>
                    )}

                    {/* Sign Out Button in Mobile */}
                    <Button
                      variant="ghost"
                      className="w-full justify-start mt-2 text-danger-400 hover:bg-red-950/20"
                      onClick={() => { setMobileMenuOpen(false); void logout() }}
                    >
                      <LogOut className="w-5 h-5 mr-2" />
                      {t('nav.logout')}
                    </Button>
                  </>
                ) : (
                  <>
                    {currentNavItems.map(({ path, label, icon: Icon }) => (
                      <NavLink
                        key={path}
                        to={path}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-base font-medium transition-colors ${
                          isActive(path)
                            ? 'bg-surface-200 text-brand-400'
                            : 'text-semantic-text-secondary hover:bg-surface-100 hover:text-semantic-text-primary'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        <span>{label}</span>
                      </NavLink>
                    ))}
                    <div className="pt-4 border-t border-semantic-border-light flex flex-col gap-2">
                      <Button variant="outline" className="w-full justify-start" onClick={() => { setMobileMenuOpen(false); navigate('/login') }}>
                        <User className="w-5 h-5 mr-2" />
                        {t('nav.login')}
                      </Button>
                      <Button variant="primary" className="w-full justify-start" onClick={() => { setMobileMenuOpen(false); navigate('/register/worker') }}>
                        <Briefcase className="w-5 h-5 mr-2" />
                        {t('nav.becomeWorker')}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </nav>
      </header>
      
      <main className="min-h-[calc(100vh-64px)]">
        <Outlet />
      </main>
      
      <footer className="bg-surface-950 text-semantic-text-secondary border-t border-semantic-border-light">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                  <Truck className="w-5 h-5 text-white" />
                </div>
                <span className="font-bold text-xl text-white">{t('app.name')}</span>
              </div>
              <p className="text-sm">{t('footer.madeWith')}</p>
            </div>
            <div>
              <h4 className="font-medium text-white mb-3">{t('footer.about')}</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">{t('footer.contact')}</a></li>
                <li><a href="#" className="hover:text-white transition-colors">{t('footer.privacy')}</a></li>
                <li><a href="#" className="hover:text-white transition-colors">{t('footer.terms')}</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-white mb-3">{t('nav.categories')}</h4>
              <ul className="space-y-2 text-sm">
                <li>{t('categories.electrician')}</li>
                <li>{t('categories.plumber')}</li>
                <li>{t('categories.carpenter')}</li>
                <li>{t('categories.ac')}</li>
                <li>{t('categories.painter')}</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-white mb-3">Muzaffarnagar</h4>
              <ul className="space-y-2 text-sm">
                <li>251001 - City</li>
                <li>251002 - Cantt</li>
                <li>New Mandi</li>
                <li>Civil Lines</li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-800 text-center text-sm">
            {t('footer.copyright')}
          </div>
        </div>
      </footer>
      
      <NotificationToast
        notifications={notifications}
        onClose={removeNotification}
      />
    </>
  )
}
