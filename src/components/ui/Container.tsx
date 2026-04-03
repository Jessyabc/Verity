import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

type Props = {
  children: ReactNode
  className?: string
  as?: 'div' | 'section' | 'main'
}

export function Container({ children, className, as: Tag = 'div' }: Props) {
  return (
    <Tag
      className={cn(
        'mx-auto w-full max-w-5xl px-5 sm:px-8 lg:px-10',
        className,
      )}
    >
      {children}
    </Tag>
  )
}
