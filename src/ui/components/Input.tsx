import { forwardRef, InputHTMLAttributes, useId } from 'react'
import { cn } from '../lib/utils'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  floatingLabel?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, leftIcon, rightIcon, floatingLabel, id, ...props }, ref) => {
    const generatedId = useId()
    const inputId = id || generatedId
    const errorId = `${inputId}-error`
    const helperId = `${inputId}-helper`

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className={`label ${floatingLabel ? 'peer' : ''}`}>
            {label}
            {props.required && <span className="text-danger-500 ml-1" aria-hidden="true">*</span>}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-semantic-text-tertiary">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'input',
              leftIcon && 'pl-10',
              rightIcon && 'pr-10',
              floatingLabel && 'peer',
              className
            )}
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={error ? errorId : helperText ? helperId : undefined}
            {...props}
          />
          {rightIcon && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-semantic-text-tertiary">
              {rightIcon}
            </div>
          )}
          {floatingLabel && label && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-semantic-text-tertiary transition-all duration-fast peer-placeholder-shown:top-1/2 peer-placeholder-shown:text-base peer-focus:top-2 peer-focus:text-xs peer-focus:text-brand-500">
              {label}
            </span>
          )}
        </div>
        {error && (
          <p id={errorId} className="mt-1.5 text-sm text-danger-600" role="alert">
            {error}
          </p>
        )}
        {helperText && !error && (
          <p id={helperId} className="mt-1.5 text-sm text-semantic-text-tertiary">
            {helperText}
          </p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'