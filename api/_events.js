// Shared server-side helper: pull the Firebird Hub "Events (26-27)" Google Sheet
// (the SAME sheet the app reads) and return the CURATED items only:
//   • events — Events tab (gid=0) rows where featured = YES
//   • games  — Sports tab rows where push = y (column A)
// Public gviz CSV, no key. The CLIENT windows these to the upcoming range
// (see src/data/useEvents.js); this just extracts every flagged row with a real date.

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/

function idOf(url) {
  return (String(url).match(/\/d\/([a-zA-Z0-9-_]+)/) || [])[1] || ''
}
function csvUrl(id, { gid, sheet }) {
  const base = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv`
  const q = sheet != null ? `&sheet=${encodeURIComponent(sheet)}` : `&gid=${gid ?? 0}`
  return `${base}${q}&_cb=${Date.now()}`
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

async function fetchRows(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 fremontasb' } })
  if (!r.ok) throw new Error(`sheet http ${r.status}`)
  return parseCsvRows(await r.text())
}

const clean = (t) => String(t || '').replace(/\s+/g, ' ').trim()

// Events tab has a clean header row (name,date,endDate,time,location,description,tags,featured).
function parseEvents(rows) {
  if (!rows.length) return []
  const head = rows[0].map((h) => clean(h).toLowerCase())
  const col = (n) => head.indexOf(n)
  const ci = {
    name: col('name'), date: col('date'), endDate: col('enddate'), time: col('time'),
    location: col('location'), description: col('description'), tags: col('tags'), featured: col('featured'),
  }
  const out = []
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]
    const date = clean(r[ci.date])
    if (!ISO_RE.test(date)) continue // skips the "Use this red -->" legend row and blanks
    if (clean(r[ci.featured]).toUpperCase() !== 'YES') continue
    out.push({
      name: clean(r[ci.name]),
      date,
      endDate: ISO_RE.test(clean(r[ci.endDate])) ? clean(r[ci.endDate]) : '',
      time: clean(r[ci.time]),
      location: clean(r[ci.location]),
      description: clean(r[ci.description]),
      tags: clean(r[ci.tags]),
    })
  }
  return out.filter((e) => e.name)
}

// Sports tab: merged banner mangles the col-A header, so read push (col 0) and the
// rest by POSITION, not header name. Layout:
// 0 push, 1 sport, 2 date, 3 day, 4 time, 5 level, 6 homeAway, 7 opponent,
// 8 location, 9 type, 10 kind, 11 section, 12 score, 13 seniorNight, 14 title
function parseGames(rows) {
  const out = []
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]
    const date = clean(r[2])
    if (!ISO_RE.test(date)) continue // skip divider/season/info rows
    if (clean(r[0]).toLowerCase() !== 'y') continue // push flag
    out.push({
      sport: clean(r[1]), date, time: clean(r[4]), level: clean(r[5]),
      homeAway: clean(r[6]), opponent: clean(r[7]), location: clean(r[8]),
      section: clean(r[11]).toLowerCase(), score: clean(r[12]),
      seniorNight: clean(r[13]).toUpperCase() === 'YES', title: clean(r[14]),
    })
  }
  return out
}

export async function fetchEvents(sheetUrl) {
  const id = idOf(sheetUrl)
  if (!id) return { events: [], games: [] }
  const [eventsRows, sportsRows] = await Promise.all([
    fetchRows(csvUrl(id, { gid: 0 })).catch(() => []),
    fetchRows(csvUrl(id, { sheet: 'Sports' })).catch(() => []),
  ])
  return { events: parseEvents(eventsRows), games: parseGames(sportsRows) }
}
