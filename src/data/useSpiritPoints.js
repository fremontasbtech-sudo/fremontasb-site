import { useEffect, useState } from 'react'
import { toCsvUrl } from './useSheetData'
import { school } from './sources'

/**
 * useSpiritPoints(sheetUrl, fallbackRows)
 *
 * The spirit-points sheet is a MATRIX, not a flat table:
 *   Class/Event | BTS Rally | Homecoming | Rally 2 | ...
 *   Freshmen    |    50      |    ...     |   ...
 *   Sophomores  |    50      |    ...
 *   Juniors     |     0      |    ...
 *   Seniors     |    50      |    ...
 *
 * Each class's TOTAL is the sum of its row across every event column, so ASB
 * just adds a new column per event and fills in points, the totals grow on
 * their own. We ignore any row that isn't one of the four class names
 * (headers, "Senior Total", stray totals rows, blanks).
 *
 * Returns { rows, loading, error, source } shaped exactly like useSheetData,
 * where each row is { grade, classOf, points }, a drop-in for SpiritPoints.
 */
const GRADES = [
  { label: 'Seniors', offset: 0 },
  { label: 'Juniors', offset: 1 },
  { label: 'Sophomores', offset: 2 },
  { label: 'Freshmen', offset: 3 },
]

/** Graduating-senior year from school.year ("2026–27" → 2027); classOf grows down the grades. */
function seniorGradYear() {
  const m = String(school.year).match(/(\d{4})\D+(\d{2,4})\s*$/)
  if (m) {
    const start = Number(m[1])
    return m[2].length === 2 ? Number(String(start).slice(0, 2) + m[2]) : Number(m[2])
  }
  const now = new Date()
  return now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear()
}

/** Minimal CSV → array-of-arrays (quotes, commas, newlines inside cells). */
function parseRows(text) {
  const rows = []
  let row = [], cell = '', q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++ }
      else if (c === '"') q = false
      else cell += c
    } else if (c === '"') q = true
    else if (c === ',') { row.push(cell); cell = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(cell); rows.push(row); row = []; cell = ''
    } else cell += c
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row) }
  return rows
}

function toStandings(rows) {
  const grad = seniorGradYear()
  return GRADES.map((g) => {
    const row = rows.find((r) => (r[0] || '').trim().toLowerCase() === g.label.toLowerCase())
    if (!row) return null
    const points = row.slice(1).reduce((sum, cell) => {
      const n = Number(String(cell).replace(/[^\d.-]/g, ''))
      return sum + (Number.isFinite(n) ? n : 0)
    }, 0)
    return { grade: g.label, classOf: String(grad + g.offset), points }
  }).filter(Boolean)
}

const CACHE_KEY = 'fasb.spirit.v1' // last good standings in this browser (instant repeat visits)
function readCache() {
  try {
    const d = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null')
    return Array.isArray(d) && d.length ? d : null
  } catch { return null }
}

// Paints INSTANTLY (this browser's last good numbers, else the snapshot bundled at deploy time),
// then refreshes from the sheet in the background. A slow or failed refresh never shows an
// error or a spinner to visitors; the numbers just stay as they were.
export function useSpiritPoints(sheetUrl, fallbackRows = []) {
  const [state, setState] = useState(() => {
    const cached = sheetUrl ? readCache() : null
    return { rows: cached || fallbackRows, loading: false, error: null, source: cached ? 'sheet' : 'local' }
  })

  useEffect(() => {
    if (!sheetUrl) return
    let cancelled = false
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 15000)
    fetch(toCsvUrl(sheetUrl), { signal: ctrl.signal })
      .then((r) => { if (!r.ok) throw new Error(`Sheet returned ${r.status}`); return r.text() })
      .then((text) => {
        if (cancelled) return
        const rows = toStandings(parseRows(text))
        if (!rows.length) throw new Error('No class rows found in sheet')
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(rows)) } catch { /* private mode */ }
        setState({ rows, loading: false, error: null, source: 'sheet' })
      })
      .catch((err) => {
        if (cancelled) return
        setState((s) => ({ ...s, loading: false, error: err.message }))
      })
      .finally(() => clearTimeout(timer))
    return () => { cancelled = true; ctrl.abort(); clearTimeout(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetUrl])

  return state
}
