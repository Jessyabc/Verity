import type { ThemePreference } from '@/contexts/theme-context'
import { useTheme } from '@/contexts/useTheme'
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
              active ? 'text-ink' : 'text-ink-muted hover:text-ink',
            )}
            style={
              active
                ? {
                    background: 'var(--segment-active-bg)',
                    boxShadow: 'var(--segment-control-active-shadow)',
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
