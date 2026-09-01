// Shared server-side helper: pull the ASB morning-announcements Google Sheet and
// parse its weekly Wed/Fri grid into flat { date, text } items.
// Used by api/announcements.js (Vercel) and the dev middleware in vite.config.js.
// The sheet is a public gviz CSV — no key. The CLIENT decides what's visible
// (past-only + 8:30 AM cutoff); this just extracts everything with real dates.

const DAY_RE = /\b(mon|tue|tues|wed|weds|thu|thur|thurs|fri)[a-z]*\.?\s+(\d{1,2})\/(\d{1,2})\b/i

function toCsvUrl(url) {
  if (!url.includes('docs.google.com/spreadsheets') || url.includes('output=csv')) return url
  const id = url.match(/\/d\/([a-zA-Z0-9-_]+)/)?.[1]
  const gid = url.match(/[#&?]gid=(\d+)/)?.[1] ?? '0'
  return `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&gid=${gid}`
}

// RFC-4180 CSV → array of rows (each row an array of cell strings).
function parseCsvRows(text) {
  const rows = []; let row = [], cell = '', q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++ }
      else if (c === '"') q = false
      else cell += c
    } else if (c === '"') q = true
    else if (c === ',') { row.push(cell); cell = '' }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = '' }
    else cell += c
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row) }
  return rows
}

function schoolYearFor(month, now) {
  const startYear = (now.getMonth() + 1) >= 7 ? now.getFullYear() : now.getFullYear() - 1
  return month >= 7 ? startYear : startYear + 1
}

function cleanText(t) {
  return String(t || '').replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, ' ').trim()
}

export function parseAnnouncements(rows, now = new Date()) {
  const out = []
  let colDates = {}
  for (const row of rows) {
    const dayCells = row.map((c, i) => ({ i, c })).filter((x) => DAY_RE.test(x.c || ''))
    if (dayCells.length >= 2) {
      colDates = {}
      for (const { i, c } of dayCells) {
        const m = c.match(DAY_RE); const mon = +m[2], day = +m[3]
        const y = schoolYearFor(mon, now)
        colDates[i] = `${y}-${String(mon).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      }
      continue
    }
    for (let i = 0; i < row.length; i++) {
      const cell = (row[i] || '').trim()
      if (colDates[i] && cell && !/^week of/i.test(cell)) out.push({ date: colDates[i], text: cleanText(cell) })
    }
  }
  const seen = new Set()
  const uniq = out.filter((a) => { const k = a.date + '|' + a.text; if (seen.has(k)) return false; seen.add(k); return true })
  uniq.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  return uniq
}

export async function fetchAnnouncements(sheetUrl) {
  if (!sheetUrl) throw new Error('no announcements sheet url')
  const res = await fetch(toCsvUrl(sheetUrl))
  if (!res.ok) throw new Error(`sheet ${res.status}`)
  return parseAnnouncements(parseCsvRows(await res.text()))
}
