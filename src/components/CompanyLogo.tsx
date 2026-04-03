import { useState } from 'react'
import { cn } from '@/lib/cn'

const sizeClass = {
  sm: 'h-9 w-9 rounded-xl text-[11px]',
  md: 'h-11 w-11 rounded-2xl text-[12px]',
  lg: 'h-16 w-16 rounded-[1.25rem] text-[15px] sm:h-[4.5rem] sm:w-[4.5rem] sm:text-base',
} as const

export function CompanyLogo({
  name,
  ticker,
  logoUrl,
  size = 'md',
  className,
}: {
  name: string
  ticker: string | null
  logoUrl?: string | null
  size?: keyof typeof sizeClass
  className?: string
}) {
  const [failed, setFailed] = useState(false)
  const initials = (ticker?.slice(0, 2) ?? name.slice(0, 2)).toUpperCase()

  if (!logoUrl?.trim() || failed) {
    return (
      <div
        className={cn(
          'flex shrink-0 items-center justify-center bg-accent-soft font-semibold tabular-nums tracking-tight text-ink ring-1 ring-black/[0.06]',
          sizeClass[size],
          className,
        )}
        aria-hidden
      >
        {initials}
      </div>
    )
  }

  return (
    <img
      src={logoUrl}
      alt=""
      className={cn(
        'shrink-0 bg-white object-contain ring-1 ring-black/[0.06]',
        sizeClass[size],
        className,
      )}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  )
}
