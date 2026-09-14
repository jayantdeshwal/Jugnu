import { forwardRef, ButtonHTMLAttributes } from 'react'
import { cn } from '../lib/utils'

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean
  variant?: 'default' | 'outline'
  removable?: boolean
  onRemove?: () => void
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

export const Chip = forwardRef<HTMLButtonElement, ChipProps>(
  ({ className, selected, variant = 'default', removable, onRemove, leftIcon, rightIcon, children, disabled, ...props }, ref) => {
    const variants = {
      default: 'bg-brand-50 text-brand-700 border border-brand-200 hover:bg-brand-100 dark:bg-brand-900/30 dark:text-brand-400 dark:border-brand-800 dark:hover:bg-brand-900/50',
      outline: 'bg-surface-100 text-semantic-text-secondary border border-semantic-border-medium hover:bg-surface-200 dark:bg-surface-800 dark:text-surface-300 dark:border-surface-600 dark:hover:bg-surface-700',
    }

    const selectedStyles = 'bg-brand-600 text-white border-brand-600 hover:bg-brand-700 dark:bg-brand-700'

    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium transition-all duration-fast focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:opacity-50',
          selected ? selectedStyles : variants[variant],
          className
        )}
        disabled={disabled}
        aria-pressed={selected}
        {...props}
      >
        {leftIcon && <span className="flex-shrink-0">{leftIcon}</span>}
        <span>{children}</span>
        {rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
        {removable && !disabled && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRemove?.() }}
            className="ml-1 p-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            aria-label="Remove"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </button>
    )
  }
)

Chip.displayName = 'Chip'