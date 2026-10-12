import { useEffect, useState } from 'react'
import { useLang } from '../i18n'

export const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
// Spanish names come from Intl so the pickers, weekday row and labels follow the language switch.
const monthNames = (locale, month) => MONTHS.map((_, i) => { const s = new Date(2026, i, 1).toLocaleDateString(locale, { month }).replace('.', ''); return s[0].toUpperCase() + s.slice(1) })
const MONTHS_ES = monthNames('es-US', 'long')
// Short names for the month picker on phones under 360 px, so "September" isn't clipped next to the arrows.
const MONTHS_SHORT = { en: monthNames('en-US', 'short'), es: monthNames('es-US', 'short') }
const DOW_ES = ['D', 'L', 'M', 'M', 'J', 'V', 'S']
const JUMP_ES = { latest: 'lo más reciente', 'next up': 'lo próximo' }

/**
 * Month calendar with month + year pickers. Days that carry an item get a rust dot and are
 * clickable; the rest are dim. Arrows step months; the selects jump anywhere; "Jump to latest"
 * (optional) returns to a given day. Shared by the Home announcements + Clubs key-dates sections.
 * Every control is at least 44 px tall; the arrows overlap the box padding on phones so the
 * month and year pickers still fit next to them at 320 px.
 *
 * props: view {y,m}, setView, datesWith (Set of 'YYYY-MM-DD'), selected, onSelect,
 *        years [], latest (iso, optional), onJumpLatest (optional), jumpLabel (optional)
 */
export default function Calendar({ view, setView, datesWith, selected, onSelect, years = [], latest, onJumpLatest, jumpLabel = 'latest' }) {
  const { lang } = useLang()
  const es = lang === 'es'
  const months = es ? MONTHS_ES : MONTHS
  const narrow = useNarrow()
  const { y, m } = view
  const startDow = new Date(y, m, 1).getDay()
  const days = new Date(y, m + 1, 0).getDate()
  const iso = (d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  const shift = (delta) => { const nd = new Date(y, m + delta, 1); setView({ y: nd.getFullYear(), m: nd.getMonth() }) }
  const yearOpts = [...new Set([...years, y])].sort((a, b) => a - b)
  const cells = []
  for (let i = 0; i < startDow; i++) cells.push(null)
  for (let d = 1; d <= days; d++) cells.push(d)
  const selectCls = 'min-h-[44px] min-w-0 cursor-pointer rounded-btn border border-rule bg-paper py-1.5 pl-2 pr-6 sm:pl-2.5 sm:pr-7 font-display text-sm font-bold text-ink transition-colors focus:border-brand focus:outline-none [@media(hover:hover)]:hover:border-brand'
  const arrowCls = 'flex h-11 w-11 shrink-0 items-center justify-center rounded-btn text-xl text-ink transition-colors [@media(hover:hover)]:hover:bg-brand-tint'
  const jumpDate = latest ? new Date(latest + 'T00:00:00').toLocaleDateString(es ? 'es-US' : 'en-US', { month: 'short', day: 'numeric' }) : ''
  return (
    <div className="min-w-0 rounded-lg border border-rule p-3 sm:p-5">
      <div className="mb-4 flex items-center gap-1 sm:gap-2">
        <button type="button" onClick={() => shift(-1)} aria-label="Previous month" className={`${arrowCls} -ml-1.5 sm:ml-0`}>&lsaquo;</button>
        <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5 sm:gap-2">
          <select aria-label="Month" value={m} onChange={(e) => setView({ y, m: +e.target.value })} className={selectCls}>
            {(narrow ? MONTHS_SHORT[es ? 'es' : 'en'] : months).map((name, i) => <option key={i} value={i}>{name}</option>)}
          </select>
          <select aria-label="Year" value={y} onChange={(e) => setView({ y: +e.target.value, m })} className={`${selectCls} shrink-0`}>
            {yearOpts.map((yy) => <option key={yy} value={yy}>{yy}</option>)}
          </select>
        </div>
        <button type="button" onClick={() => shift(1)} aria-label="Next month" className={`${arrowCls} -mr-1.5 sm:mr-0`}>&rsaquo;</button>
      </div>
      <div className="grid grid-cols-7 gap-x-0.5 gap-y-1 sm:gap-1">
        {(es ? DOW_ES : DOW).map((d, i) => (
          <span key={i} className="pb-1 text-center font-display text-[0.65rem] font-bold uppercase tracking-wider text-body/60">{d}</span>
        ))}
        {cells.map((d, i) => {
          if (d === null) return <span key={i} />
          const key = iso(d)
          const has = datesWith.has(key)
          const isSel = key === selected
          return (
            <button key={i} type="button" disabled={!has} onClick={() => onSelect(key)}
              aria-label={has ? (es ? `${d} de ${months[m].toLowerCase()}, ver detalles` : `${MONTHS[m]} ${d}, view details`) : undefined}
              className={`relative flex h-11 items-center justify-center rounded-btn font-display text-sm transition-colors ${isSel ? 'bg-brand font-bold text-white' : has ? 'font-bold text-ink [@media(hover:hover)]:hover:bg-brand-tint' : 'text-body/35'}`}>
              {d}
              {has && !isSel && <span className="absolute bottom-1.5 h-1.5 w-1.5 rounded-full bg-brand" aria-hidden="true" />}
            </button>
          )
        })}
      </div>
      {latest && selected !== latest && (
        <button type="button" onClick={onJumpLatest}
          className="mt-4 inline-flex min-h-[44px] items-center gap-1.5 font-display text-sm font-bold text-brand [@media(hover:hover)]:hover:underline">
          &larr; {es ? `Ir a ${JUMP_ES[jumpLabel] || jumpLabel}` : `Jump to ${jumpLabel}`} ({jumpDate})
        </button>
      )}
    </div>
  )
}

/* Tiny local media-query hook (same idea as Opportunities.jsx useMinWidth). */
function useNarrow() {
  const query = '(max-width: 374px)' // full month names clip the year select below 375 px
  const [narrow, setNarrow] = useState(() => (typeof window !== 'undefined' ? window.matchMedia(query).matches : false))
  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = (e) => setNarrow(e.matches)
    setNarrow(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return narrow
}
