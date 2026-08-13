import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger'
type Size = 'sm' | 'md' | 'lg' | 'icon'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

const variants: Record<Variant, string> = {
  primary: 'bg-orange-500 text-black font-semibold hover:bg-orange-400 active:bg-orange-600 shadow-[0_0_0_1px_var(--color-orange-600)]',
  secondary: 'bg-surface-3 text-steel-100 hover:bg-[var(--color-border-strong)]',
  ghost: 'bg-transparent text-steel-300 hover:bg-surface-2 hover:text-steel-100',
  outline: 'bg-transparent text-steel-100 border border-border-strong hover:border-orange-500 hover:text-orange-400',
  danger: 'bg-danger/15 text-[#ff8570] border border-danger/40 hover:bg-danger/25',
}

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2',
  icon: 'h-10 w-10 p-0',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'bevel-sm inline-flex items-center justify-center whitespace-nowrap font-medium tracking-wide',
          'transition-all duration-150 ease-out select-none',
          'disabled:opacity-40 disabled:pointer-events-none',
          'focus-ring',
          variants[variant],
          sizes[size],
          className,
        )}
        {...props}
      >
        {loading && <Loader2 className="size-4 animate-spin" />}
        {children}
      </button>
    )
  },
)
Button.displayName = 'Button'
