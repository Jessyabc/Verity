import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'

type Props = { className?: string; to?: string }

export function Logo({ className, to = '/' }: Props) {
  const body = (
    <span
      className={cn(
        'inline-flex items-baseline gap-1.5 font-medium tracking-tight text-ink',
        className,
      )}
    >
      <span className="text-[17px] sm:text-lg">Verity</span>
      <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-ink-subtle">
        Monitor
      </span>
    </span>
  )

  if (to) {
    return (
      <Link to={to} className="outline-none ring-offset-2 ring-offset-transparent focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-accent">
        {body}
      </Link>
    )
  }

  return body
}
