export const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/**
 * Month calendar with month + year pickers. Days that carry an item get a rust dot and are
 * clickable; the rest are dim. Arrows step months; the selects jump anywhere; "Jump to latest"
 * (optional) returns to a given day. Shared by the Home announcements + Clubs key-dates sections.
 *
 * props: view {y,m}, setView, datesWith (Set of 'YYYY-MM-DD'), selected, onSelect,
 *        years [], latest (iso, optional), onJumpLatest (optional), jumpLabel (optional)
 */
export default function Calendar({ view, setView, datesWith, selected, onSelect, years = [], latest, onJumpLatest, jumpLabel = 'latest' }) {
  const { y, m } = view
  const startDow = new Date(y, m, 1).getDay()
  const days = new Date(y, m + 1, 0).getDate()
  const iso = (d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  const shift = (delta) => { const nd = new Date(y, m + delta, 1); setView({ y: nd.getFullYear(), m: nd.getMonth() }) }
  const yearOpts = [...new Set([...years, y])].sort((a, b) => a - b)
  const cells = []
  for (let i = 0; i < startDow; i++) cells.push(null)
  for (let d = 1; d <= days; d++) cells.push(d)
  const selectCls = 'cursor-pointer rounded-btn border border-rule bg-paper py-1.5 pl-2.5 pr-7 font-display text-sm font-bold text-ink transition-colors focus:border-brand focus:outline-none [@media(hover:hover)]:hover:border-brand'
  const arrowCls = 'flex h-9 w-9 shrink-0 items-center justify-center rounded-btn text-xl text-ink transition-colors [@media(hover:hover)]:hover:bg-brand-tint'
  return (
    <div className="rounded-lg border border-rule p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-2">
        <button type="button" onClick={() => shift(-1)} aria-label="Previous month" className={arrowCls}>&lsaquo;</button>
        <div className="flex flex-1 items-center justify-center gap-2">
          <select aria-label="Month" value={m} onChange={(e) => setView({ y, m: +e.target.value })} className={selectCls}>
            {MONTHS.map((name, i) => <option key={i} value={i}>{name}</option>)}
          </select>
          <select aria-label="Year" value={y} onChange={(e) => setView({ y: +e.target.value, m })} className={selectCls}>
            {yearOpts.map((yy) => <option key={yy} value={yy}>{yy}</option>)}
          </select>
        </div>
        <button type="button" onClick={() => shift(1)} aria-label="Next month" className={arrowCls}>&rsaquo;</button>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {DOW.map((d, i) => (
          <span key={i} className="pb-1 text-center font-display text-[0.65rem] font-bold uppercase tracking-wider text-body/60">{d}</span>
        ))}
        {cells.map((d, i) => {
          if (d === null) return <span key={i} />
          const key = iso(d)
          const has = datesWith.has(key)
          const isSel = key === selected
          return (
            <button key={i} type="button" disabled={!has} onClick={() => onSelect(key)}
              aria-label={has ? `${MONTHS[m]} ${d}, view details` : undefined}
              className={`relative flex h-10 items-center justify-center rounded-btn font-display text-sm transition-colors ${isSel ? 'bg-brand font-bold text-white' : has ? 'font-bold text-ink [@media(hover:hover)]:hover:bg-brand-tint' : 'text-body/35'}`}>
              {d}
              {has && !isSel && <span className="absolute bottom-1.5 h-1.5 w-1.5 rounded-full bg-brand" aria-hidden="true" />}
            </button>
          )
        })}
      </div>
      {latest && selected !== latest && (
        <button type="button" onClick={onJumpLatest}
          className="mt-4 inline-flex min-h-[36px] items-center gap-1.5 font-display text-sm font-bold text-brand [@media(hover:hover)]:hover:underline">
          &larr; Jump to {jumpLabel} ({new Date(latest + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})
        </button>
      )}
    </div>
  )
}
