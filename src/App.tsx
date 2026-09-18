import { Routes, Route, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LanguageProvider } from './context/LanguageContext'
import { ThemeProvider } from './context/ThemeContext'
import { AuthProvider } from './context/AuthContext'
import { NotificationProvider } from './context/NotificationContext'
import { AiAssistantProvider } from './context/AiAssistantContext'
import Layout from './components/Layout'
import Home from './pages/Home'
import Search from './pages/Search'
import WorkerProfile from './pages/WorkerProfile'
import Booking from './pages/Booking'
import Bookings from './pages/Bookings'
import Login from './pages/Login'
import AuthChoice from './pages/AuthChoice'
import Register from './pages/Register'
import WorkerRegistration from './pages/WorkerRegistration'
import Profile from './pages/Profile'
import AdminDashboard from './pages/AdminDashboard'
import Notifications from './pages/Notifications'
import WorkerDashboard from './pages/WorkerDashboard'
import CategoryPage from './pages/CategoryPage'

import { useState } from 'react'
import { useAuth } from './context/AuthContext'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) {
    return (
      <div className="min-h-screen bg-semantic-bg-primary flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
      </div>
    )
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}

function GuestOrAuthRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  const isGuestMode = typeof window !== 'undefined' && sessionStorage.getItem('kaamgar_guest_mode') === 'true'

  if (isLoading) {
    return (
      <div className="min-h-screen bg-semantic-bg-primary flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
      </div>
    )
  }

  if (isAuthenticated || isGuestMode) {
    return <>{children}</>
  }

  return <Navigate to="/login" replace />
}

function RootRoute() {
  const { isAuthenticated, isLoading } = useAuth()
  const isGuestMode = typeof window !== 'undefined' && sessionStorage.getItem('kaamgar_guest_mode') === 'true'

  if (isLoading) {
    return (
      <div className="min-h-screen bg-semantic-bg-primary flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
      </div>
    )
  }

  if (isAuthenticated || isGuestMode) {
    return <Home />
  }

  return <Navigate to="/login" replace />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<RootRoute />} />
        <Route path="home" element={<GuestOrAuthRoute><Home /></GuestOrAuthRoute>} />
        <Route path="search" element={<GuestOrAuthRoute><Search /></GuestOrAuthRoute>} />
        <Route path="worker/:id" element={<GuestOrAuthRoute><WorkerProfile /></GuestOrAuthRoute>} />
        <Route path="booking/:workerId" element={<ProtectedRoute><Booking /></ProtectedRoute>} />
        <Route path="bookings" element={<ProtectedRoute><Bookings /></ProtectedRoute>} />
        <Route path="auth" element={<Login />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="signup" element={<Navigate to="/register" replace />} />
        <Route path="register/worker" element={<WorkerRegistration />} />
        <Route path="profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="categories" element={<GuestOrAuthRoute><CategoryPage /></GuestOrAuthRoute>} />
        <Route path="category" element={<Navigate to="/categories" replace />} />
        <Route path="notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
        <Route path="alerts" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
        <Route path="worker/dashboard" element={<ProtectedRoute><WorkerDashboard /></ProtectedRoute>} />
        <Route path="admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <NotificationProvider>
            <AiAssistantProvider>
              <AppRoutes />
            </AiAssistantProvider>
          </NotificationProvider>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  )
}

export default App