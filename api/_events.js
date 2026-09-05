// Shared server-side helper: pull the Firebird Hub "Events (26-27)" Google Sheet
// (the SAME sheet the app reads) and return the CURATED items only:
//   • events — Events tab (gid=0) rows where featured = YES
//   • games  — Sports tab rows where push = y (column A) OR that are senior nights
//             (seniorNight column = YES, or "SENIOR NIGHT" in the title)
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
const pad = (n) => String(n).padStart(2, '0')

// Tolerant "is this cell flagged?" — accepts y, yes, true, x, ✓, 1, done (any case,
// stray spaces), so a human typing "Y", "Yes", "x", etc. still counts. Blank = no.
const isYes = (v) => {
  const t = clean(v).toLowerCase()
  return t !== '' && (t === 'y' || t === 'yes' || t === 'true' || t === 'x' || t === '✓' || t === '1' || t === 'done' || t.startsWith('y'))
}

// Normalize a date cell to YYYY-MM-DD. Accepts ISO (2026-09-16) OR US M/D/YYYY,
// M/D/YY (9/16/2026, 9/16/26). Anything else (blank, banner rows, "Use this red")
// returns '' and is skipped — that's also how divider/legend rows drop out.
function normDate(v) {
  const s = clean(v)
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s)
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`
  m = /^(\d{1,2})[/](\d{1,2})[/](\d{2,4})$/.exec(s)
  if (m) { let y = +m[3]; if (y < 100) y += 2000; return `${y}-${pad(m[1])}-${pad(m[2])}` }
  return ''
}

// Events tab header: name,date,endDate,time,location,description,tags,featured.
// Column lookup is by header name (order-independent) with safe fallbacks so a
// renamed/moved header can't silently blank the whole feed.
function parseEvents(rows) {
  if (!rows.length) return []
  const head = rows[0].map((h) => clean(h).toLowerCase())
  const col = (n) => head.indexOf(n)
  const ci = {
    name: col('name') >= 0 ? col('name') : 0,
    date: col('date') >= 0 ? col('date') : 1,
    endDate: col('enddate'), time: col('time'), location: col('location'),
    description: col('description'), tags: col('tags'),
    featured: col('featured') >= 0 ? col('featured') : head.length - 1, // last col by convention
  }
  const get = (r, i) => (i >= 0 ? clean(r[i]) : '')
  const out = []
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]
    const date = normDate(r[ci.date])
    if (!date) continue                // skips the "Use this red -->" legend row and blanks
    if (!isYes(r[ci.featured])) continue
    out.push({
      name: get(r, ci.name), date, endDate: normDate(r[ci.endDate]),
      time: get(r, ci.time), location: get(r, ci.location),
      description: get(r, ci.description), tags: get(r, ci.tags),
    })
  }
  return out.filter((e) => e.name)
}

// Sports tab: the merged season banner mangles the col-A header, so read push (col 0)
// and the rest by POSITION, not header name. Layout:
// 0 push, 1 sport, 2 date, 3 day, 4 time, 5 level, 6 homeAway, 7 opponent,
// 8 location, 9 type, 10 kind, 11 section, 12 score, 13 seniorNight, 14 title
function parseGames(rows) {
  const out = []
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]
    const date = normDate(r[2])
    if (!date) continue                          // skip divider/season/info rows (no real date)
    const push = isYes(r[0])                      // pinned to the site by a human
    const title = clean(r[14])
    const senior = isYes(r[13]) || /senior\s*night/i.test(title) // seniorNight col OR title text
    if (!push && !senior) continue               // only curated (pinned) OR senior-night games
    out.push({
      sport: clean(r[1]), date, time: clean(r[4]), level: clean(r[5]),
      homeAway: clean(r[6]), opponent: clean(r[7]), location: clean(r[8]),
      section: clean(r[11]).toLowerCase(), score: clean(r[12]),
      seniorNight: senior, push, title,
    })
  }
  return out
}

// The FHS athletics results feed (same source the app's schedule widget uses). It carries
// the real final scores, which the Sports tab's score column often lacks. We merge them in
// by matching sport + date + level + opponent, so a game's score appears on the site as
// soon as athletics posts it — no dependence on the sheet's score column being filled.
const ATHLETICS_RESULTS = 'https://script.google.com/macros/s/AKfycby_2RTRuFEiIRdoNQtzbuUQzSGCGJ3G_p7CxNrqcqOcQiPk268kXu63uLf21GIT5RfQ/exec?view=results'
const normOpp = (v) => clean(v).toLowerCase().replace(/^(vs\.?|at)\s+/, '').trim()
const gkey = (sport, date, level, opp) => [clean(sport).toLowerCase(), clean(date), clean(level).toLowerCase(), normOpp(opp)].join('|')

async function fetchScores() {
  try {
    const r = await fetch(ATHLETICS_RESULTS, { headers: { 'User-Agent': 'Mozilla/5.0 fremontasb' } })
    if (!r.ok) return new Map()
    const d = await r.json()
    const m = new Map()
    for (const p of d.programs || []) {
      for (const g of p.results || []) {
        if (!g || g.noScore) continue
        const sc = clean(g.score)
        if (!sc || /scrimmage|no score|tbd/i.test(sc)) continue
        m.set(gkey(g.sport, g.date, g.level, g.opponent || g.matchup), sc)
      }
    }
    return m
  } catch { return new Map() }
}

export async function fetchEvents(sheetUrl) {
  const id = idOf(sheetUrl)
  if (!id) return { events: [], games: [] }
  const [eventsRows, sportsRows, scores] = await Promise.all([
    fetchRows(csvUrl(id, { gid: 0 })).catch(() => []),
    fetchRows(csvUrl(id, { sheet: 'Sports' })).catch(() => []),
    fetchScores(),
  ])
  const games = parseGames(sportsRows)
  // Fill missing scores from the athletics feed; a scored game is a finished game.
  for (const g of games) {
    if (clean(g.score)) continue
    const sc = scores.get(gkey(g.sport, g.date, g.level, g.opponent))
    if (sc) { g.score = sc; g.section = 'result' }
  }
  return { events: parseEvents(eventsRows), games }
}
