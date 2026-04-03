import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

type Props = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode
  padding?: 'sm' | 'md' | 'lg'
}

const paddings = {
  sm: 'p-4 sm:p-5',
  md: 'p-6 sm:p-8',
  lg: 'p-8 sm:p-10',
}

export function Card({
  children,
  className,
  padding = 'md',
  ...rest
}: Props) {
  return (
    <div
      className={cn(
        'glass-panel rounded-2xl',
        paddings[padding],
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  )
}
