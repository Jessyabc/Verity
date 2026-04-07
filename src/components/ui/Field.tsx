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
        className={cn(
          'w-full rounded-xl border px-3.5 py-2.5 text-[15px] text-ink shadow-[0_1px_2px_rgba(12,13,17,0.04)] outline-none transition-[box-shadow,border-color] placeholder:text-ink-subtle focus:border-accent/40 focus:ring-2 focus:ring-accent/25 dark:shadow-[0_1px_2px_rgba(0,0,0,0.2)]',
          'bg-[var(--input-bg)] border-[var(--input-border)]',
          className,
        )}
        {...rest}
      />
      {hint ? (
        <p className="text-[12px] leading-relaxed text-ink-subtle">{hint}</p>
      ) : null}
    </div>
  )
}
