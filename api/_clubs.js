// Shared server-side helper: fetch the Official Clubs List sheet, normalize each
// row into one clean shape, and use the LLM (api/_llm.js) to CONDENSE the free-text
// "Meeting Location & Times" cell so it fits the small "Meets" line on the Clubs page.
// Used by api/clubs.js (Vercel) and the dev middleware in vite.config.js.
//
// The sheet is public + keyless. Advisors type meeting info freely ("Mrs. Stebbins
// room, during wed and Friday during lunch every other week"), so we ask the model to
// rewrite each one as a tidy "Room · Days Time" line. Cached by the raw cell text, so a
// NEW/edited club is condensed automatically next fetch. When there's no LLM key or the
// call fails, the raw cell is used unchanged — the page always renders.

import { llmTitles, llmError } from './_llm.js'

const EMAIL_RE = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g

// Same header→camelCase rule the client uses (src/data/useSheetData.js toKey),
// but empty headers (the sheet's trailing blank columns) map to '' and are dropped.
function toKey(h) {
  const words = String(h).trim().replace(/[^a-zA-Z0-9 ]/g, ' ').split(/\s+/).filter(Boolean)
  if (!words.length) return ''
  return words.map((w, i) => (i ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase())).join('')
}

// Minimal RFC-4180 CSV parser (mirrors the client one) → array of row objects.
function parseCsv(text) {
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

  const start = Math.max(0, rows.findIndex((r) => r.filter((v) => v.trim() !== '').length >= 2))
  const header = rows[start] ?? []
  const keys = header.map(toKey)
  return rows.slice(start + 1)
    .filter((r) => r.some((v) => v.trim() !== ''))
    .map((r) => {
      const o = {}
      keys.forEach((k, i) => { if (k && !(k in o)) o[k] = (r[i] ?? '').trim() })
      return o
    })
}

const uniqEmails = (arr) => Array.from(new Set(arr.map((s) => s.toLowerCase())))

function pick(row, keys) {
  for (const k of keys) {
    const v = row[k]
    if (v != null && String(v).trim()) return String(v).trim()
  }
  return ''
}

// Normalize one sheet row into the exact shape the Clubs page expects (matches the
// client normalizeClub in src/pages/Clubs.jsx). meetingInfo is the RAW cell here;
// condensing happens after, in applyMeetingInfo, so it can be batched + cached.
function normalizeRow(row) {
  const name =
    pick(row, ['name', 'f', 'club', 'clubName', 'clubs']) ||
    String(Object.values(row)[0] ?? '').trim()
  const rawStudents = pick(row, ['studentAdvisors', 'studentAdvisor', 'studentLeaders', 'presidents', 'officers'])
  const rawEmail = pick(row, ['email', 'emailList', 'emailListStudentAdvisorEmails', 'emails', 'contact', 'contactEmail'])
  const other = pick(row, ['other', 'otherInformation', 'otherInfo', 'notes'])

  const emails = uniqEmails([...(rawEmail.match(EMAIL_RE) ?? []), ...(rawStudents.match(EMAIL_RE) ?? [])])
  const studentAdvisors = rawStudents
    .replace(/[(<\[][^)>\]]*@[^)>\]]*[)>\]]/g, '')
    .replace(EMAIL_RE, '')
    .replace(/\s*[,;/|]\s*/g, ', ')
    .replace(/(, )+/g, ', ')
    .replace(/^, |, $/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()

  const disbanded = /disband/i.test(name)
  const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim()
  return {
    __normalized: true,
    name: name.replace(/\s*[(\[]?\s*disbanded\s*[)\]]?\s*/i, ' ').replace(/\s{2,}/g, ' ').trim() || 'Untitled club',
    purpose: norm(pick(row, ['purpose', 'clubPurpose', 'description', 'about'])),
    studentAdvisors,
    teacherAdvisor: norm(pick(row, ['teacherAdvisor', 'teacherAvisor', 'advisor', 'staffAdvisor', 'teacher'])),
    meetingInfo: norm(pick(row, ['meetingInfo', 'meetingLocationTimes', 'meetingLocationTime', 'meetingLocationAndTimes', 'meetings', 'meeting', 'location'])),
    emails,
    other: norm(other),
    disbanded,
  }
}

// LLM-condensed meeting lines. Cached by the raw cell text so a new/edited entry is
// condensed on the next fetch, and re-fetches don't re-call the model for unchanged cells.
const meetingCache = new Map()
const MEETING_INSTRUCTION = [
  'You tidy free-text "meeting location & time" notes for a high school club list, shown on a small one-line field on the school website.',
  'For EACH note, return a SHORT, clean version — a room/location, the day(s), and the time, joined with " · ". Aim for under 8 words.',
  'Fix spelling and capitalization. Expand day names (wed -> Wed, mon -> Mon). Use "&" between two days.',
  'Turn "every other week"/"bi-weekly" into "biweekly"; "at lunch"/"during lunch" into "lunch"; "after school" into "after school".',
  'Keep only what is actually stated — do NOT invent a room, day, or time that is not in the note.',
  'If a note is already short, still return it cleaned. If it has no real meeting info, return it unchanged.',
  'Examples:',
  '"Mrs. Stebbins room, during wed and Friday during lunch every other week" -> "Mrs. Stebbins’ room · Wed & Fri lunch, biweekly"',
  '"B-208 every other Monday at lunch" -> "B-208 · Mon lunch, biweekly"',
  '"Monday lunch room 213-A" -> "Room 213-A · Mon lunch"',
  '"Bi-Weekly Wednesday, Lunch, room 501" -> "Room 501 · Wed lunch, biweekly"',
  'No ending punctuation, no surrounding quotes. Return ONLY a JSON array of strings, one per note, in the same order.',
].join(' ')

async function applyMeetingInfo(clubs) {
  const need = [...new Set(clubs.map((c) => c.meetingInfo).filter((m) => m && !meetingCache.has(m)))].slice(0, 120)
  let used = false
  // Chunk so the strict count-check in llmTitles stays reliable (one giant batch makes
  // the model drop/merge items and the whole call is rejected).
  for (let i = 0; i < need.length; i += 20) {
    const chunk = need.slice(i, i + 20)
    const cleaned = await llmTitles(chunk, MEETING_INSTRUCTION)
    if (cleaned) { used = true; chunk.forEach((raw, j) => { if (cleaned[j]) meetingCache.set(raw, cleaned[j]) }) }
  }
  const out = clubs.map((c) => ({ ...c, meetingInfo: (c.meetingInfo && meetingCache.get(c.meetingInfo)) || c.meetingInfo }))
  out.meetingSource = used ? 'llm' : 'heuristic'
  out.meetingError = used ? '' : llmError()
  return out
}

function toCsvUrl(url) {
  if (!url.includes('docs.google.com/spreadsheets') || url.includes('output=csv')) return url
  const id = url.match(/\/d\/([a-zA-Z0-9-_]+)/)?.[1]
  const gid = url.match(/[#&?]gid=(\d+)/)?.[1] ?? '0'
  // Cache-bust so a sheet edit isn't served from Google's gviz cache.
  return `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&gid=${gid}&_cb=${Date.now()}`
}

export async function fetchClubs(sheetUrl) {
  if (!sheetUrl) throw new Error('no clubs sheet url')
  const r = await fetch(toCsvUrl(sheetUrl))
  if (!r.ok) throw new Error(`clubs sheet returned ${r.status}`)
  const text = await r.text()
  const clubs = parseCsv(text).map(normalizeRow).filter((c) => c.name && c.name !== 'Untitled club')
  return applyMeetingInfo(clubs)
}
