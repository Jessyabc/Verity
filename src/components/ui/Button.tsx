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
    'bg-accent text-white shadow-[0_1px_0_rgba(255,255,255,0.12)_inset] hover:bg-[#2a42c4] active:scale-[0.99]',
  secondary:
    'bg-white/90 text-ink border border-black/[0.08] shadow-[0_1px_2px_rgba(12,13,17,0.05)] hover:bg-white',
  ghost: 'text-ink-muted hover:text-ink hover:bg-black/[0.04]',
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
