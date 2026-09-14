import { Routes, Route, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LanguageProvider } from './context/LanguageContext'
import { AuthProvider } from './context/AuthContext'
import { NotificationProvider } from './context/NotificationContext'
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

function AppRoutes() {
  const { t } = useTranslation()
  
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="search" element={<Search />} />
        <Route path="worker/:id" element={<WorkerProfile />} />
        <Route path="booking/:workerId" element={<Booking />} />
        <Route path="bookings" element={<Bookings />} />
        <Route path="auth" element={<AuthChoice />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="signup" element={<Navigate to="/register" replace />} />
        <Route path="register/worker" element={<WorkerRegistration />} />
        <Route path="profile" element={<Profile />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="worker/dashboard" element={<WorkerDashboard />} />
        <Route path="admin" element={<AdminDashboard />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <NotificationProvider>
          <AppRoutes />
        </NotificationProvider>
      </AuthProvider>
    </LanguageProvider>
  )
}

export default App