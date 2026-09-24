import { llmTitles, llmError } from './_llm.js'
// Shared server-side helper: pull the ASB morning-announcements Google Sheet and
// parse its weekly Wed/Fri grid into flat { date, text } items.
// Used by api/announcements.js (Vercel) and the dev middleware in vite.config.js.
// The sheet is a public gviz CSV — no key. The CLIENT decides what's visible
// (past-only + 8:30 AM cutoff); this just extracts everything with real dates.

const WEEK_RE = /week of\s+(\d{1,2})\/(\d{1,2})/i
// A "day header" cell: an optional weekday word then a date — "Wednesday 9/9", "Mon 9/8",
// or just a bare date "9/9" / "9/9/2026". Anchored + date-only, so a real announcement
// paragraph can never match it. Used ONLY to detect + skip header rows.
const DAY_HEADER_RE = /^(?:\s*(?:mon|tue|tues|wed|weds|thu|thur|thurs|fri|sat|sun)[a-z]*\.?\s*)?\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\s*$/i

function toCsvUrl(url) {
  if (!url.includes('docs.google.com/spreadsheets') || url.includes('output=csv')) return url
  const id = url.match(/\/d\/([a-zA-Z0-9-_]+)/)?.[1]
  const gid = url.match(/[#&?]gid=(\d+)/)?.[1] ?? '0'
  return `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&gid=${gid}&_cb=${Date.now()}`
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
    [/study abroad|sister city|homestay|exchange (?:trip|program|student)|foreign exchange/i, 'Exchange Trip'],
    [/water\s*melon\s*run/i, 'Watermelon Run'], [/yearbook/i, 'Yearbook Sales'], [/senior ads?/i, 'Senior Ads'],
    [/haunted house/i, 'Haunted House Auditions'], [/astrophysics/i, 'Astrophysics Club'],
    [/\bbeam\b|rideshare/i, 'Sunnyvale Beam Rideshare'], [/\bbikes?\b/i, 'Bike Policy'], [/parking/i, 'Parking Permits'],
    [/litter|trash/i, 'Campus Cleanliness'], [/blood drive/i, 'Blood Drive'], [/color guard/i, 'Color Guard'],
    [/marching band/i, 'Marching Band'], [/\bchoir/i, 'Choir'], [/summer (home)?work|hw packet/i, 'Summer Homework'],
    [/spirit week/i, 'Spirit Week'],
  ]
  // Generic event words: used only if nothing more specific (a named club / "X tournament") is found.
  const generic = [[/fundraiser/i, 'Fundraiser'], [/deadline/i, 'Deadline Reminder'], [/permission slip/i, 'Permission Slips'], [/\brally\b/i, 'Rally'], [/\bdance\b/i, 'Dance'], [/audition/i, 'Auditions']]
  for (const [re, label] of map) if (re.test(text)) return label
  const tc = (x) => x.replace(/\s+/g, ' ').trim().replace(/\b([a-z])/g, (c) => c.toUpperCase())
  // "Come join Friday Night Live! …" / "Join the Chess Club at lunch" → the club/thing name
  let mm = t.match(/\b(?:come\s+)?join\s+(?:the\s+|our\s+)?([^.!?\n]{2,48}?)(?=[.!?]|\s+this\b|\s+at\b|\s+every\b|\s+during\b|\s+on\b|$)/i)
  if (mm && mm[1]) return tc(mm[1])
  // "For open tutorials there will be …" → "Open Tutorials"
  mm = t.match(/^for\s+([^,.!?]{2,40}?)\s+there\s+(?:will\s+be|is|are)\b/i)
  if (mm && mm[1]) return tc(mm[1])
  // "The Sunnyvale Library will be outside …" → "Sunnyvale Library"
  mm = t.match(/^(?:[Tt]he\s+)?([A-Z][^.!?,\n]{2,40}?)\s+(?:will\s+be|will\s+have|is\b|are\b|meets\b|returns\b|opens\b)/)
  if (mm && mm[1]) return tc(mm[1])
  const m = text.match(/join (?:the |our )?([A-Z][A-Za-z&'\u2019 ]+?(?:Club|Team|Society|Program|Council|Committee|Choir|Band))/)
  if (m) return m[1].replace(/\s+/g, ' ').trim()
  // "…come out to the Ceramics Club Tuesday…" → "Ceramics Club" (a named group anywhere in the text)
  const CAP = "[A-Z][\\w&'\u2019-]*"
  const SKIP = /^(The|This|That|Our|Your|A|An|Come|Join|If|Do|Don't|Don\u2019t|Want|Have|Are|Is|We|You|It|FHS|Fremont)$/
  const trimLead = (phrase) => { const w = phrase.split(/\s+/); while (w.length > 1 && SKIP.test(w[0])) w.shift(); return SKIP.test(w[0]) ? '' : w.join(' ') }
  mm = text.match(new RegExp(`((?:${CAP}\\s+){0,3}${CAP})\\s+(Club|Team|Society|Council|Committee|Choir|Orchestra|Ensemble|League)\\b`))
  if (mm) { const lead = trimLead(mm[1]); if (lead) return `${lead} ${mm[2]}` }
  // "…the conclusion of the Pickleball tournament!" → "Pickleball Tournament"
  const NOUNS = ['tournament', 'fundraiser', 'sale', 'drive', 'night', 'game', 'meeting', 'competition', 'show', 'showcase',
    'concert', 'workshop', 'fair', 'festival', 'trip', 'audition', 'auditions', 'tryout', 'tryouts', 'assembly', 'rally',
    'dance', 'challenge', 'contest', 'party', 'drive', 'walk', 'run', 'screening', 'performance', 'recital', 'banquet', 'social']
  const nounAlt = NOUNS.map((n) => `[${n[0]}${n[0].toUpperCase()}]${n.slice(1)}`).join('|')
  mm = text.match(new RegExp(`((?:${CAP}\\s+){0,2}${CAP})\\s+(${nounAlt})\\b`))
  if (mm) { const lead = trimLead(mm[1]); if (lead) return tc(`${lead} ${mm[2]}`) }
  for (const [re, label] of generic) if (re.test(text)) return label
  // Last resort: a proper-noun phrase ("Girls Who Code"), skipping greetings, days and months.
  const DAYMON = /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|April|May|June|July|August|September|October|November|December|Ms|Mr|Mrs|Dr|See|Reminder|Stop|Tickets|Hey|Hi|Please|Remember|Don|Make|Sign|Bring|Check|Grab|Get)\.?$/
  const runs = [...text.matchAll(new RegExp(`${CAP}(?:\\s+${CAP})*`, 'g'))]
    .map((r) => r[0].split(/\s+/).filter((w) => !SKIP.test(w) && !DAYMON.test(w)).join(' '))
    .filter((r) => r.length >= 4)
  const multi = runs.find((r) => r.includes(' '))
  if (multi) return multi
  const words = t.split(' ').slice(0, 6).join(' ').replace(/[.,;:!?]+$/, '')
  return (words.length > 48 ? words.slice(0, 46).trim() + '\u2026' : words) || 'Announcement'
}

function makeDate(mon, day, now) { return new Date(schoolYearFor(mon, now), mon - 1, day) }
function mondayOf(d) { const x = new Date(d); const wd = x.getDay(); x.setDate(x.getDate() + (wd === 0 ? -6 : 1 - wd)); return x }
function isoOf(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

// Each week block starts with "Week of M/D - M/D". We anchor on that week's Monday and place
// each announcement by its column's WEEKDAY LABEL (Wed = Mon+2, Fri = Mon+4) — NOT the date typed
// in the header cell, which in this sheet is often off by a day. So a "Wednesday" announcement
// always goes out on the real Wednesday even when the sheet's date is wrong.
export function parseAnnouncements(rows, now = new Date()) {
  // WEEKLY blocks: a "Week of M/D - M/D" row, then a day-header row whose columns are the
  // weekdays (Monday..Friday), then the week's announcements stacked under each day's column.
  // Announcements are read over the PA on Wednesday and Friday, and the SAME item is usually
  // typed into BOTH the Wed and the Fri column (lightly reworded for the day). So we date each
  // cell by ITS OWN COLUMN's weekday: a Wednesday-column item shows only on Wednesday, a
  // Friday-column item only on Friday. (Previously every cell was dumped onto both reading
  // days, which surfaced Friday's items on Wednesday as duplicate "repeats".)
  // Header dates are typed inconsistently, so a column's weekday comes from its header WORD
  // when present, else its left-to-right position (Mon,Tue,Wed,Thu,Fri); the date is computed
  // off the reliable "Week of" Monday.
  const WEEKDAY_OFFSET = [['monday', 0], ['tuesday', 1], ['wednesday', 2], ['thursday', 3], ['friday', 4], ['saturday', 5], ['sunday', 6]]
  const weekdayOffset = (cell) => {
    const t = String(cell || '').trim().toLowerCase()
    for (const [w, off] of WEEKDAY_OFFSET) if (t.startsWith(w)) return off
    return null
  }
  const out = []
  let weekMonday = null
  let colOffset = null // { columnIndex: weekdayOffset } for the current week block
  for (const row of rows) {
    for (const c of row) {
      const wm = (c || '').match(WEEK_RE)
      if (wm) { weekMonday = mondayOf(makeDate(+wm[1], +wm[2], now)) }
    }
    // Day-header row (2+ weekday/date cells): learn which column maps to which weekday.
    const headerCells = row.filter((c) => DAY_HEADER_RE.test((c || '').trim())).length
    if (headerCells >= 2) {
      colOffset = {}
      let n = 0
      for (let i = 0; i < row.length; i++) {
        const cell = (row[i] || '').trim()
        if (!DAY_HEADER_RE.test(cell)) continue
        const w = weekdayOffset(cell)
        colOffset[i] = (w == null ? n : w)
        n++
      }
      continue
    }
    if (!weekMonday || !colOffset) continue
    for (let i = 0; i < row.length; i++) {
      const off = colOffset[i]
      if (off == null) continue                 // not a dated day-column
      const cell = (row[i] || '').trim()
      if (!cell) continue
      if (WEEK_RE.test(cell) || DAY_HEADER_RE.test(cell)) continue
      // Explicit title override: start a cell with [[My Title]] to force the headline
      // shown on the site; the marker is stripped from the body.
      const ov = cell.match(/^\[\[\s*([^\]]{1,60}?)\s*\]\]\s*([\s\S]*)$/)
      const xtitle = ov ? ov[1].trim() : ''
      const body = ov ? ov[2].trim() : cell
      if (!body) continue
      const d = new Date(weekMonday); d.setDate(d.getDate() + off)
      out.push({ date: isoOf(d), text: cleanText(body), xtitle })
    }
  }
  const seen = new Set()
  const uniq = out.filter((a) => { const k = a.date + '|' + a.text; if (seen.has(k)) return false; seen.add(k); return true })
  uniq.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  return uniq.map((a) => ({ ...a, title: a.xtitle || titleOf(a.text) }))
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
  const url = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(name)}&_cb=${Date.now()}`
  const res = await fetch(url)
  if (!res.ok) return []
  const text = await res.text()
  // A bad/missing tab can still return 200 with a non-CSV error body — parseAnnouncements
  // simply finds no week/day rows in that case, so this stays safe.
  if (/<!DOCTYPE html|google\.visualization\.Query/i.test(text)) return []
  return parseAnnouncements(parseCsvRows(text), now)
}

// ── Clean topic titles via an LLM (optional) ──────────────────────────────────
// The raw announcement is a full paragraph; titleOf() above is a keyword heuristic
// (guesses, and falls back to the first few words). If an LLM key is set as a Vercel
// env var — ANTHROPIC_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY (whichever exists) —
// we generate a clean 2–5 word topic title per blurb in ONE batched call, cached by
// blurb text. No key ⇒ we keep the heuristic. Failures never break the feed.
const titleCache = new Map()
const TITLE_INSTRUCTION = [
  'You write short topic titles for a high school\'s morning announcements, shown on the school website.',
  'For EACH blurb, return a clean title of 2 to 5 words in Title Case that names the specific club, event,',
  'program, deadline, or notice. Name what the opportunity IS for a student (a trip, club, audition, sale, deadline) - NOT the formal name of the sponsoring organization behind it. Drop greetings ("Hey Fremont"), filler, dates, room numbers and calls to action.',
  'Examples:',
  '"Come join Friday Night Live! This club meets every Thursday..." -> "Friday Night Live"',
  '"For open tutorials there will be Yoga in the Nest on Wednesdays..." -> "Open Tutorials"',
  '"The Sunnyvale Library will be outside the FHS Library today during lunch..." -> "Sunnyvale Library Visit"',
  '"Hey Fremont! Are you interested in space? Join Astrophysics Club..." -> "Astrophysics Club"',
  '"If you like folklore and acting, audition for the Haunted House..." -> "Haunted House Auditions"',
  '"Do you want a once in a lifetime study abroad experience? Sunnyvale Sister City Program is looking for candidates to homestay with a Japanese family in Tokyo..." -> "Exchange Trip"',
  'No ending punctuation, no quotes around the title. Return ONLY a JSON array of strings, one per blurb, in the same order.',
].join(' ')

// Collapse announcements that land on the SAME DAY with the SAME title into ONE card
// (the auto-titler gives same-topic blurbs the same label, e.g. two "Yearbook Sales"
// notes on one day). Bodies are merged (identical ones deduped) so nothing is lost and
// the day never shows look-alike repeats. General: applies to any day/title, any week.
function mergeSameDayTitle(items) {
  const groups = new Map(); const order = []
  for (const it of items) {
    const key = it.date + '||' + String(it.title || '').trim().toLowerCase()
    if (!groups.has(key)) { groups.set(key, { item: { ...it }, texts: [it.text] }); order.push(key) }
    else { const g = groups.get(key); if (!g.texts.includes(it.text)) g.texts.push(it.text) }
  }
  return order.map((k) => { const g = groups.get(k); return { ...g.item, text: g.texts.join('\n\n') } })
}

// Titles are generated in small parallel batches (a 15-blurb batch is far less likely to come
// back malformed than one 80-blurb request, and one bad batch no longer throws away the rest).
// Anything the LLM didn't title falls back to titleOf(); `titleFallbacks` counts those so the
// endpoint can keep that response only briefly and try the LLM again soon.
const BATCH = 15
async function applyTitles(items) {
  const need = [...new Set(items.filter((it) => !it.xtitle).map((it) => it.text).filter((t) => !titleCache.has(t)))].slice(0, 90)
  let usedLLM = false
  if (need.length) {
    const chunks = []
    for (let i = 0; i < need.length; i += BATCH) chunks.push(need.slice(i, i + BATCH))
    const results = await Promise.all(chunks.map((c) => llmTitles(c, TITLE_INSTRUCTION)))
    results.forEach((titles, ci) => {
      if (!titles) return
      usedLLM = true
      chunks[ci].forEach((t, i) => { if (titles[i] && titles[i].length <= 60) titleCache.set(t, titles[i]) })
    })
  }
  let fallbacks = 0
  let out = items.map((it) => {
    const title = it.xtitle || titleCache.get(it.text)
    if (!title) fallbacks++
    return { ...it, title: title || it.title }
  })
  out = mergeSameDayTitle(out)
  out.titleSource = fallbacks === 0 ? 'llm' : usedLLM ? 'mixed' : 'heuristic'
  out.titleFallbacks = fallbacks
  out.titleError = fallbacks ? llmError() : ''
  return out
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
  return applyTitles(uniq)
}
