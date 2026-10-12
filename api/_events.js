import { publicTabUrl } from './_sheet.js'
import { withTimeout } from './_http.js'
// Shared server-side helper: pull the Firebird Hub "Events (26-27)" Google Sheet
// (the SAME sheet the app reads) and return the CURATED items only:
//   • events — the 'Events' tab (read BY NAME, not gid): EVERY dated row shows,
//             unless a 'hide' column marks it (opt-out). featured/red is emphasis only.
//   • games  — Sports tab rows where push = y (column A) OR that are senior nights
//             (seniorNight column = YES, or "SENIOR NIGHT" in the title)
// The sheet is private: both tabs are read through the Apps Script (api/_sheet.js). The CLIENT
// windows these to the upcoming range (see src/data/useEvents.js); this just extracts every
// flagged row with a real date.

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
  const text = await withTimeout(10000, async (signal) => {
    const r = await fetch(url, { signal, headers: { 'User-Agent': 'Mozilla/5.0 fremontasb' } })
    if (!r.ok) throw new Error(`sheet http ${r.status}`)
    return r.text()
  })
  // Apps Script answers quota or script errors with an HTML page and status 200.
  if (text.trim().startsWith('<')) throw new Error('sheet sent html')
  return parseCsvRows(text)
}

// Last good rows per tab on this instance. A tab read that throws, sends HTML, or comes back
// with fewer than 2 rows (an empty or half-written tab, e.g. while SportsSync rebuilds Sports)
// is a failed read, not an empty list: reuse the last good rows instead. Best effort only, since
// a cold instance starts empty; then events.js answers 503 and the CDN keeps its last good copy.
const lastGoodRows = new Map()
async function readTab(tab) {
  try {
    const rows = await fetchRows(`${publicTabUrl(tab)}&_cb=${Date.now()}`)
    if (rows.filter((r) => r.some((c) => clean(c))).length < 2) throw new Error('fewer than 2 rows')
    lastGoodRows.set(tab, rows)
    return { rows, state: 'live' }
  } catch (e) {
    if (lastGoodRows.has(tab)) return { rows: lastGoodRows.get(tab), state: 'stale' }
    return { rows: [], state: 'failed', error: String(e && e.message || e) }
  }
}

const clean = (t) => String(t || '').replace(/\s+/g, ' ').trim()
const pad = (n) => String(n).padStart(2, '0')

// Tolerant "is this cell flagged?" — accepts y, yes, true, x, ✓, 1, done (any case,
// stray spaces), so a human typing "Y", "Yes", "x", etc. still counts. Blank = no.
const isYes = (v) => {
  const t = clean(v).toLowerCase()
  return t !== '' && (t === 'y' || t === 'yes' || t === 'true' || t === 'x' || t === '✓' || t === '1' || t === 'done' || t.startsWith('y'))
}

// Opt-OUT flag: an event is visible by default; it is removed ONLY when a human puts an
// explicit no/hide in a 'hide' column. Blank = show. This is why a forgotten red
// highlight can never silently drop an event from the site again.
const isNo = (v) => {
  const t = clean(v).toLowerCase()
  return t === 'no' || t === 'n' || t === 'false' || t === '0' || t === 'hide' || t === 'hidden' || t === 'off' || t === 'skip'
}

// Normalize a date cell to YYYY-MM-DD. Accepts ISO (2026-09-16) OR US M/D/YYYY,
// M/D/YY (9/16/2026, 9/16/26). Anything else (blank, banner rows, "Use this red")
// returns '' and is skipped — that's also how divider/legend rows drop out. An impossible
// date (a day-first 28/10/2026, or 2/30) is skipped too, instead of landing on another day.
function normDate(v) {
  const s = clean(v)
  let y, mo, d
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s)
  if (m) { y = +m[1]; mo = +m[2]; d = +m[3] }
  else if ((m = /^(\d{1,2})[/](\d{1,2})[/](\d{2,4})$/.exec(s))) { y = +m[3]; if (y < 100) y += 2000; mo = +m[1]; d = +m[2] }
  else return ''
  const dt = new Date(Date.UTC(y, mo - 1, d))
  if (mo < 1 || mo > 12 || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return ''
  return `${y}-${pad(mo)}-${pad(d)}`
}

// Header cell → lookup key: lowercase letters and digits only, so 'End Date', 'endDate' and
// 'enddate ' all read as 'enddate'.
const headKey = (h) => clean(h).toLowerCase().replace(/[^a-z0-9]/g, '')
const findCol = (head, names) => { for (const n of names) { const i = head.indexOf(n); if (i >= 0) return i } return -1 }

// Events tab header: name,date,endDate,time,location,description,tags,featured.
// Column lookup is by header name (order-independent) with safe fallbacks so a
// renamed/moved header can't silently blank the whole feed.
function parseEvents(rows) {
  if (!rows.length) return []
  const head = rows[0].map(headKey)
  const col = (n) => head.indexOf(n)
  const colOr = (names, pos) => { const i = findCol(head, names); return i >= 0 ? i : pos }
  const ci = {
    name: colOr(['name', 'event', 'eventname'], 0),
    date: colOr(['date', 'startdate', 'start'], 1),
    endDate: findCol(head, ['enddate', 'end', 'ends']), time: col('time'), location: col('location'),
    description: col('description'), tags: col('tags'),
    featured: col('featured') >= 0 ? col('featured') : head.length - 1, // emphasis only now
    hide: col('hide'), // optional opt-out column; -1 (absent) => nothing hidden
  }
  const get = (r, i) => (i >= 0 ? clean(r[i]) : '')
  const out = []
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]
    const date = normDate(r[ci.date])
    if (!date) continue                // skips the "Use this red -->" legend row and blanks
    if (ci.hide >= 0 && isNo(r[ci.hide])) continue // opt-out: only an explicit hide removes an event
    // An end date typed before the start date is a typo: treat it as a one-day event, so the
    // event still shows on its own day.
    const end = normDate(r[ci.endDate])
    out.push({
      name: get(r, ci.name), date, endDate: end && end < date ? date : end,
      time: get(r, ci.time), location: get(r, ci.location),
      description: get(r, ci.description), tags: get(r, ci.tags),
      featured: isYes(r[ci.featured]),
    })
  }
  return out.filter((e) => e.name)
}

