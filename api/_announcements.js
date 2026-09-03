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
  'program, deadline, or notice. Drop greetings ("Hey Fremont"), filler, dates, room numbers and calls to action.',
  'Examples:',
  '"Come join Friday Night Live! This club meets every Thursday..." -> "Friday Night Live"',
  '"For open tutorials there will be Yoga in the Nest on Wednesdays..." -> "Open Tutorials"',
  '"The Sunnyvale Library will be outside the FHS Library today during lunch..." -> "Sunnyvale Library Visit"',
  '"Hey Fremont! Are you interested in space? Join Astrophysics Club..." -> "Astrophysics Club"',
  '"If you like folklore and acting, audition for the Haunted House..." -> "Haunted House Auditions"',
  'No ending punctuation, no quotes around the title. Return ONLY a JSON array of strings, one per blurb, in the same order.',
].join(' ')

async function llmTitles(texts) {
  const AK = process.env.ANTHROPIC_API_KEY, OK = process.env.OPENAI_API_KEY, GK = process.env.GEMINI_API_KEY
  if (!texts.length || (!AK && !OK && !GK)) return null
  const payload = JSON.stringify(texts)
  try {
    let content
    if (AK) {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': AK, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-3-5-haiku-latest', max_tokens: 1024,
          messages: [{ role: 'user', content: TITLE_INSTRUCTION + '\n\nBlurbs:\n' + payload }] }),
      })
      if (!r.ok) throw new Error('anthropic ' + r.status)
      content = (await r.json()).content?.[0]?.text
    } else if (OK) {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${OK}` },
        body: JSON.stringify({ model: 'gpt-4o-mini', temperature: 0.2,
          messages: [{ role: 'system', content: TITLE_INSTRUCTION }, { role: 'user', content: payload }] }),
      })
      if (!r.ok) throw new Error('openai ' + r.status)
      content = (await r.json()).choices?.[0]?.message?.content
    } else {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GK}`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: TITLE_INSTRUCTION + '\n\nBlurbs:\n' + payload }] }] }),
      })
      if (!r.ok) throw new Error('gemini ' + r.status)
      content = (await r.json()).candidates?.[0]?.content?.parts?.[0]?.text
    }
    if (!content) return null
    const arr = JSON.parse((content.match(/\[[\s\S]*\]/) || [content])[0])
    if (!Array.isArray(arr) || arr.length !== texts.length) return null
    return arr.map((t) => String(t == null ? '' : t).replace(/^["'\s]+|["'\s.]+$/g, '').trim())
  } catch (e) { return null }
}

async function applyTitles(items) {
  const need = [...new Set(items.map((it) => it.text).filter((t) => !titleCache.has(t)))].slice(0, 80)
  if (need.length) {
    const titles = await llmTitles(need)
    if (titles) need.forEach((t, i) => { if (titles[i]) titleCache.set(t, titles[i]) })
  }
  return items.map((it) => ({ ...it, title: titleCache.get(it.text) || it.title }))
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
