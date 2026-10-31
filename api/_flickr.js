// Shared server-side helper: fetch all albums (photosets) for a Flickr account
// via the Flickr REST API. Used by api/flickr.js (Vercel) and the dev
// middleware in vite.config.js. Needs a Flickr API key (server-side only).
// primary_photo_extras asks Flickr for ready-made cover image URLs so we don't
// have to construct them by hand.

// Flickr non-commercial, READ-ONLY API key for the ASB account. Committed on purpose so
// the site works on a fresh checkout and on Vercel with zero setup. It can only read the
// account's public album list, and is trivially regenerated at flickr.com/services/apps/.
// Override it anytime (e.g. to rotate) by setting the FLICKR_API_KEY env var — no code change.
const DEFAULT_API_KEY = '50ce36c804dbe7a0ee3942cb833f460c'

import { llmTitles, llmError, llmSource } from './_llm.js'
import { withTimeout } from './_http.js'
import { cleanAlbumTitle } from '../src/data/albumTitle.js'

// LLM-cleaned album titles. Rule (matches the announcements titling): return the event
// name only, in Title Case, with any YEAR/DATE removed — the site shows the album's real
// month separately (date rail in Latest News, month label on Photos). Cached by raw name,
// so a NEW album is titled automatically the next time the feed is fetched. Falls back to
// the client's cleanAlbumTitle() heuristic when there's no LLM key or the call fails.
const albumTitleCache = new Map()
const ALBUM_INSTRUCTION = [
  'You write short, clean display titles for a high school ASB\'s photo albums, shown on the school website.',
  'For EACH album name, return the event/album title in Title Case, 1 to 6 words.',
  'REMOVE any year or date (e.g. "2026", "Aug 2026", "5/20") — the date is shown separately on the site.',
  'Also drop filler: a leading "@", "cover photo", photographer credits, and "Class of 20XX".',
  'Keep a meaningful theme in parentheses if present.',
  'Examples:',
  '"Prom 2026" -> "Prom"',
  '"@Class of 2025 Senior Sunrise cover photo" -> "Senior Sunrise"',
  '"BTS Social (Beach Bash)" -> "BTS Social (Beach Bash)"',
  '"2024 Winter Rally" -> "Winter Rally"',
  '"Homecoming Rallies-Dance_" -> "Homecoming Rallies & Dance"',
  'No ending punctuation, no quotes around the title. Return ONLY a JSON array of strings, one per album, in the same order.',
].join(' ')

async function applyAlbumTitles(albums) {
  const names = [...new Set(albums.map((a) => a.name).filter(Boolean))]
  const cached = names.filter((n) => albumTitleCache.has(n)).length
  const need = names.filter((n) => !albumTitleCache.has(n)).slice(0, 120)
  // Title in small chunks — one giant batch makes the model drop/merge items and the
  // strict count check then rejects the whole thing. Chunks keep each call reliable.
  for (let i = 0; i < need.length; i += 20) {
    const chunk = need.slice(i, i + 20)
    const titles = await llmTitles(chunk, ALBUM_INSTRUCTION)
    if (titles) chunk.forEach((n, j) => { if (titles[j]) albumTitleCache.set(n, titles[j]) })
  }
  // Same cleanup as the client fallback, so an LLM title can't keep a stray date either.
  const out = albums.map((a) => { const t = albumTitleCache.get(a.name); return { ...a, title: t ? cleanAlbumTitle(t) : '' } })
  // Diagnostics: a title from an earlier call on this instance counts as 'cache', not 'heuristic'.
  const fallback = names.filter((n) => !albumTitleCache.has(n)).length
  out.titleSource = llmSource({ fresh: names.length - cached - fallback, cached, fallback })
  out.titleFallbacks = fallback
  out.titleError = fallback ? llmError() : ''
  return out
}