// Sports tab, read by HEADER name so an inserted column (notes, say) can't shift every field.
// Each column falls back to its usual position when its header is missing; push falls back to
// column A, because the merged season banner can mangle that header. Usual layout:
// 0 push, 1 sport, 2 date, 3 day, 4 time, 5 level, 6 homeAway, 7 opponent,
// 8 location, 9 type, 10 kind, 11 section, 12 score, 13 seniorNight, 14 title
const SPORTS_COLS = { push: 0, sport: 1, date: 2, time: 4, level: 5, homeaway: 6, opponent: 7, location: 8, section: 11, score: 12, seniornight: 13, title: 14 }
function parseGames(rows) {
  // The header row is the first of the top few rows that names both sport and date.
  let h = rows.slice(0, 5).findIndex((r) => { const k = r.map(headKey); return k.includes('sport') && k.includes('date') })
  if (h < 0) h = 0
  const head = (rows[h] || []).map(headKey)
  const ci = {}
  for (const [k, pos] of Object.entries(SPORTS_COLS)) { const i = head.indexOf(k); ci[k] = i >= 0 ? i : pos }
  const out = []
  for (let i = h + 1; i < rows.length; i++) {
    const r = rows[i]
    const date = normDate(r[ci.date])
    if (!date) continue                          // skip divider/season/info rows (no real date)
    const push = isYes(r[ci.push])                // pinned to the site by a human
    const title = clean(r[ci.title])
    const senior = isYes(r[ci.seniornight]) || /senior\s*night/i.test(title) // seniorNight col OR title text
    if (!push && !senior) continue               // only curated (pinned) OR senior-night games
    out.push({
      sport: clean(r[ci.sport]), date, time: clean(r[ci.time]), level: clean(r[ci.level]),
      homeAway: clean(r[ci.homeaway]), opponent: clean(r[ci.opponent]), location: clean(r[ci.location]),
      section: clean(r[ci.section]).toLowerCase(), score: clean(r[ci.score]),
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

// The feed is slow (4 to 7 s for about 170 KB), so its parsed scores are kept on this instance
// for 10 minutes and reused; a refresh then costs only the two tab reads. A slow or failed feed
// falls back to the last good scores, so a response that gets cached never quietly loses them.
const SCORES_TTL_MS = 10 * 60 * 1000
let scoresMemo = null // { at, map }
async function fetchScores() {
  if (scoresMemo && Date.now() - scoresMemo.at < SCORES_TTL_MS) return { map: scoresMemo.map, source: 'memo' }
  try {
    const d = await withTimeout(8000, async (signal) => {
      const r = await fetch(ATHLETICS_RESULTS, { signal, headers: { 'User-Agent': 'Mozilla/5.0 fremontasb' } })
      if (!r.ok) throw new Error(`feed http ${r.status}`)
      return r.json()
    })
    const m = new Map()
    for (const p of d.programs || []) {
      for (const g of p.results || []) {
        if (!g || g.noScore) continue
        const sc = clean(g.score)
        if (!sc || /scrimmage|no score|tbd/i.test(sc)) continue
        m.set(gkey(g.sport, g.date, g.level, g.opponent || g.matchup), sc)
      }
    }
    if (!m.size) throw new Error('feed had no scores')
    scoresMemo = { at: Date.now(), map: m }
    return { map: m, source: 'live' }
  } catch {
    return scoresMemo ? { map: scoresMemo.map, source: 'memo' } : { map: new Map(), source: 'none' }
  }
}

// Returns { events, games, health }. health.failed lists tabs with no data at all (events.js
// then refuses to answer with a partial list), health.stale the tabs served from this
// instance's last good read, and health.scores where the athletics scores came from
// ('live', 'memo', or 'none' when the feed is down and nothing is remembered).
export async function fetchEvents(sheetUrl) {
  const id = idOf(sheetUrl)
  if (!id) return { events: [], games: [], health: { failed: [], stale: [], scores: 'none' } }
  // The sheet is private now: read its public tabs through the Apps Script (runs as the owner).
  const [ev, sp, scores] = await Promise.all([readTab('Events'), readTab('Sports'), fetchScores()])
  const games = parseGames(sp.rows)
  // Scores from the athletics feed. An exact sport|date|level|opponent match wins over the
  // sheet's score column, which can carry the other level's score from the same day.
  for (const g of games) {
    const sc = scores.map.get(gkey(g.sport, g.date, g.level, g.opponent))
    if (sc) { g.score = sc; g.section = 'result' } // a scored game is a finished game
  }
  const tabs = { Events: ev, Sports: sp }
  const health = {
    failed: Object.keys(tabs).filter((t) => tabs[t].state === 'failed'),
    stale: Object.keys(tabs).filter((t) => tabs[t].state === 'stale'),
    scores: scores.source,
  }
  return { events: parseEvents(ev.rows), games, health }
}
