// Build-time snapshot refresh (runs before `vite build`, see package.json).
//
// The home page paints INSTANTLY from three bundled JSON snapshots and then revalidates
// against the live feeds in the background. On a slow or flaky connection (typically a
// phone), the live feeds lag, so what the visitor actually sees for the first second+ is
// the bundled snapshot. If those snapshots are stale, Latest News shows old/half-missing
// content (e.g. an old Fremont TV episode and no photo albums) until the feeds catch up.
//
// This script refreshes the snapshots from the live production API on every deploy, so the
// instant first paint is already current and complete. It is deliberately fail-safe: if a
// feed can't be reached or returns something unexpected, that file is left exactly as it is
// in git — a snapshot never gets emptied or corrupted, the worst case is it stays as fresh
// as the last successful deploy.
//
// Why the 2026-10-10 23:51 Vercel deploy shipped an old events.json (checked 2026-10-12): its
// bundle hash equals a local build of the committed JSON, so none of the 4 files changed. The
// Vercel build log couldn't be read (no access), but the script had three ways to keep a file
// with only a quiet one-line note:
//   • It read through the CDN. With stale-while-revalidate, the first request after a quiet
//     evening gets the copy cached at the previous request. Most likely here: the last request
//     was the 19:14 local build itself, so 23:51 got that same copy back (byte-identical).
//   • An 8 s timeout, while an uncached /api/events takes 3.5 to 10.5 s.
//   • No check for an HTML page (the Vercel bot checkpoint can answer a build machine with one).
// Now every request carries a unique ?snap= query, so the edge can't answer from its cache and
// the function runs fresh; the timeout fits a cold function; HTML or a challenge is reported as
// such; and the build log ends with a loud summary of anything kept. It never fails the build.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const DATA = resolve(HERE, '../src/data')
// www directly: the apex answers with a 308 redirect first.
const BASE = (process.env.SNAPSHOT_BASE || 'https://www.fremontasb.org').replace(/\/$/, '')
const TIMEOUT_MS = 30000
const kept = [] // "file (reason)" for the summary at the end

// GET a path from the live site, bypassing the edge cache, and return its body text.
// Throws with a reason that says what went wrong (status, HTML page, timeout).
async function getText(path) {
  const url = `${BASE}${path}${path.includes('?') ? '&' : '?'}snap=${Date.now()}`
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'fremontasb-build-snapshot/1.0 (+https://www.fremontasb.org)' } })
    const text = await r.text()
    const challenge = r.headers.get('x-vercel-mitigated') || ''
    if (challenge || /^\s*</.test(text)) {
      throw new Error(`got an HTML page instead of data (http ${r.status}${challenge ? `, x-vercel-mitigated: ${challenge}` : ''}); likely the Vercel bot checkpoint`)
    }
    if (!r.ok) throw new Error(`http ${r.status}`)
    console.log(`[snapshot] ${path}: http ${r.status}, cache ${r.headers.get('x-vercel-cache') || '-'}, ${text.length} bytes`)
    return text
  } catch (e) {
    if (e && e.name === 'AbortError') throw new Error(`no answer in ${TIMEOUT_MS / 1000} s`)
    throw e
  } finally {
    clearTimeout(t)
  }
}
const getJson = async (path) => JSON.parse(await getText(path))
const keep = (file, reason) => { kept.push(`${file} (${reason})`); console.warn(`[snapshot] WARNING ${file}: kept the committed copy, ${reason}`) }

function readLocal(file) {
  try { return JSON.parse(readFileSync(resolve(DATA, file), 'utf8')) } catch { return null }
}

// Write only when `next` is a validated, non-empty improvement; otherwise keep the file.
function commit(file, next, ok) {
  if (!ok(next)) { keep(file, 'the live data looked empty or incomplete'); return }
  writeFileSync(resolve(DATA, file), JSON.stringify(next, null, 2) + '\n')
  console.log(`[snapshot] ${file}: refreshed`)
}

async function refreshEvents() {
  try {
    const d = await getJson('/api/events')
    const next = { events: Array.isArray(d.events) ? d.events : [], games: Array.isArray(d.games) ? d.games : [] }
    commit('events.json', next, (v) => v && (v.events.length || v.games.length))
  } catch (e) { keep('events.json', e.message) }
}

async function refreshPhotos() {
  try {
    const d = await getJson('/api/flickr')
    const albums = (Array.isArray(d.albums) ? d.albums : [])
      .filter((a) => a && a.coverImageUrl)
      .slice(0, 8)
      .map((a) => ({ name: a.name, coverImageUrl: a.coverImageUrl, flickrUrl: a.flickrUrl, count: a.count || 0, date: a.date, title: a.title }))
    commit('photos.json', albums, (v) => Array.isArray(v) && v.length >= 3)
  } catch (e) { keep('photos.json', e.message) }
}

async function refreshMedia() {
  try {
    const d = await getJson('/api/youtube')
    const live = (Array.isArray(d.videos) ? d.videos : [])
      .map((v) => ({ title: v.cleanTitle || v.title, date: v.date, youtubeId: v.youtubeId, hosts: v.hosts || '', kind: v.kind || 'Fremont TV' }))
    if (!live.length) throw new Error('empty feed')
    // Merge with the committed overlay so episodes that have aged out of the RSS window are
    // never lost from the archive; the live copy wins for any id it still carries.
    const byId = new Map()
    for (const r of (readLocal('media.json') || [])) if (r && r.youtubeId) byId.set(r.youtubeId, r)
    for (const r of live) byId.set(r.youtubeId, r)
    const merged = [...byId.values()].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    commit('media.json', merged, (v) => Array.isArray(v) && v.length >= 3)
  } catch (e) { keep('media.json', e.message) }
}

// Spirit Points: the standings at deploy time become the instant first paint (and the fallback).
async function refreshSpirit() {
  try {
    const rows = (await getText('/api/sheet?tab=Spirit%20Points')).split(/\r?\n/).map((l) => (l.match(/("([^"]|"")*"|[^,]*)(,|$)/g) || []).map((c) => c.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"')))
    const prev = readLocal('spiritPoints.json') || []
    const next = prev.map((p) => {
      const row = rows.find((r) => (r[0] || '').trim().toLowerCase() === p.grade.toLowerCase())
      if (!row) return null
      const points = row.slice(1).reduce((sum, c) => { const n = Number(String(c).replace(/[^\d.-]/g, '')); return sum + (Number.isFinite(n) ? n : 0) }, 0)
      return { ...p, points }
    })
    commit('spiritPoints.json', next, (v) => v.length === 4 && v.every(Boolean))
  } catch (e) { keep('spiritPoints.json', e.message) }
}

await Promise.all([refreshEvents(), refreshPhotos(), refreshMedia(), refreshSpirit()])
if (kept.length) {
  console.warn(`[snapshot] WARNING: ${kept.length} of 4 snapshots NOT refreshed; this deploy ships the committed copies of: ${kept.join('; ')}`)
} else {
  console.log('[snapshot] done: all 4 snapshots refreshed from the live site')
}
