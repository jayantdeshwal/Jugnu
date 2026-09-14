import { forwardRef, ImgHTMLAttributes, Children, cloneElement } from 'react'
import { cn, getInitials } from '../lib/utils'

export interface AvatarProps extends ImgHTMLAttributes<HTMLImageElement> {
  name?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  shape?: 'circle' | 'square'
  status?: 'online' | 'busy' | 'away' | 'offline'
}

export const Avatar = forwardRef<HTMLImageElement, AvatarProps>(
  ({ className, name, size = 'md', shape = 'circle', status, src, alt, ...props }, ref) => {
    const sizes = {
      xs: 'avatar-xs',
      sm: 'avatar-sm',
      md: 'avatar-md',
      lg: 'avatar-lg',
      xl: 'avatar-xl',
      '2xl': 'avatar-2xl',
    }

    const shapes = {
      circle: 'rounded-full',
      square: 'rounded-xl',
    }

    const fallbackBgColors = [
      'bg-brand-100 text-brand-700',
      'bg-warning-100 text-warning-700',
      'bg-success-100 text-success-700',
      'bg-blue-100 text-blue-700',
      'bg-purple-100 text-purple-700',
      'bg-pink-100 text-pink-700',
    ]

    const getBgColor = (str: string) => {
      let hash = 0
      for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash)
      }
      return fallbackBgColors[Math.abs(hash) % fallbackBgColors.length]
    }

    const initials = name ? getInitials(name) : '?'
    const bgColor = name ? getBgColor(name) : 'bg-surface-200 text-surface-500'

    const statusColors = {
      online: 'bg-success-500',
      busy: 'bg-danger-500',
      away: 'bg-warning-500',
      offline: 'bg-surface-400',
    }

    const statusSizes = {
      xs: 'h-1.5 w-1.5',
      sm: 'h-2 w-2',
      md: 'h-2.5 w-2.5',
      lg: 'h-3 w-3',
      xl: 'h-3.5 w-3.5',
      '2xl': 'h-4 w-4',
    }

    if (src) {
      return (
        <div className={cn('relative inline-flex', className)}>
          <img
            ref={ref}
            src={src}
            alt={alt || name || 'Avatar'}
            className={cn(sizes[size], shapes[shape], 'object-cover', className)}
            {...props}
          />
          {status && (
            <span
              className={cn(
                'absolute bottom-0 right-0 rounded-full border-2 border-semantic-bg-primary',
                statusColors[status],
                statusSizes[size]
              )}
              aria-label={`Status: ${status}`}
            />
          )}
        </div>
      )
    }

    return (
      <div
        ref={ref}
        className={cn(sizes[size], shapes[shape], bgColor, 'flex items-center justify-center font-medium', className)}
        aria-label={name || 'User avatar'}
        {...props}
      >
        {initials}
        {status && (
          <span
            className={cn(
              'absolute bottom-0 right-0 rounded-full border-2 border-semantic-bg-primary',
              statusColors[status],
              statusSizes[size]
            )}
            aria-label={`Status: ${status}`}
          />
        )}
      </div>
    )
  }
)

Avatar.displayName = 'Avatar'

export const AvatarGroup = forwardRef<HTMLDivElement, { className?: string; max?: number; children: React.ReactNode; size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' }>(
  ({ className, max = 5, children, size = 'md' }, ref) => {
    const kids = Children.toArray(children).slice(0, max)
    const overflow = Children.count(children) > max

    const sizeClasses = {
      xs: 'h-6 w-6',
      sm: 'h-8 w-8',
      md: 'h-10 w-10',
      lg: 'h-12 w-12',
      xl: 'h-16 w-16',
    }

    return (
      <div ref={ref} className={cn('flex -space-x-2', className)}>
        {kids.map((child, index) => (
          <span key={index} className="relative z-[auto]">
            {index === kids.length - 1 && overflow ? (
              <span className="relative">
                {cloneElement(child as React.ReactElement, { className: 'ring-2 ring-semantic-bg-primary', size })}
              </span>
            ) : (
              cloneElement(child as React.ReactElement, { className: 'ring-2 ring-semantic-bg-primary', size })
            )}
          </span>
        ))}
        {overflow && (
          <div className={cn('flex items-center justify-center rounded-full bg-surface-100 text-surface-600 font-medium ring-2 ring-semantic-bg-primary', sizeClasses[size])}>
            +{Children.count(children) - max}
          </div>
        )}
      </div>
    )
  }
)

AvatarGroup.displayName = 'AvatarGroup'