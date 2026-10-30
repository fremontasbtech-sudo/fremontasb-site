import { useState } from 'react'
import { makeCache, fetchJsonRetry, useRevalidate } from './liveData'

/**
 * useFlickr(fallbackAlbums) — /api/flickr albums. Robust like the other live-data hooks:
 * a TTL'd cache seeds the first paint (so an album never disappears-then-reappears on
 * reload), a flaky Flickr pull is retried, and a good render is never downgraded to the
 * bundled sample. An open page re-checks every 2 min (useRevalidate), and an answer that was
 * the edge's stale copy is fetched again a few seconds later, so a new album shows within
 * minutes of the upload. Returns { albums, loading, source }.
 */
const CACHE_KEY = 'fasb.flickr.v1'
const CACHE_TTL = 6 * 60 * 60 * 1000
const cache = makeCache(CACHE_KEY, CACHE_TTL)
// Covers at 1024px (_b) instead of 640px (_z); the same photo secret works for both sizes.
const sharp = (u) => String(u).replace(/(live\.staticflickr\.com\/.+)_[zcm]\.jpg$/, '$1_b.jpg')
const clean = (arr) => (Array.isArray(arr) ? arr.filter((a) => a && a.coverImageUrl).map((a) => ({ ...a, coverImageUrl: sharp(a.coverImageUrl) })) : [])

export function useFlickr(fallbackAlbums = []) {
  const [state, setState] = useState(() => {
    const cached = clean(cache.read())
    return cached.length
      ? { albums: cached, loading: false, source: 'flickr' }
      : { albums: fallbackAlbums, loading: true, source: 'local' }
  })

  useRevalidate(({ onStale, alive }) =>
    fetchJsonRetry('/api/flickr', { onStale, isEmpty: (d) => !clean(d && d.albums).length })
      .then((data) => {
        if (!alive()) return
        const live = clean(data.albums)
        cache.write(live)
        setState({ albums: live, loading: false, source: 'flickr' })
      })
      .catch(() => {
        if (!alive()) return
        setState((s) => (s.source === 'flickr' && s.albums.length
          ? { ...s, loading: false }
          : { albums: fallbackAlbums, loading: false, source: 'local' }))
      }),
  )

  return state
}
