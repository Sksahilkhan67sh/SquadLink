import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes, type LabelHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, icon, error, ...props }, ref) => (
    <div className="w-full">
      <div className="relative">
        {icon && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-steel-500">{icon}</span>}
        <input
          ref={ref}
          className={cn(
            'h-11 w-full rounded-sm border border-border bg-surface px-3 text-sm text-steel-100',
            'placeholder:text-steel-700 transition-colors',
            'hover:border-border-strong focus:border-orange-500 focus-ring',
            icon && 'pl-10',
            error && 'border-danger focus:border-danger',
            className,
          )}
          {...props}
        />
      </div>
      {error && <p className="mt-1.5 text-xs text-[#ff8570]">{error}</p>}
    </div>
  ),
)
Input.displayName = 'Input'

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'w-full resize-none rounded-sm border border-border bg-surface px-3 py-2.5 text-sm text-steel-100',
        'placeholder:text-steel-700 transition-colors',
        'hover:border-border-strong focus:border-orange-500 focus-ring',
        className,
      )}
      {...props}
    />
  ),
)
Textarea.displayName = 'Textarea'

export function Label({ className, children, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={cn('mb-1.5 block text-xs font-semibold uppercase tracking-wide text-steel-500', className)} {...props}>
      {children}
    </label>
  )
}
