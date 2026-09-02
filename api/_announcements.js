// Shared server-side helper: pull the ASB morning-announcements Google Sheet and
// parse its weekly Wed/Fri grid into flat { date, text } items.
// Used by api/announcements.js (Vercel) and the dev middleware in vite.config.js.
// The sheet is a public gviz CSV — no key. The CLIENT decides what's visible
// (past-only + 8:30 AM cutoff); this just extracts everything with real dates.

const DAY_RE = /\b(mon|tue|tues|wed|weds|thu|thur|thurs|fri)[a-z]*\.?\s+(\d{1,2})\/(\d{1,2})\b/i
const WEEK_RE = /week of\s+(\d{1,2})\/(\d{1,2})/i
const DAY_OFFSET = { mon: 0, tue: 1, tues: 1, wed: 2, weds: 2, thu: 3, thur: 3, thurs: 3, fri: 4 }

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

// Best-effort short topic title for an announcement (the raw text is a full paragraph).
export function titleOf(text) {
  let t = String(text || '').replace(/\s+/g, ' ').trim()
  const strip = /^(hey|hi|hello|attention|calling all|good morning|firebirds|students|seniors|juniors|sophomores|freshmen|fremont)\b[^.!?:,]*[.!?:,]\s*/i
  while (strip.test(t)) t = t.replace(strip, '')
  const map = [
    [/water\s*melon\s*run/i, 'Watermelon Run'], [/yearbook/i, 'Yearbook Sales'], [/senior ads?/i, 'Senior Ads'],
    [/haunted house/i, 'Haunted House Auditions'], [/astrophysics/i, 'Astrophysics Club'],
    [/\bbeam\b|rideshare/i, 'Sunnyvale Beam Rideshare'], [/\bbikes?\b/i, 'Bike Policy'], [/parking/i, 'Parking Permits'],
    [/litter|trash/i, 'Campus Cleanliness'], [/blood drive/i, 'Blood Drive'], [/color guard/i, 'Color Guard'],
    [/marching band/i, 'Marching Band'], [/\bchoir/i, 'Choir'], [/summer (home)?work|hw packet/i, 'Summer Homework'],
    [/spirit week/i, 'Spirit Week'], [/fundraiser/i, 'Fundraiser'], [/\brally\b/i, 'Rally'], [/\bdance\b/i, 'Dance'],
    [/audition/i, 'Auditions'],
  ]
  for (const [re, label] of map) if (re.test(text)) return label
  const m = text.match(/join (?:the |our )?([A-Z][A-Za-z&'\u2019 ]+?(?:Club|Team|Society|Program|Council|Committee|Choir|Band))/)
  if (m) return m[1].replace(/\s+/g, ' ').trim()
  const words = t.split(' ').slice(0, 7).join(' ').replace(/[.,;:!?]+$/, '')
  return (words.length > 52 ? words.slice(0, 50).trim() + '\u2026' : words) || 'Announcement'
}

function makeDate(mon, day, now) { return new Date(schoolYearFor(mon, now), mon - 1, day) }
function mondayOf(d) { const x = new Date(d); const wd = x.getDay(); x.setDate(x.getDate() + (wd === 0 ? -6 : 1 - wd)); return x }
function isoOf(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

// Each week block starts with "Week of M/D - M/D". We anchor on that week's Monday and place
// each announcement by its column's WEEKDAY LABEL (Wed = Mon+2, Fri = Mon+4) — NOT the date typed
// in the header cell, which in this sheet is often off by a day. So a "Wednesday" announcement
// always goes out on the real Wednesday even when the sheet's date is wrong.
export function parseAnnouncements(rows, now = new Date()) {
  const out = []
  let colDates = {}
  let weekMonday = null
  for (const row of rows) {
    for (const c of row) { const wm = (c || '').match(WEEK_RE); if (wm) weekMonday = mondayOf(makeDate(+wm[1], +wm[2], now)) }
    const dayCells = row.map((c, i) => ({ i, c })).filter((x) => DAY_RE.test(x.c || ''))
    if (dayCells.length >= 2) {
      colDates = {}
      for (const { i, c } of dayCells) {
        const m = c.match(DAY_RE)
        const off = DAY_OFFSET[m[1].toLowerCase()]
        const headerDate = makeDate(+m[2], +m[3], now)
        let date = headerDate
        if (weekMonday && off != null) {
          const snap = new Date(weekMonday); snap.setDate(snap.getDate() + off)
          if (Math.abs((snap - headerDate) / 86400000) <= 6) date = snap // correct off-by-days within the week
        }
        colDates[i] = isoOf(date)
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
  return uniq.map((a) => ({ ...a, title: titleOf(a.text) }))
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

// The sheet has one TAB per month ("September 2026", "October 2026", …). Build the list of
// tab names for this school year, from August of the start year through the current month
// (we only ever surface PAST announcements, so future months add nothing).
function monthTabs(now) {
  const startYear = (now.getMonth() + 1) >= 7 ? now.getFullYear() : now.getFullYear() - 1
  const curY = now.getFullYear(), curM = now.getMonth() + 1
  const tabs = []
  let y = startYear, m = 8 // August
  for (let guard = 0; guard < 13; guard++) {
    tabs.push(`${MONTH_NAMES[m - 1]} ${y}`)
    if (y === curY && m === curM) break
    m++; if (m > 12) { m = 1; y++ }
    if (y > startYear + 1) break
  }
  return tabs
}

function sheetIdOf(url) { return url.match(/\/d\/([a-zA-Z0-9-_]+)/)?.[1] }

async function fetchTab(id, name, now) {
  const url = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(name)}`
  const res = await fetch(url)
  if (!res.ok) return []
  const text = await res.text()
  // A bad/missing tab can still return 200 with a non-CSV error body — parseAnnouncements
  // simply finds no week/day rows in that case, so this stays safe.
  if (/<!DOCTYPE html|google\.visualization\.Query/i.test(text)) return []
  return parseAnnouncements(parseCsvRows(text), now)
}

// Pull EVERY month tab by name and merge. Falls back to the default sheet (old single-tab
// layout) if the tabbed fetch turns up nothing, so it keeps working either way.
export async function fetchAnnouncements(sheetUrl, now = new Date()) {
  if (!sheetUrl) throw new Error('no announcements sheet url')
  const id = sheetIdOf(sheetUrl)
  let items = []
  if (id) {
    const perTab = await Promise.all(monthTabs(now).map((name) => fetchTab(id, name, now).catch(() => [])))
    items = perTab.flat()
  }
  if (!items.length) {
    const res = await fetch(toCsvUrl(sheetUrl))
    if (!res.ok) throw new Error(`sheet ${res.status}`)
    items = parseAnnouncements(parseCsvRows(await res.text()), now)
  }
  const seen = new Set()
  const uniq = items.filter((a) => { const k = a.date + '|' + a.text; if (seen.has(k)) return false; seen.add(k); return true })
  uniq.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  return uniq
}
