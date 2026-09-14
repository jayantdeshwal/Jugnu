import { createPortal } from 'react-dom'
import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'

export function Button({ variant = 'primary', size = 'md', loading, className = '', children, disabled, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg'; loading?: boolean }) {
  const variants: Record<Variant, string> = {
    primary: 'bg-brand-500 text-surface-950 font-semibold hover:bg-brand-400 active:bg-brand-600 shadow-sm',
    secondary: 'bg-surface-200 text-semantic-text-primary border border-semantic-border-medium hover:bg-surface-300 active:bg-surface-400',
    outline: 'border border-brand-500 text-brand-400 hover:bg-brand-500/10 active:bg-brand-500/20',
    ghost: 'text-semantic-text-secondary hover:text-semantic-text-primary hover:bg-surface-200 active:bg-surface-300',
    danger: 'bg-red-600 text-white hover:bg-red-500 active:bg-red-700 shadow-sm',
  }
  const sizes = { sm: 'px-2.5 py-1 text-xs', md: 'px-3.5 py-2 text-xs sm:text-sm', lg: 'px-4.5 py-2.5 text-sm' }
  return <button className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-semantic-bg-primary disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`} disabled={disabled || loading} {...props}>{loading ? 'Loading...' : children}</button>
}

export function Input({ label, error, helperText, leftIcon, rightIcon, className = '', id, ...props }: InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string; helperText?: string; leftIcon?: ReactNode; rightIcon?: ReactNode }) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className="w-full">
      {label && <label className="block text-xs font-medium text-semantic-text-secondary mb-1" htmlFor={inputId}>{label}</label>}
      <div className="relative">
        {leftIcon && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-semantic-text-tertiary">{leftIcon}</span>}
        <input id={inputId} className={`w-full rounded-lg bg-surface-200 border border-semantic-border-medium px-3.5 py-2 text-xs sm:text-sm text-semantic-text-primary placeholder:text-semantic-text-tertiary focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-colors ${leftIcon ? 'pl-9' : ''} ${rightIcon ? 'pr-9' : ''} ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''} ${className}`} aria-invalid={Boolean(error)} {...props} />
        {rightIcon && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-semantic-text-tertiary">{rightIcon}</span>}
      </div>
      {error ? <p className="mt-1 text-xs text-red-400">{error}</p> : helperText && <p className="mt-1 text-xs text-semantic-text-tertiary">{helperText}</p>}
    </div>
  )
}

export function Card({ className = '', children, ...props }: HTMLAttributes<HTMLDivElement> & { padding?: 'none' | 'sm' | 'md' | 'lg'; variant?: string; hover?: boolean }) {
  return <div className={`rounded-xl border border-semantic-border-light bg-surface-100 text-semantic-text-primary shadow-sm ${className}`} {...props}>{children}</div>
}
export function CardHeader(props: HTMLAttributes<HTMLDivElement>) { return <div className={`mb-3 ${props.className || ''}`} {...props} /> }
export function CardTitle(props: HTMLAttributes<HTMLHeadingElement>) { return <h3 className={`text-base font-semibold text-semantic-text-primary ${props.className || ''}`} {...props} /> }
export function CardDescription(props: HTMLAttributes<HTMLParagraphElement>) { return <p className={`mt-0.5 text-xs text-semantic-text-secondary ${props.className || ''}`} {...props} /> }
export function CardContent(props: HTMLAttributes<HTMLDivElement>) { return <div {...props} /> }
export function CardFooter(props: HTMLAttributes<HTMLDivElement>) { return <div className={`mt-4 border-t border-semantic-border-light pt-4 ${props.className || ''}`} {...props} /> }

export function Avatar({ src, name, alt, size = 'md', className = '' }: { src?: string | null; name?: string; alt?: string; size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'; className?: string }) {
  const sizes = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-12 w-12 text-base', xl: 'h-16 w-16 text-lg', '2xl': 'h-20 w-20 text-xl' }
  const initials = name?.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() || '?'
  return src ? <img className={`rounded-full object-cover ${sizes[size]} ${className}`} src={src} alt={alt || name || 'Avatar'} /> : <span className={`inline-flex items-center justify-center rounded-full bg-brand-500/20 border border-brand-500/40 font-semibold text-brand-300 ${sizes[size]} ${className}`}>{initials}</span>
}
export function AvatarGroup({ children, className = '' }: { children: ReactNode; className?: string }) { return <div className={`flex -space-x-2 ${className}`}>{children}</div> }

export function Badge({ variant = 'default', size = 'md', dot, className = '', children, ...props }: HTMLAttributes<HTMLSpanElement> & { variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'outline'; size?: 'sm' | 'md' | 'lg'; dot?: boolean }) {
  const colors = {
    default: 'bg-surface-200 text-semantic-text-secondary border border-semantic-border-light',
    success: 'bg-green-950/70 text-green-300 border border-green-700/50',
    warning: 'bg-amber-950/70 text-amber-300 border border-amber-700/50',
    danger: 'bg-red-950/70 text-red-300 border border-red-700/50',
    info: 'bg-blue-950/70 text-blue-300 border border-blue-700/50',
    primary: 'bg-brand-950/70 text-brand-300 border border-brand-700/50',
    outline: 'border border-semantic-border-medium text-semantic-text-secondary bg-transparent',
  }
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-sm px-3 py-1.5',
  }
  return <span className={`inline-flex items-center rounded-full font-medium ${sizeClasses[size]} ${colors[variant]} ${className}`} {...props}>{dot && <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current" />}{children}</span>
}

export function Chip({ selected, variant, className = '', children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean; variant?: string }) {
  return <button className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors ${selected ? 'border-brand-500 bg-brand-500 text-surface-950' : 'border-semantic-border-medium bg-surface-200 text-semantic-text-secondary hover:text-semantic-text-primary'} ${className}`} {...props}>{children}</button>
}

