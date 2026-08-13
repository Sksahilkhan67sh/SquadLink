import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Switch({ checked, onChange, disabled, label }: {
  checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'focus-ring relative h-6 w-11 shrink-0 rounded-full transition-colors duration-150',
        checked ? 'bg-orange-500' : 'bg-surface-3',
        disabled && 'opacity-40 pointer-events-none',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 left-0.5 size-5 rounded-full bg-white transition-transform duration-150',
          checked && 'translate-x-5',
        )}
      />
    </button>
  )
}

export function Checkbox({ checked, onChange, label, disabled }: {
  checked: boolean; onChange: (v: boolean) => void; label?: string; disabled?: boolean
}) {
  return (
    <label className={cn('inline-flex items-center gap-2 cursor-pointer select-none', disabled && 'opacity-40 pointer-events-none')}>
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'focus-ring flex size-4.5 items-center justify-center rounded-[3px] border transition-colors',
          checked ? 'border-orange-500 bg-orange-500' : 'border-border-strong bg-surface',
        )}
      >
        {checked && <Check className="size-3.5 text-black" strokeWidth={3} />}
      </button>
      {label && <span className="text-sm text-steel-300">{label}</span>}
    </label>
  )
}

export function Radio({ checked, onChange, label }: { checked: boolean; onChange: () => void; label?: string }) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer select-none">
      <button
        type="button"
        role="radio"
        aria-checked={checked}
        onClick={onChange}
        className={cn(
          'focus-ring flex size-4.5 items-center justify-center rounded-full border transition-colors',
          checked ? 'border-orange-500' : 'border-border-strong',
        )}
      >
        {checked && <span className="size-2.5 rounded-full bg-orange-500" />}
      </button>
      {label && <span className="text-sm text-steel-300">{label}</span>}
    </label>
  )
}
