/** Soft focal point for empty states — not a logo */
export function OrbIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient id="orb" x1="12" y1="8" x2="38" y2="42" gradientUnits="userSpaceOnUse">
          <stop stopColor="#c8d4ff" />
          <stop offset="1" stopColor="#2f4ad8" stopOpacity="0.35" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="22" stroke="url(#orb)" strokeWidth="1.5" opacity="0.9" />
      <circle cx="24" cy="24" r="14" fill="url(#orb)" opacity="0.2" />
    </svg>
  )
}
