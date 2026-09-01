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
 * just adds a new column per event and fills in points — the totals grow on
 * their own. We ignore any row that isn't one of the four class names
 * (headers, "Senior Total", stray totals rows, blanks).
 *
 * Returns { rows, loading, error, source } shaped exactly like useSheetData,
 * where each row is { grade, classOf, points } — a drop-in for SpiritPoints.
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

export function useSpiritPoints(sheetUrl, fallbackRows = []) {
  const [state, setState] = useState({
    rows: sheetUrl ? [] : fallbackRows,
    loading: Boolean(sheetUrl),
    error: null,
    source: sheetUrl ? 'sheet' : 'local',
  })

  useEffect(() => {
    if (!sheetUrl) return
    let cancelled = false
    fetch(toCsvUrl(sheetUrl))
      .then((r) => { if (!r.ok) throw new Error(`Sheet returned ${r.status}`); return r.text() })
      .then((text) => {
        if (cancelled) return
        const rows = toStandings(parseRows(text))
        if (!rows.length) throw new Error('No class rows found in sheet')
        setState({ rows, loading: false, error: null, source: 'sheet' })
      })
      .catch((err) => {
        if (cancelled) return
        setState({ rows: fallbackRows, loading: false, error: err.message, source: 'local' })
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetUrl])

  return state
}