// The album's real EVENT day. date_create is when it was UPLOADED (often a day or two after
// the event), and the cover photo's EXIF date is unreliable (some cameras report a wrong year,
// e.g. a 2019 timestamp on a 2026 photo). So for the most recent albums we pull their photos'
// capture dates and take the MOST COMMON day that falls near the upload — that's the event day.
// Bounded to the newest albums (the ones the site actually shows) and cached, so it's a handful
// of extra calls, not one per album. Anything we can't resolve keeps the date_create fallback.
const eventDateCache = new Map()
async function applyEventDates(albums, key) {
  const recent = albums.filter((a) => a.id).sort((a, b) => b.createEpoch - a.createEpoch).slice(0, 14)
  await Promise.all(recent.map(async (a) => {
    if (eventDateCache.has(a.id)) { Object.assign(a, eventDateCache.get(a.id)); return }
    try {
      const u = `https://api.flickr.com/services/rest/?method=flickr.photosets.getPhotos&api_key=${encodeURIComponent(key)}&photoset_id=${a.id}&extras=date_taken&per_page=300&format=json&nojsoncallback=1`
      const j = await withTimeout(8000, async (signal) => {
        const r = await fetch(u, { signal })
        return r.ok ? r.json() : null
      })
      if (!j) return
      const photos = (j && j.photoset && j.photoset.photo) || []
      const anchor = a.createEpoch ? a.createEpoch * 1000 : Date.now()
      const lo = anchor - 60 * 86400000, hi = anchor + 2 * 86400000
      const counts = new Map(), latest = new Map()
      for (const p of photos) {
        const dt = p.datetaken || ''
        if (!/^\d{4}-\d{2}-\d{2}/.test(dt)) continue
        const ms = new Date(dt.replace(' ', 'T')).getTime()
        if (Number.isNaN(ms) || ms < lo || ms > hi) continue // drop wrong-clock outliers
        const day = dt.slice(0, 10)
        counts.set(day, (counts.get(day) || 0) + 1)
        if (dt > (latest.get(day) || '')) latest.set(day, dt)
      }
      let best = '', bestN = 0
      for (const [day, n] of counts) if (n > bestN) { bestN = n; best = day }
      // The date typed in the album title ("Homecoming '26 Rally - 10/9/26", "Clubs Day - 9/16 '26")
      // wins over the cameras: a clock can be wrong, or the photos re-exported on upload day
      // (the "Volleyball Senior Night - 10/19/26" photos all say 10/30).
      {
        const m = /(\d{1,2})\/(\d{1,2})(?:\/|\s*')(\d{2}|\d{4})\b/.exec(a.name || '')
        if (m) {
          const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])
          const iso = `${y}-${String(m[1]).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}`
          const ms = new Date(`${iso}T12:00:00`).getTime()
          if (!Number.isNaN(ms) && ms >= lo && ms <= hi) best = iso
        }
      }
      // takenAt: the last photo's local capture time that day, so same-day albums sort by when
      // they happened (the night dance above the afternoon rally). Blank when the clock was wrong.
      if (best) { const v = { date: best, takenAt: (latest.get(best) || '').replace(' ', 'T') }; Object.assign(a, v); eventDateCache.set(a.id, v) }
    } catch { /* keep the date_create fallback */ }
  }))
}

// A timestamp's calendar day in America/Los_Angeles, as YYYY-MM-DD.
function ptDay(ms) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date(ms)).map((x) => [x.type, x.value]))
  return `${p.year}-${p.month}-${p.day}`
}

export async function fetchAlbums(apiKey, userId) {
  const key = apiKey || DEFAULT_API_KEY
  if (!userId) throw new Error('no flickr nsid')
  const params = new URLSearchParams({
    method: 'flickr.photosets.getList',
    api_key: key,
    user_id: userId,
    primary_photo_extras: 'url_b,url_c,url_z,url_m',
    format: 'json',
    nojsoncallback: '1',
  })
  const data = await withTimeout(8000, async (signal) => {
    const res = await fetch(`https://api.flickr.com/services/rest/?${params.toString()}`, { signal })
    if (!res.ok) throw new Error(`flickr ${res.status}`)
    return res.json()
  })
  if (data.stat !== 'ok') throw new Error(data.message || 'flickr error')

  const sets = (data.photosets && data.photosets.photoset) || []
  const albums = sets.map((s) => {
    const ex = s.primary_photo_extras || {}
    const cover =
      ex.url_b || ex.url_c || ex.url_z || ex.url_m ||
      (ex.server ? `https://live.staticflickr.com/${ex.server}/${s.primary}_${ex.secret}_b.jpg` : '')
    const createEpoch = Number(s.date_create) || 0
    return {
      id: s.id,
      name: (s.title && s.title._content) || 'Untitled album',
      coverImageUrl: cover,
      flickrUrl: `https://www.flickr.com/photos/${userId}/albums/${s.id}`,
      count: Number(s.photos || 0),
      createEpoch,
      // date_create is the UPLOAD day (in Fremont time, not UTC); refined to the real EVENT day
      // in applyEventDates.
      date: createEpoch ? ptDay(createEpoch * 1000) : '',
    }
  })
  await applyEventDates(albums, key)
  return applyAlbumTitles(albums)
}
