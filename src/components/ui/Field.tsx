import type { InputHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  hint?: string
}

export function Field({ id, label, hint, className, ...rest }: Props) {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className="space-y-2">
      <label
        htmlFor={inputId}
        className="block text-[13px] font-medium tracking-tight text-ink-muted"
      >
        {label}
      </label>
      <input
        id={inputId}
        className={cn('input-field', className)}
        {...rest}
      />
      {hint ? (
        <p className="text-[12px] leading-relaxed text-ink-subtle">{hint}</p>
      ) : null}
    </div>
  )
}
