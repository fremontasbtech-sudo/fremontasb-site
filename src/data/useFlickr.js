import { useEffect, useState } from 'react'

/**
 * useFlickr(fallbackAlbums)
 *
 * Auto-pulls the ASB Flickr albums from /api/flickr (a server-side proxy of the
 * Flickr API — see api/flickr.js and vite.config.js). The Flickr API key lives
 * server-side (FLICKR_API_KEY env var), never in the client bundle.
 *
 *  - Returns live albums when the key is configured; otherwise (or on any error)
 *    falls back to the sample albums in photos.json so the page never empties.
 *
 * Returns { albums, loading, source }  (source: 'flickr' | 'local').
 */
export function useFlickr(fallbackAlbums = []) {
  const [state, setState] = useState({ albums: fallbackAlbums, loading: true, source: 'local' })

  useEffect(() => {
    let cancelled = false
    fetch('/api/flickr')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`http ${r.status}`))))
      .then((data) => {
        if (cancelled) return
        const live = Array.isArray(data && data.albums)
          ? data.albums.filter((a) => a && a.coverImageUrl)
          : []
        setState(
          live.length
            ? { albums: live, loading: false, source: 'flickr' }
            : { albums: fallbackAlbums, loading: false, source: 'local' },
        )
      })
      .catch(() => {
        if (!cancelled) setState({ albums: fallbackAlbums, loading: false, source: 'local' })
      })
    return () => { cancelled = true }
  }, [])

  return state
}
