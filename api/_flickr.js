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

import { llmTitles } from './_llm.js'

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
  const need = [...new Set(albums.map((a) => a.name).filter((n) => n && !albumTitleCache.has(n)))].slice(0, 80)
  if (need.length) {
    const titles = await llmTitles(need, ALBUM_INSTRUCTION)
    if (titles) need.forEach((n, i) => { if (titles[i]) albumTitleCache.set(n, titles[i]) })
  }
  return albums.map((a) => ({ ...a, title: albumTitleCache.get(a.name) || '' }))
}

export async function fetchAlbums(apiKey, userId) {
  const key = apiKey || DEFAULT_API_KEY
  if (!userId) throw new Error('no flickr nsid')
  const params = new URLSearchParams({
    method: 'flickr.photosets.getList',
    api_key: key,
    user_id: userId,
    primary_photo_extras: 'url_z,url_c,url_m',
    format: 'json',
    nojsoncallback: '1',
  })
  const res = await fetch(`https://api.flickr.com/services/rest/?${params.toString()}`)
  if (!res.ok) throw new Error(`flickr ${res.status}`)
  const data = await res.json()
  if (data.stat !== 'ok') throw new Error(data.message || 'flickr error')

  const sets = (data.photosets && data.photosets.photoset) || []
  const albums = sets.map((s) => {
    const ex = s.primary_photo_extras || {}
    const cover =
      ex.url_z || ex.url_c || ex.url_m ||
      (ex.server ? `https://live.staticflickr.com/${ex.server}/${s.primary}_${ex.secret}_z.jpg` : '')
    return {
      name: (s.title && s.title._content) || 'Untitled album',
      coverImageUrl: cover,
      flickrUrl: `https://www.flickr.com/photos/${userId}/albums/${s.id}`,
      count: Number(s.photos || 0),
      date: s.date_create ? new Date(Number(s.date_create) * 1000).toISOString().slice(0, 10) : '',
    }
  })
  return applyAlbumTitles(albums)
}
