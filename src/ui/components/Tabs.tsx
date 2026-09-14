import { createContext, useContext, useState, ReactNode, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '../lib/utils'

interface TabsContextValue {
  value: string
  onChange: (value: string) => void
  variant: 'line' | 'enclosed' | 'soft'
  tabsRef: React.RefObject<HTMLDivElement>
  registerTab: (value: string, ref: HTMLButtonElement | null) => void
  unregisterTab: (value: string) => void
}

const TabsContext = createContext<TabsContextValue | null>(null)

export function TabsProvider({ children, defaultValue, value, onChange, variant = 'line', className }: {
  children: ReactNode
  defaultValue: string
  value?: string
  onChange?: (value: string) => void
  variant?: 'line' | 'enclosed' | 'soft'
  className?: string
}) {
  const [activeValue, setActiveValue] = useState(value || defaultValue)
  const tabsRef = useRef<HTMLDivElement>(null)
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map())

  const controlled = value !== undefined
  const currentValue = controlled ? value : activeValue

  const handleChange = (newValue: string) => {
    if (!controlled) setActiveValue(newValue)
    onChange?.(newValue)
  }

  const registerTab = (tabValue: string, ref: HTMLButtonElement | null) => {
    if (ref) tabRefs.current.set(tabValue, ref)
  }

  const unregisterTab = (tabValue: string) => {
    tabRefs.current.delete(tabValue)
  }

  useEffect(() => {
    const tabRef = tabRefs.current.get(currentValue)
    if (tabRef && tabsRef.current) {
      const rect = tabRef.getBoundingClientRect()
      const containerRect = tabsRef.current.getBoundingClientRect()
    }
  }, [currentValue])

  return (
    <TabsContext.Provider value={{
      value: currentValue,
      onChange: handleChange,
      variant,
      tabsRef,
      registerTab,
      unregisterTab,
    }}>
      <div className={cn(className)} data-tabs>
        {children}
      </div>
    </TabsContext.Provider>
  )
}

export function useTabs() {
  const context = useContext(TabsContext)
  if (!context) {
    throw new Error('Tabs components must be used within TabsProvider')
  }
  return context
}

export function TabList({ children, className, ariaLabel }: { children: ReactNode; className?: string; ariaLabel?: string }) {
  const { variant } = useTabs()
  return (
    <div role="tablist" aria-label={ariaLabel} className={cn('flex gap-1', className)}>
      {children}
    </div>
  )
}

export function Tab({ value, children, disabled, className }: { value: string; children: ReactNode; disabled?: boolean; className?: string }) {
  const { value: activeValue, onChange, variant } = useTabs()
  const isActive = activeValue === value
  const tabRef = useRef<HTMLButtonElement>(null)
  const { registerTab, unregisterTab } = useTabs()

  useEffect(() => {
    registerTab(value, tabRef.current)
    return () => unregisterTab(value)
  }, [value, registerTab, unregisterTab])

  const variants = {
    line: isActive
      ? 'text-brand-600 dark:text-brand-400'
      : 'text-semantic-text-secondary hover:text-semantic-text-primary',
    enclosed: isActive
      ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 shadow-sm'
      : 'text-semantic-text-secondary hover:text-semantic-text-primary hover:bg-surface-100 dark:hover:bg-surface-800',
    soft: isActive
      ? 'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400'
      : 'text-semantic-text-secondary hover:text-semantic-text-primary',
  }

  return (
    <button
      ref={tabRef}
      role="tab"
      aria-selected={isActive}
      aria-controls={`panel-${value}`}
      id={`tab-${value}`}
      onClick={() => !disabled && onChange(value)}
      disabled={disabled}
      className={cn(
        'relative px-4 py-2 text-sm font-medium rounded-md transition-all duration-fast',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
        disabled && 'opacity-50 cursor-not-allowed',
        variants[variant],
        className
      )}
    >
      {children}
      {isActive && variant === 'line' && (
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: '100%' }}
          className="absolute bottom-0 left-0 h-0.5 bg-brand-500 rounded-full"
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        />
      )}
    </button>
  )
}

export function TabPanels({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn(className)}>{children}</div>
}

export function TabPanel({ value, children, className }: { value: string; children: ReactNode; className?: string }) {
  const { value: activeValue } = useTabs()
  const isActive = activeValue === value

  if (!isActive) return null

  return (
    <div
      role="tabpanel"
      id={`panel-${value}`}
      aria-labelledby={`tab-${value}`}
      className={cn('animate-in', className)}
    >
      {children}
    </div>
  )
}

export function Tabs({ children, defaultValue, value, onChange, variant = 'line', className }: {
  children: ReactNode
  defaultValue: string
  value?: string
  onChange?: (value: string) => void
  variant?: 'line' | 'enclosed' | 'soft'
  className?: string
}) {
  return (
    <TabsProvider defaultValue={defaultValue} value={value} onChange={onChange} variant={variant} className={className}>
      {children}
    </TabsProvider>
  )
}