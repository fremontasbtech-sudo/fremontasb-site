// Shared server-side helper: fetch the Official Clubs List sheet, normalize each row
// into one clean shape, and use the LLM (api/_llm.js — Gemini/Anthropic/OpenAI) to tidy it:
//   • meetingInfo  — condense the free-text "Meeting Location & Times" to a short line
//   • studentAdvisors / teacherAdvisor — capitalize names and comma-separate the people
//     (advisors often type "Vidyuth Pasumarthi Ayush Anarkat …" with no commas)
//   • purpose / other — fix sentence capitalization and end punctuation, wording untouched
// Used by api/clubs.js (Vercel) and the dev middleware in vite.config.js. Everything is
// cached by the raw cell text, so an edited/new club is re-tidied automatically on the next
// fetch and unchanged cells are never re-sent. No LLM key / any failure ⇒ a safe heuristic,
// so the page always renders.

import { llmTitles, llmError } from './_llm.js'

const EMAIL_RE = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g

function toKey(h) {
  const words = String(h).trim().replace(/[^a-zA-Z0-9 ]/g, ' ').split(/\s+/).filter(Boolean)
  if (!words.length) return ''
  return words.map((w, i) => (i ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase())).join('')
}

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

// ── Generic LLM helper: clean a set of field values across all clubs, cached by raw text,
//    chunked so llmTitles' strict count-check stays reliable. `post` runs on each cleaned
//    value; `fallback` runs when the LLM has nothing for that value. Mutates in place. ──
async function cleanField(clubs, fields, cache, instruction, chunkSize, post, fallback) {
  const need = [...new Set(
    clubs.flatMap((c) => fields.map((f) => c[f])).filter((v) => v && !cache.has(v)),
  )].slice(0, 200)
  let used = false
  for (let i = 0; i < need.length; i += chunkSize) {
    const chunk = need.slice(i, i + chunkSize)
    const cleaned = await llmTitles(chunk, instruction)
    if (cleaned) { used = true; chunk.forEach((raw, j) => { if (cleaned[j]) cache.set(raw, post ? post(cleaned[j]) : cleaned[j]) }) }
  }
  for (const c of clubs) {
    for (const f of fields) {
      const v = c[f]
      if (!v) continue
      c[f] = cache.has(v) ? cache.get(v) : (fallback ? fallback(v) : v)
    }
  }
  return used
}

// Meeting location & times → short "Room · Days Time" line.
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

// Student / teacher names → Capitalized, comma-separated between distinct people.
const nameCache = new Map()
const NAME_INSTRUCTION = [
  'You clean up lists of people\'s names for a high school club roster.',
  'For EACH input, the text is one or more names — often run together with no commas and with inconsistent capitalization.',
  'Return the SAME names, Capitalized Properly, with ", " between distinct people.',
  'Do NOT add, remove, translate, re-spell, or invent any name — only insert commas between people and fix capitalization.',
  'If the input is empty or has no names, return it unchanged.',
  'Examples:',
  '"Vidyuth Pasumarthi Ayush Anarkat Allyson Chan Joshua Charnota" -> "Vidyuth Pasumarthi, Ayush Anarkat, Allyson Chan, Joshua Charnota"',
  '"lotem mechlovich ahinava sivakumaran" -> "Lotem Mechlovich, Ahinava Sivakumaran"',
  '"Aaron Eeg" -> "Aaron Eeg"',
  'Return ONLY a JSON array of strings, one per input, in the same order.',
].join(' ')
// Heuristic fallback: title-case each word (can't guess name boundaries without the LLM).
const titleCaseNames = (s) => String(s).replace(/\b([a-z])/g, (c) => c.toUpperCase())

// Purpose / other → fix capitalization + end punctuation only, wording untouched.
const textCache = new Map()
const TEXT_INSTRUCTION = [
  'You lightly copy-edit short club descriptions for a high school website.',
  'For EACH input, fix ONLY capitalization and end punctuation: capitalize the first letter of every sentence and the word "I", and make sure it ends with a period (unless it already ends with ? or !).',
  'Do NOT reword, rephrase, translate, summarize, shorten, expand, add, or remove anything. Keep every word exactly as written.',
  'If it is already correct, return it unchanged. If it is empty, return it empty.',
  'Examples:',
  '"we play chess every week and compete in tournaments" -> "We play chess every week and compete in tournaments."',
  '"This club will go into " -> "This club will go into."',
  'Return ONLY a JSON array of strings, one per input, in the same order.',
].join(' ')
// llmTitles strips a trailing period, so re-add terminal punctuation after it returns.
const endPunct = (s) => { const t = String(s).trim(); return t && !/[.?!]$/.test(t) ? t + '.' : t }
const heuristicText = (s) => { const t = String(s).trim(); if (!t) return t; return endPunct(t.charAt(0).toUpperCase() + t.slice(1)) }

function toCsvUrl(url) {
  if (!url.includes('docs.google.com/spreadsheets') || url.includes('output=csv')) return url
  const id = url.match(/\/d\/([a-zA-Z0-9-_]+)/)?.[1]
  const gid = url.match(/[#&?]gid=(\d+)/)?.[1] ?? '0'
  return `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&gid=${gid}&_cb=${Date.now()}`
}

export async function fetchClubs(sheetUrl) {
  if (!sheetUrl) throw new Error('no clubs sheet url')
  const r = await fetch(toCsvUrl(sheetUrl))
  if (!r.ok) throw new Error(`clubs sheet returned ${r.status}`)
  const text = await r.text()
  const clubs = parseCsv(text).map(normalizeRow).filter((c) => c.name && c.name !== 'Untitled club')

  // Tidy each field with the LLM (all cached by raw text ⇒ only new/changed cells hit it).
  const m = await cleanField(clubs, ['meetingInfo'], meetingCache, MEETING_INSTRUCTION, 20, null, null)
  const n = await cleanField(clubs, ['studentAdvisors', 'teacherAdvisor'], nameCache, NAME_INSTRUCTION, 20, null, titleCaseNames)
  const t = await cleanField(clubs, ['purpose', 'other'], textCache, TEXT_INSTRUCTION, 10, endPunct, heuristicText)

  clubs.meetingSource = m ? 'llm' : 'heuristic'
  clubs.tidySource = (m || n || t) ? 'llm' : 'heuristic'
  clubs.meetingError = (m || n || t) ? '' : llmError()
  return clubs
}
