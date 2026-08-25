import { useEffect, useState } from 'react'

/**
 * useSheetData(sheetUrl, fallbackRows, options)
 *
 * The ONE data-fetching utility for the whole site. Give it a Google Sheet
 * URL (or null) and it returns { rows, loading, error, source }.
 *
 *  - If `sheetUrl` is set: fetches the sheet as CSV, parses it, maps header
 *    names to camelCase keys (e.g. "Teacher Advisor" → teacherAdvisor).
 *  - If the fetch fails, or `sheetUrl` is null: returns `fallbackRows`
 *    (the local sample JSON) so the page never renders empty.
 *
 * options.map(row) — optional per-row transform (rename columns, coerce types).
 */
export function useSheetData(sheetUrl, fallbackRows = [], options = {}) {
  const [state, setState] = useState({
    rows: sheetUrl ? [] : fallbackRows,
    loading: Boolean(sheetUrl),
    error: null,
    source: sheetUrl ? 'sheet' : 'local',
  })

  useEffect(() => {
    if (!sheetUrl) return
    let cancelled = false
    const csvUrl = toCsvUrl(sheetUrl)

    fetch(csvUrl)
      .then((r) => {
        if (!r.ok) throw new Error(`Sheet returned ${r.status}`)
        return r.text()
      })
      .then((text) => {
        if (cancelled) return
        let rows = parseCsv(text)
        if (options.map) rows = rows.map(options.map)
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

/** Turn any Google Sheet link into a CSV endpoint that works from the browser. */
export function toCsvUrl(url) {
  // Already a "Publish to web" CSV link or any non-Google URL → use as is.
  if (!url.includes('docs.google.com/spreadsheets') || url.includes('output=csv')) return url
  const id = url.match(/\/d\/([a-zA-Z0-9-_]+)/)?.[1]
  const gid = url.match(/[#&?]gid=(\d+)/)?.[1] ?? '0'
  return `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&gid=${gid}`
}

/** Minimal RFC-4180 CSV parser: handles quotes, commas and newlines inside cells. */
export function parseCsv(text) {
  const rows = []
  let row = [], cell = '', inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++ }
      else if (c === '"') inQuotes = false
      else cell += c
    } else if (c === '"') inQuotes = true
    else if (c === ',') { row.push(cell); cell = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(cell); rows.push(row); row = []; cell = ''
    } else cell += c
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row) }

  // Header = first row with at least 2 filled cells (skips a title row someone typed above the table).
  const start = Math.max(0, rows.findIndex((r) => r.filter((v) => v.trim() !== '').length >= 2))
  const header = rows[start] ?? []
  const body = rows.slice(start + 1)
  const keys = header.map(toKey)
  return body
    .filter((r) => r.some((v) => v.trim() !== ''))
    .map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])))
}

function toKey(h) {
  const words = h.trim().replace(/[^a-zA-Z0-9 ]/g, ' ').split(/\s+/).filter(Boolean)
  if (!words.length) return 'name'
  return words.map((w, i) => (i ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase())).join('')
}

export const isTrue = (v) => /^(true|yes|1|y)$/i.test(String(v ?? '').trim())
/** Hidden only when someone explicitly wrote FALSE / no / 0 — a blank cell means "show it". */
export const isHidden = (v) => /^(false|no|0|n|hidden|archived)$/i.test(String(v ?? '').trim())
