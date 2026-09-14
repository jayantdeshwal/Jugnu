import { useEffect, useState } from 'react'
import { createContext, useContext, ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react'
import { Button } from './Button'
import { cn } from '../lib/utils'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  type: ToastType
  title: string
  message?: string
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
}

interface ToastContextType {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => string
  removeToast: (id: string) => void
  clearToasts: () => void
  success: (title: string, message?: string, duration?: number) => string
  error: (title: string, message?: string, duration?: number) => string
  warning: (title: string, message?: string, duration?: number) => string
  info: (title: string, message?: string, duration?: number) => string
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = (toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9)
    const newToast = { ...toast, id }
    setToasts(prev => [...prev, newToast])

    if (toast.duration !== 0) {
      setTimeout(() => removeToast(id), toast.duration ?? 5000)
    }

    return id
  }

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  const clearToasts = () => {
    setToasts([])
  }

  const helpers = {
    success: (title: string, message?: string, duration?: number) => addToast({ type: 'success', title, message, duration }),
    error: (title: string, message?: string, duration?: number) => addToast({ type: 'error', title, message, duration: duration ?? 8000 }),
    warning: (title: string, message?: string, duration?: number) => addToast({ type: 'warning', title, message, duration }),
    info: (title: string, message?: string, duration?: number) => addToast({ type: 'info', title, message, duration }),
  }

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, clearToasts, ...helpers }}>
      {children}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

function ToastContainer({ toasts, onClose }: { toasts: Toast[]; onClose: (id: string) => void }) {
  if (toasts.length === 0) return null

  const icons = {
    success: <CheckCircle className="w-5 h-5 text-success-500" />,
    error: <AlertCircle className="w-5 h-5 text-danger-500" />,
    warning: <AlertTriangle className="w-5 h-5 text-warning-500" />,
    info: <Info className="w-5 h-5 text-blue-500" />,
  }

  const borders = {
    success: 'border-l-4 border-success-500',
    error: 'border-l-4 border-danger-500',
    warning: 'border-l-4 border-warning-500',
    info: 'border-l-4 border-blue-500',
  }

  return (
    <AnimatePresence>
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2" role="region" aria-label="Notifications">
        {toasts.map(toast => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 100, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={cn(
              'flex items-start gap-3 w-80 bg-semantic-bg-elevated rounded-lg shadow-xl border p-4',
              borders[toast.type]
            )}
            role="alert"
          >
            <div className="flex-shrink-0 mt-0.5">{icons[toast.type]}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-semantic-text-primary">{toast.title}</p>
              {toast.message && <p className="mt-1 text-sm text-semantic-text-secondary">{toast.message}</p>}
              {toast.action && (
                <Button variant="ghost" size="sm" className="mt-2" onClick={toast.action.onClick}>
                  {toast.action.label}
                </Button>
              )}
            </div>
            <button
              onClick={() => onClose(toast.id)}
              className="flex-shrink-0 text-semantic-text-tertiary hover:text-semantic-text-primary p-1 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        ))}
      </div>
    </AnimatePresence>
  )
}