/** Loading / error / empty states shared by every Sheet-driven section. */
export function Loading({ label = 'Loading…' }) {
  return (
    <div className="flex items-center gap-3 py-8 text-sm text-body" role="status">
      <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-brand" aria-hidden="true" />{label}
    </div>
  )
}

/** tone: 'brand' (rust tint, default) | 'neutral' (gray, for informational notes) */
export function Notice({ children, tone = 'brand' }) {
  const cls = tone === 'neutral'
    ? 'border-rule bg-[#F6F4F2]'
    : 'border-brand/30 bg-brand-tint'
  return (
    <p className={`rounded-btn border px-4 py-3 text-sm text-ink ${cls}`}>{children}</p>
  )
}

/** Shown ONLY in `npm run dev`, hints for ASB Tech that visitors never see. */
export function DevNote({ children }) {
  if (!import.meta.env.DEV) return null
  return <p className="mt-2 text-xs text-body/70">{children}</p>
}