export function RatingStars({ rating, showValue = false, className = '', interactive, onChange, size }: { rating: number; showValue?: boolean; className?: string; interactive?: boolean; onChange?: (rating: number) => void; size?: string }) {
  const stars = <>{'★'.repeat(Math.round(rating))}{'☆'.repeat(5 - Math.round(rating))}</>
  return interactive ? <button type="button" onClick={() => onChange?.(rating)} className={`inline-flex items-center gap-1 text-amber-400 ${className}`} aria-label={`${rating} out of 5 stars`}>{stars}{showValue && <span className="text-sm text-semantic-text-secondary">{rating.toFixed(1)}</span>}</button> : <span className={`inline-flex items-center gap-1 text-amber-400 ${className}`} aria-label={`${rating} out of 5 stars`}>{stars}{showValue && <span className="text-sm text-semantic-text-secondary">{rating.toFixed(1)}</span>}</span>
}

export function Modal({ isOpen, onClose, title, description, children, size = 'md' }: { isOpen: boolean; onClose: () => void; title?: string; description?: string; children: ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl' | 'full' }) {
  if (!isOpen || typeof document === 'undefined') return null
  const widths = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-xl', full: 'max-w-4xl' }
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in" role="dialog" aria-modal="true" onMouseDown={onClose}>
      <div className={`w-full rounded-2xl bg-surface-100 border border-semantic-border-medium p-6 shadow-2xl text-semantic-text-primary ${widths[size]}`} onMouseDown={(event) => event.stopPropagation()}>
        {title && (
          <div className="mb-4 flex items-center justify-between border-b border-semantic-border-light pb-3">
            <div>
              <h2 className="text-xl font-bold text-semantic-text-primary">{title}</h2>
              {description && <p className="mt-1 text-sm text-semantic-text-secondary">{description}</p>}
            </div>
            <button className="text-2xl text-semantic-text-tertiary hover:text-semantic-text-primary transition-colors p-1" onClick={onClose} aria-label="Close">×</button>
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body
  )
}

export function ConfirmModal({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', cancelText = 'Cancel', loading }: { isOpen: boolean; onClose: () => void; onConfirm: () => void; title: string; message: string; confirmText?: string; cancelText?: string; loading?: boolean }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <p className="mb-6 text-semantic-text-secondary text-sm">{message}</p>
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onClose}>{cancelText}</Button>
        <Button onClick={onConfirm} loading={loading}>{confirmText}</Button>
      </div>
    </Modal>
  )
}

export function cn(...values: Array<string | false | null | undefined>) { return values.filter(Boolean).join(' ') }
