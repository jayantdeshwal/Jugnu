import { createPortal } from 'react-dom'
import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'

export function Button({ variant = 'primary', size = 'md', loading, className = '', children, disabled, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg'; loading?: boolean }) {
  const variants: Record<Variant, string> = {
    primary: 'bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 active:bg-amber-600 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5',
    secondary: 'bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 border border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-700 active:bg-slate-200 shadow-xs transition-all',
    outline: 'border border-amber-500/80 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 active:bg-amber-500/20 transition-all',
    ghost: 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-zinc-800/80 transition-all',
    danger: 'bg-rose-600 text-white hover:bg-rose-500 active:bg-rose-700 shadow-sm transition-all',
  }
  const sizes = { sm: 'px-2.5 py-1 text-xs', md: 'px-3.5 py-2 text-xs sm:text-sm', lg: 'px-4.5 py-2.5 text-sm' }
  return <button className={`inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-semantic-bg-primary disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`} disabled={disabled || loading} {...props}>{loading ? 'Loading...' : children}</button>
}

export function Input({ label, error, helperText, leftIcon, rightIcon, className = '', id, ...props }: InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string; helperText?: string; leftIcon?: ReactNode; rightIcon?: ReactNode }) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className="w-full">
      {label && <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5" htmlFor={inputId}>{label}</label>}
      <div className="relative">
        {leftIcon && <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500">{leftIcon}</span>}
        <input id={inputId} className={`w-full rounded-xl bg-white dark:bg-zinc-900/90 border border-slate-200 dark:border-zinc-700 px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 shadow-xs transition-all ${leftIcon ? 'pl-10' : ''} ${rightIcon ? 'pr-10' : ''} ${error ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20' : ''} ${className}`} aria-invalid={Boolean(error)} {...props} />
        {rightIcon && <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500">{rightIcon}</span>}
      </div>
      {error ? <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-400 font-medium">{error}</p> : helperText && <p className="mt-1.5 text-xs text-slate-500 dark:text-zinc-400">{helperText}</p>}
    </div>
  )
}

export function Card({ className = '', children, ...props }: HTMLAttributes<HTMLDivElement> & { padding?: 'none' | 'sm' | 'md' | 'lg'; variant?: string; hover?: boolean }) {
  return <div className={`rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.04)] dark:shadow-none transition-all ${className}`} {...props}>{children}</div>
}
export function CardHeader(props: HTMLAttributes<HTMLDivElement>) { return <div className={`mb-3 ${props.className || ''}`} {...props} /> }
export function CardTitle(props: HTMLAttributes<HTMLHeadingElement>) { return <h3 className={`text-base font-bold text-slate-900 dark:text-zinc-100 ${props.className || ''}`} {...props} /> }
export function CardDescription(props: HTMLAttributes<HTMLParagraphElement>) { return <p className={`mt-0.5 text-xs text-slate-500 dark:text-zinc-400 ${props.className || ''}`} {...props} /> }
export function CardContent(props: HTMLAttributes<HTMLDivElement>) { return <div {...props} /> }
export function CardFooter(props: HTMLAttributes<HTMLDivElement>) { return <div className={`mt-4 border-t border-slate-200 dark:border-zinc-800 pt-4 ${props.className || ''}`} {...props} /> }

export function Avatar({ src, name, alt, size = 'md', className = '' }: { src?: string | null; name?: string; alt?: string; size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'; className?: string }) {
  const sizes = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-12 w-12 text-base', xl: 'h-16 w-16 text-lg', '2xl': 'h-20 w-20 text-xl' }
  const initials = name?.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() || '?'
  return src ? <img className={`rounded-full object-cover ${sizes[size]} ${className}`} src={src} alt={alt || name || 'Avatar'} /> : <span className={`inline-flex items-center justify-center rounded-full bg-amber-500/15 border border-amber-500/30 font-bold text-amber-700 dark:text-amber-300 ${sizes[size]} ${className}`}>{initials}</span>
}
export function AvatarGroup({ children, className = '' }: { children: ReactNode; className?: string }) { return <div className={`flex -space-x-2 ${className}`}>{children}</div> }

export function Badge({ variant = 'default', size = 'md', dot, className = '', children, ...props }: HTMLAttributes<HTMLSpanElement> & { variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'brand' | 'outline'; size?: 'sm' | 'md' | 'lg'; dot?: boolean }) {
  const colors = {
    default: 'bg-slate-100 text-slate-700 border border-slate-200/80 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700',
    success: 'bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/50',
    warning: 'bg-amber-50 text-amber-800 border border-amber-200/80 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/50',
    danger: 'bg-rose-50 text-rose-700 border border-rose-200/80 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/50',
    info: 'bg-sky-50 text-sky-700 border border-sky-200/80 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800/50',
    primary: 'bg-amber-50 text-amber-800 border border-amber-200/80 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/50',
    brand: 'bg-amber-50 text-amber-800 border border-amber-200/80 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/50',
    outline: 'border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 bg-transparent',
  }
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-sm px-3 py-1.5',
  }
  return <span className={`inline-flex items-center rounded-full font-semibold ${sizeClasses[size]} ${colors[variant]} ${className}`} {...props}>{dot && <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current" />}{children}</span>
}

export function Chip({ selected, variant, className = '', children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean; variant?: string }) {
  return <button className={`rounded-full border px-3 py-1 text-sm font-medium transition-all ${selected ? 'border-amber-500 bg-amber-500 text-slate-950 font-bold shadow-xs' : 'border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-750'} ${className}`} {...props}>{children}</button>
}

export function RatingStars({ rating, showValue = false, className = '', interactive, onChange, size }: { rating: number; showValue?: boolean; className?: string; interactive?: boolean; onChange?: (rating: number) => void; size?: string }) {
  const stars = <>{'★'.repeat(Math.round(rating))}{'☆'.repeat(5 - Math.round(rating))}</>
  return interactive ? <button type="button" onClick={() => onChange?.(rating)} className={`inline-flex items-center gap-1 text-amber-400 ${className}`} aria-label={`${rating} out of 5 stars`}>{stars}{showValue && <span className="text-sm text-slate-600 dark:text-zinc-400">{rating.toFixed(1)}</span>}</button> : <span className={`inline-flex items-center gap-1 text-amber-400 ${className}`} aria-label={`${rating} out of 5 stars`}>{stars}{showValue && <span className="text-sm text-slate-600 dark:text-zinc-400">{rating.toFixed(1)}</span>}</span>
}

export function Modal({ isOpen, onClose, title, description, children, size = 'md' }: { isOpen: boolean; onClose: () => void; title?: string; description?: string; children: ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl' | 'full' }) {
  if (!isOpen || typeof document === 'undefined') return null
  const widths = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-xl', full: 'max-w-4xl' }
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm p-4 animate-fade-in" role="dialog" aria-modal="true" onMouseDown={onClose}>
      <div className={`w-full rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-6 sm:p-7 shadow-2xl text-slate-900 dark:text-zinc-100 ${widths[size]}`} onMouseDown={(event) => event.stopPropagation()}>
        {title && (
          <div className="mb-4 flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-3">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-zinc-100">{title}</h2>
              {description && <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">{description}</p>}
            </div>
            <button className="text-2xl text-slate-400 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-zinc-100 transition-colors p-1" onClick={onClose} aria-label="Close">×</button>
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
      <p className="mb-6 text-slate-600 dark:text-zinc-400 text-sm">{message}</p>
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onClose}>{cancelText}</Button>
        <Button onClick={onConfirm} loading={loading}>{confirmText}</Button>
      </div>
    </Modal>
  )
}

export function cn(...values: Array<string | false | null | undefined>) { return values.filter(Boolean).join(' ') }
