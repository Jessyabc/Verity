import type { ThemePreference } from '@/contexts/ThemeProvider'
import { useTheme } from '@/contexts/ThemeProvider'
import { cn } from '@/lib/cn'

const options: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'Auto' },
]

export function ThemeAppearanceControl() {
  const { preference, setPreference } = useTheme()

  return (
    <div
      className="flex rounded-2xl p-1"
      style={{ background: 'var(--segment-bg)' }}
      role="group"
      aria-label="Appearance"
    >
      {options.map(({ value, label }) => {
        const active = preference === value
        return (
          <button
            key={value}
            type="button"
            onClick={() => setPreference(value)}
            className={cn(
              'min-h-[2.75rem] flex-1 rounded-[0.85rem] px-3 text-[14px] font-medium tracking-tight transition-[background-color,box-shadow,color] duration-200',
              active
                ? 'text-ink shadow-[0_1px_3px_rgba(12,13,17,0.08)] dark:shadow-[0_1px_4px_rgba(0,0,0,0.35)]'
                : 'text-ink-muted hover:text-ink',
            )}
            style={
              active
                ? {
                    background: 'var(--segment-active-bg)',
                    boxShadow:
                      'var(--nav-pill-active-shadow, 0 1px 3px rgba(12,13,17,0.08)), 0 0 0 1px var(--color-stroke)',
                  }
                : undefined
            }
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
