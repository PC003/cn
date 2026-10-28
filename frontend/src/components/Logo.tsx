/** Bitrate-ladder play button: stacked bars sliced into a play triangle. */
export function Logo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 96 96" className={className} role="img" aria-label="StreamLens logo">
      <rect width="96" height="96" rx="22" fill="#e5222b" />
      <g fill="#fff">
        <rect x="23" y="25" width="12" height="7" rx="3.5" />
        <rect x="23" y="35" width="30" height="7" rx="3.5" />
        <rect x="23" y="45" width="48" height="7" rx="3.5" />
        <rect x="23" y="55" width="30" height="7" rx="3.5" />
        <rect x="23" y="65" width="12" height="7" rx="3.5" />
      </g>
    </svg>
  );
}
