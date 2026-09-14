import { HTMLAttributes, forwardRef } from 'react'
import { cn } from '../lib/utils'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'brand' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  dot?: boolean
  removable?: boolean
  onRemove?: () => void
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', size = 'md', dot, removable, onRemove, children, ...props }, ref) => {
    const variants = {
      default: 'badge-default',
      success: 'badge-success',
      warning: 'badge-warning',
      danger: 'badge-danger',
      info: 'badge-info',
      brand: 'badge-brand',
      outline: 'badge-outline',
    }

    const sizes = {
      sm: 'badge-sm',
      md: 'badge-md',
      lg: 'badge-lg',
    }

    return (
      <span
        ref={ref}
        className={cn('badge', variants[variant], sizes[size], removable && 'cursor-pointer pr-6', className)}
        {...props}
      >
        {dot && (
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              variant === 'success' && 'bg-success-500',
              variant === 'warning' && 'bg-warning-500',
              variant === 'danger' && 'bg-danger-500',
              variant === 'info' && 'bg-blue-500',
              variant === 'brand' && 'bg-brand-500',
              variant === 'default' && 'bg-surface-400',
              variant === 'outline' && 'bg-surface-400'
            )}
          />
        )}
        {children}
        {removable && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRemove?.() }}
            className="ml-1.5 -mr-1 p-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            aria-label="Remove"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </span>
    )
  }
)

Badge.displayName = 'Badge'