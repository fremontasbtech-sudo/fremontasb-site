import { useEffect, useState } from 'react'

/**
 * useYouTube(overlayRows)
 *
 * Auto-pulls the channel's newest uploads from /api/youtube (a keyless proxy of
 * the channel's public RSS feed — see api/youtube.js and vite.config.js).
 *
 *  - Live videos come from the feed; media.json (overlayRows) is the OVERLAY:
 *    it supplies "hosts" and "kind" (FremontTV/Rally/Event) the feed can't give,
 *    and its older episodes are kept in the archive after they age out of the feed.
 *  - New uploads appear automatically. A video not listed in media.json still shows;
 *    its kind is guessed from the title and hosts are left blank.
 *  - If the feed is unreachable it falls back to media.json, so the page never empties.
 *
 * Returns { rows, loading, source }  (source: 'youtube' | 'local').
 */
export function useYouTube(overlayRows = []) {
  const [state, setState] = useState({ rows: overlayRows, loading: true, source: 'local' })

  useEffect(() => {
    let cancelled = false
    fetch('/api/youtube')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`http ${r.status}`))))
      .then((data) => {
        if (cancelled) return
        const live = Array.isArray(data && data.videos) ? data.videos : []
        if (!live.length) {
          setState({ rows: overlayRows, loading: false, source: 'local' })
          return
        }
        const overlayById = Object.fromEntries(overlayRows.map((r) => [r.youtubeId, r]))
        const liveIds = new Set(live.map((v) => v.youtubeId))

        // Live uploads, enriched with hosts/kind from the overlay where available.
        const merged = live.map((v) => {
          const o = overlayById[v.youtubeId] || {}
          return {
            youtubeId: v.youtubeId,
            title: o.title || v.title,
            date: o.date || v.date,
            hosts: o.hosts ?? '',
            kind: o.kind || guessKind(o.title || v.title),
          }
        })
        // Older curated episodes that have scrolled out of the feed.
        const older = overlayRows
          .filter((r) => !liveIds.has(r.youtubeId))
          .map((r) => ({ hosts: '', kind: guessKind(r.title), ...r }))

        const rows = [...merged, ...older].sort((a, b) =>
          a.date < b.date ? 1 : a.date > b.date ? -1 : 0,
        )
        setState({ rows, loading: false, source: 'youtube' })
      })
      .catch(() => {
        if (!cancelled) setState({ rows: overlayRows, loading: false, source: 'local' })
      })
    return () => { cancelled = true }
  }, [])

  return state
}

/** Best-effort category when a video isn't in the media.json overlay. */
function guessKind(title) {
  const t = String(title).toLowerCase()
  if (t.includes('rally')) return 'Rally'
  if (t.includes('fremonttv') || t.includes('fremont tv') || t.includes('episode')) return 'FremontTV'
  return 'Event'
}
