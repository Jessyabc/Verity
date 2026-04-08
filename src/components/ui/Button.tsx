import {
  cloneElement,
  isValidElement,
  type ButtonHTMLAttributes,
  type ReactElement,
  type ReactNode,
} from 'react'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  children: ReactNode
  asChild?: boolean
}

const variants: Record<Variant, string> = {
  primary:
    'bg-accent text-white shadow-inset-highlight hover:brightness-[0.95] active:scale-[0.99] dark:hover:brightness-110',
  secondary:
    'border border-stroke bg-[var(--segment-active-bg)] text-ink shadow-control hover:brightness-[1.02] dark:hover:brightness-125',
  ghost:
    'text-ink-muted hover:bg-[var(--nav-pill-hover-bg)] hover:text-ink dark:hover:bg-white/[0.06]',
}

const base =
  'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[15px] font-medium tracking-tight transition-[transform,background-color,box-shadow,color] duration-200 ease-out disabled:pointer-events-none disabled:opacity-45'

export function Button({
  className,
  variant = 'primary',
  type = 'button',
  children,
  asChild,
  ...rest
}: Props) {
  const styles = cn(base, variants[variant], className)

  if (asChild && isValidElement(children)) {
    const child = children as ReactElement<{ className?: string }>
    return cloneElement(child, {
      className: cn(styles, child.props.className),
    })
  }

  return (
    <button type={type} className={styles} {...rest}>
      {children}
    </button>
  )
}
