import { cn } from '../lib/utils'
import { Link } from 'react-router-dom'

export interface SkeletonProps {
  className?: string
  variant?: 'text' | 'circular' | 'rectangular'
  width?: string | number
  height?: string | number
  animation?: 'pulse' | 'wave' | 'none'
}

export function Skeleton({ className, variant = 'text', width, height, animation = 'pulse', ...props }: SkeletonProps) {
  const animations = {
    pulse: 'animate-pulse-soft',
    wave: 'animate-shimmer bg-gradient-to-r from-surface-200 via-surface-100 to-surface-200 bg-[length:200%_100%]',
    none: '',
  }

  const baseStyles = 'rounded bg-surface-200 dark:bg-surface-700'

  const variantStyles = {
    text: 'h-4 w-full',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
  }

  return (
    <div
      className={cn(baseStyles, variantStyles[variant], animations[animation], className)}
      style={{ width, height }}
      {...props}
    />
  )
}

export function SkeletonText({ lines = 3, className, ...props }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} variant="text" width={i === lines - 1 ? '60%' : '100%'} {...props} />
      ))}
    </div>
  )
}

export function SkeletonCard({ className, ...props }: { className?: string }) {
  return (
    <div className={cn('card p-5 space-y-4', className)} {...props}>
      <div className="flex items-center gap-4">
        <Skeleton variant="circular" width={48} height={48} />
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" width="40%" />
          <Skeleton variant="text" width="30%" />
        </div>
      </div>
      <SkeletonText lines={3} />
      <div className="flex items-center gap-2">
        <Skeleton variant="text" width="80px" height="28px" />
        <Skeleton variant="text" width="60px" height="28px" />
      </div>
    </div>
  )
}

export function SkeletonWorkerCard({ className, ...props }: { className?: string }) {
  return (
    <Link to="#" className={cn('card-hover group p-5', className)} {...props}>
      <div className="flex items-start gap-4">
        <Skeleton variant="circular" width={48} height={48} />
        <div className="flex-1 min-w-0 space-y-2">
          <Skeleton variant="text" width="40%" />
          <div className="flex items-center gap-3">
            <Skeleton variant="text" width="80px" />
            <Skeleton variant="text" width="70px" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton variant="rectangular" width="60px" height="20px" />
            <Skeleton variant="text" width="50px" />
          </div>
          <Skeleton variant="text" width="60%" />
        </div>
      </div>
      <div className="mt-4 pt-4 border-t border-semantic-border-light flex items-center justify-between">
        <Skeleton variant="text" width="100px" />
        <Skeleton variant="rectangular" width="80px" height="36px" />
      </div>
    </Link>
  )
}