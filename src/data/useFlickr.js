import { useEffect, useState } from 'react'
import { makeCache, fetchJsonRetry } from './liveData'

/**
 * useFlickr(fallbackAlbums) — /api/flickr albums. Robust like the other live-data hooks:
 * a TTL'd cache seeds the first paint (so an album never disappears-then-reappears on
 * reload), a flaky Flickr pull is retried, and a good render is never downgraded to the
 * bundled sample. Returns { albums, loading, source }.
 */
const CACHE_KEY = 'fasb.flickr.v1'
const CACHE_TTL = 6 * 60 * 60 * 1000
const cache = makeCache(CACHE_KEY, CACHE_TTL)
const clean = (arr) => (Array.isArray(arr) ? arr.filter((a) => a && a.coverImageUrl) : [])

export function useFlickr(fallbackAlbums = []) {
  const [state, setState] = useState(() => {
    const cached = clean(cache.read())
    return cached.length
      ? { albums: cached, loading: false, source: 'flickr' }
      : { albums: fallbackAlbums, loading: true, source: 'local' }
  })

  useEffect(() => {
    let cancelled = false
    fetchJsonRetry('/api/flickr', { isEmpty: (d) => !clean(d && d.albums).length })
      .then((data) => {
        if (cancelled) return
        const live = clean(data.albums)
        cache.write(live)
        setState({ albums: live, loading: false, source: 'flickr' })
      })
      .catch(() => {
        if (cancelled) return
        setState((s) => (s.source === 'flickr' && s.albums.length
          ? { ...s, loading: false }
          : { albums: fallbackAlbums, loading: false, source: 'local' }))
      })
    return () => { cancelled = true }
  }, [])

  return state
}
