import { forwardRef } from 'react'
import { Star } from 'lucide-react'
import { cn } from '../lib/utils'

export interface RatingStarsProps {
  rating: number
  max?: number
  size?: 'sm' | 'md' | 'lg'
  interactive?: boolean
  onChange?: (rating: number) => void
  showValue?: boolean
  className?: string
  readonly?: boolean
}

export const RatingStars = forwardRef<HTMLDivElement, RatingStarsProps>(
  ({ rating, max = 5, size = 'md', interactive = false, onChange, showValue = false, className, readonly = false }, ref) => {
    const sizes = {
      sm: 'w-4 h-4',
      md: 'w-5 h-5',
      lg: 'w-6 h-6',
    }

    const starSize = sizes[size]
    const fullStars = Math.floor(rating)
    const hasHalfStar = rating % 1 >= 0.5

    const handleClick = (value: number) => {
      if (interactive && !readonly && onChange) {
        onChange(value)
      }
    }

    const handleKeyDown = (e: React.KeyboardEvent, value: number) => {
      if (!interactive || readonly) return

      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowUp':
          e.preventDefault()
          onChange?.(Math.min(value + 1, max))
          break
        case 'ArrowLeft':
        case 'ArrowDown':
          e.preventDefault()
          onChange?.(Math.max(value - 1, 1))
          break
        case 'Enter':
        case ' ':
          e.preventDefault()
          onChange?.(value)
          break
      }
    }

    return (
      <div ref={ref} className={cn('inline-flex items-center gap-0.5', className)} role={interactive ? 'radiogroup' : 'img'} aria-label={interactive ? 'Rating' : `${rating} out of ${max} stars`} aria-readonly={readonly || !interactive}>
        {Array.from({ length: max }, (_, i) => {
          const starValue = i + 1
          const isFull = starValue <= fullStars
          const isHalf = starValue === fullStars + 1 && hasHalfStar

          return (
            <button
              key={i}
              type="button"
              onClick={() => handleClick(starValue)}
              onKeyDown={(e) => handleKeyDown(e, starValue)}
              disabled={!interactive || readonly}
              tabIndex={interactive && !readonly ? 0 : -1}
              role="radio"
              aria-checked={starValue === rating}
              aria-valuenow={starValue}
              aria-valuemin={1}
              aria-valuemax={max}
              className={cn(
                'flex items-center justify-center p-0.5 rounded transition-transform duration-100',
                interactive && !readonly && 'hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1',
                !interactive && 'cursor-default'
              )}
              aria-label={`${starValue} star${starValue > 1 ? 's' : ''}`}
            >
              <Star
                className={cn(starSize, isFull || isHalf ? 'text-amber-500 fill-current' : 'text-surface-300 dark:text-surface-600')}
                fill={isFull || isHalf ? 'currentColor' : 'none'}
                stroke="currentColor"
                aria-hidden="true"
              />
              {isHalf && (
                <Star
                  className={cn(starSize, 'absolute', 'text-amber-500 fill-current')}
                  fill="currentColor"
                  stroke="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  style={{ clipPath: 'polygon(0 0, 50% 0, 50% 100%, 0 100%)' }}
                />
              )}
            </button>
          )
        })}
        {showValue && (
          <span className="ml-2 text-sm font-medium text-semantic-text-secondary">
            {rating.toFixed(1)}
          </span>
        )}
      </div>
    )
  }
)

RatingStars.displayName = 'RatingStars'