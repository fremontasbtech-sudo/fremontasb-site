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
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const DATA = resolve(HERE, '../src/data')
const BASE = (process.env.SNAPSHOT_BASE || 'https://fremontasb.org').replace(/\/$/, '')
const TIMEOUT_MS = 8000

async function getJson(path) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const r = await fetch(`${BASE}${path}`, { signal: ctrl.signal })
    if (!r.ok) throw new Error(`http ${r.status}`)
    return await r.json()
  } finally {
    clearTimeout(t)
  }
}

function readLocal(file) {
  try { return JSON.parse(readFileSync(resolve(DATA, file), 'utf8')) } catch { return null }
}

// Write only when `next` is a validated, non-empty improvement; otherwise keep the file.
function commit(file, next, ok) {
  if (!ok(next)) { console.warn(`[snapshot] ${file}: skipped (kept committed copy)`); return }
  writeFileSync(resolve(DATA, file), JSON.stringify(next, null, 2) + '\n')
  console.log(`[snapshot] ${file}: refreshed`)
}

async function refreshEvents() {
  try {
    const d = await getJson('/api/events')
    const next = { events: Array.isArray(d.events) ? d.events : [], games: Array.isArray(d.games) ? d.games : [] }
    commit('events.json', next, (v) => v && (v.events.length || v.games.length))
  } catch (e) { console.warn(`[snapshot] events.json: kept (${e.message})`) }
}

async function refreshPhotos() {
  try {
    const d = await getJson('/api/flickr')
    const albums = (Array.isArray(d.albums) ? d.albums : [])
      .filter((a) => a && a.coverImageUrl)
      .slice(0, 8)
      .map((a) => ({ name: a.name, coverImageUrl: a.coverImageUrl, flickrUrl: a.flickrUrl, count: a.count || 0, date: a.date, title: a.title }))
    commit('photos.json', albums, (v) => Array.isArray(v) && v.length >= 3)
  } catch (e) { console.warn(`[snapshot] photos.json: kept (${e.message})`) }
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
  } catch (e) { console.warn(`[snapshot] media.json: kept (${e.message})`) }
}

// Spirit Points: the standings at deploy time become the instant first paint (and the fallback).
async function refreshSpirit() {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const r = await fetch(`${BASE}/api/sheet?tab=Spirit%20Points`, { signal: ctrl.signal })
    if (!r.ok) throw new Error(`http ${r.status}`)
    const rows = (await r.text()).split(/\r?\n/).map((l) => (l.match(/("([^"]|"")*"|[^,]*)(,|$)/g) || []).map((c) => c.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"')))
    const prev = readLocal('spiritPoints.json') || []
    const next = prev.map((p) => {
      const row = rows.find((r) => (r[0] || '').trim().toLowerCase() === p.grade.toLowerCase())
      if (!row) return null
      const points = row.slice(1).reduce((sum, c) => { const n = Number(String(c).replace(/[^\d.-]/g, '')); return sum + (Number.isFinite(n) ? n : 0) }, 0)
      return { ...p, points }
    })
    commit('spiritPoints.json', next, (v) => v.length === 4 && v.every(Boolean))
  } catch (e) { console.warn(`[snapshot] spiritPoints.json: kept (${e.message})`) } finally { clearTimeout(t) }
}

await Promise.all([refreshEvents(), refreshPhotos(), refreshMedia(), refreshSpirit()])
console.log('[snapshot] done')
