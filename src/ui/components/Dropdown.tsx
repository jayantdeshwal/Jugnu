import { Fragment, ReactNode, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronDown } from 'lucide-react'
import { cn } from '../lib/utils'
import { Input, Button } from '../index'

export interface DropdownItem {
  label: string
  onClick: () => void
  icon?: ReactNode
  disabled?: boolean
  danger?: boolean
  divider?: boolean
  labelOnly?: boolean
}

export interface DropdownProps {
  trigger: ReactNode
  items: DropdownItem[]
  align?: 'left' | 'right'
  offset?: number
  className?: string
}

export function Dropdown({ trigger, items, align = 'right', offset = 4, className }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        if (triggerRef.current && !triggerRef.current.contains(event.target as Node)) {
          setIsOpen(false)
        }
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
        triggerRef.current?.focus()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  return (
    <Fragment>
      <span ref={triggerRef} className="inline-block">{trigger}</span>
      <AnimatePresence>
        {isOpen && createPortal(
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -8 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            ref={dropdownRef}
            className={cn(
              'fixed z-50 min-w-[180px] bg-semantic-bg-elevated rounded-xl shadow-lg border border-semantic-border-light py-1.5',
              align === 'right' ? 'right-0' : 'left-0',
              className
            )}
            role="menu"
            style={{
              transformOrigin: align === 'right' ? 'top right' : 'top left',
            }}
          >
            {items.map((item, index) => (
              <Fragment key={index}>
                {item.divider && index > 0 && (
                  <div className="h-px bg-semantic-border-light my-1" role="separator" />
                )}
                {item.labelOnly ? (
                  <div className="px-3 py-1.5 text-xs font-medium text-semantic-text-tertiary uppercase tracking-wider">
                    {item.label}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => { item.onClick(); setIsOpen(false) }}
                    disabled={item.disabled}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-2 text-sm text-semantic-text-primary',
                      'hover:bg-surface-100 dark:hover:bg-surface-800',
                      'focus:outline-none focus:bg-surface-100 dark:focus:bg-surface-800',
                      item.disabled && 'opacity-50 cursor-not-allowed',
                      item.danger && 'text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-900/20'
                    )}
                    role="menuitem"
                  >
                    {item.icon && <span className="flex-shrink-0 w-5 h-5">{item.icon}</span>}
                    {item.label}
                  </button>
                )}
              </Fragment>
            ))}
          </motion.div>
        , document.body)}
      </AnimatePresence>
    </Fragment>
  )
}

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
  icon?: ReactNode
}

export interface SelectProps {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  disabled?: boolean
  className?: string
  label?: string
  error?: string
  searchable?: boolean
}

export function Select({ value, onChange, options, placeholder, disabled, className, label, error, searchable }: SelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const selectRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const filteredOptions = searchable
    ? options.filter(opt => opt.label.toLowerCase().includes(searchQuery.toLowerCase()))
    : options

  const selectedOption = options.find(opt => opt.value === value)

  const renderOptions = () => {
    if (filteredOptions.length === 0) {
      return (
        <div className="px-3 py-4 text-center text-sm text-semantic-text-tertiary">
          No options found
        </div>
      )
    }

    return (
      <>
        {filteredOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => { onChange(option.value); setIsOpen(false) }}
            disabled={option.disabled}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-2 text-sm text-left',
              'hover:bg-surface-100 dark:hover:bg-surface-800',
              'focus:outline-none focus:bg-surface-100 dark:focus:bg-surface-800',
              option.disabled && 'opacity-50 cursor-not-allowed',
              value === option.value && 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400'
            )}
            role="option"
            aria-selected={value === option.value}
          >
            {option.icon && <span className="flex-shrink-0 w-5 h-5">{option.icon}</span>}
            {option.label}
            {value === option.value && (
              <svg className="ml-auto w-4 h-4 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
        ))}
      </>
    )
  }

  return (
    <div ref={selectRef} className={cn('relative', className)}>
      {label && <label className="label">{label}</label>}
      <div className="relative">
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={cn(
            'input w-full text-left',
            'justify-between',
            'pr-10',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
        >
          <span className={cn('truncate', value ? 'text-semantic-text-primary' : 'text-semantic-text-tertiary')}>
            {selectedOption?.label || placeholder}
          </span>
          <svg className={cn('absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-semantic-text-tertiary transition-transform', isOpen && 'rotate-180')} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {error && (
          <p className="mt-1.5 text-sm text-danger-600" role="alert">{error}</p>
        )}

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="fixed z-50 mt-1 w-full max-h-60 overflow-auto bg-semantic-bg-elevated rounded-lg shadow-lg border border-semantic-border-light py-1"
              role="listbox"
            >
              {searchable && (
                <div className="p-2 border-b border-semantic-border-light">
                  <Input
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    leftIcon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>}
                    className="bg-surface-100 border-semantic-border-light"
                  />
                </div>
              )}
              {renderOptions()}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}