import { useEffect, useState } from 'react'

/**
 * useYouTube(overlayRows)
 *
 * Auto-pulls the channel's newest uploads from /api/youtube (a keyless proxy of
 * the channel's public RSS feed, see api/youtube.js and vite.config.js).
 *
 *  - Live videos come from the feed; media.json (overlayRows) is the OVERLAY:
 *    it supplies "hosts" and "kind" (FremontTV/Rally/Event) the feed can't give,
 *    and its older episodes are kept in the archive after they age out of the feed.
 *  - A new upload NOT yet in media.json still looks right: its clean title and hosts
 *    are parsed from the channel's own "Fremont TV | <label> | <date> | <hosts>" naming
 *    (see parseEpisode), and its kind is guessed from the title.
 *  - If the feed is unreachable it falls back to media.json, so the page never empties.
 *
 * Instant load: the last merged result is cached in localStorage and rendered on the
 * first paint (no featured-episode "flash" of the previous episode on reload), then
 * revalidated in the background so a new upload still appears.
 *
 * Returns { rows, loading, source }  (source: 'youtube' | 'local').
 */
const CACHE_KEY = 'fasb.media.v2'
function readCache() {
  try { const raw = localStorage.getItem(CACHE_KEY); const a = raw && JSON.parse(raw); return Array.isArray(a) && a.length ? a : null } catch { return null }
}
function writeCache(rows) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(rows)) } catch { /* private mode / full: ignore */ }
}

export function useYouTube(overlayRows = []) {
  // Seed from cache so the featured episode is correct on the first paint (no flash of the
  // previous one). No cache yet ⇒ seed from the overlay while the feed loads.
  const [state, setState] = useState(() => {
    const cached = readCache()
    return cached ? { rows: cached, loading: false, source: 'youtube' } : { rows: overlayRows, loading: true, source: 'local' }
  })

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

        // Live uploads. media.json wins when it lists the video; otherwise parse a clean
        // title + hosts from the channel's naming convention so new uploads look curated.
        const merged = live.map((v) => {
          const o = overlayById[v.youtubeId] || {}
          const p = parseEpisode(v.title) // client fallback if the server didn't send clean fields
          const title = o.title || v.cleanTitle || p.title || v.title
          return {
            youtubeId: v.youtubeId,
            title,
            date: o.date || v.date,
            hosts: (o.hosts ?? '') || v.hosts || p.hosts,
            kind: o.kind || v.kind || guessKind(title),
          }
        })
        // Older curated episodes that have scrolled out of the feed.
        const older = overlayRows
          .filter((r) => !liveIds.has(r.youtubeId))
          .map((r) => ({ hosts: '', kind: guessKind(r.title), ...r }))

        const rows = [...merged, ...older].sort((a, b) =>
          a.date < b.date ? 1 : a.date > b.date ? -1 : 0,
        )
        writeCache(rows)
        setState({ rows, loading: false, source: 'youtube' })
      })
      .catch(() => {
        if (!cancelled) setState((s) => ({ rows: s.rows.length ? s.rows : overlayRows, loading: false, source: 'local' }))
      })
    return () => { cancelled = true }
  }, [])

  return state
}

// FremontTV titles are typed as "Fremont TV | <label> | <date> | <hosts>", e.g.
// "Fremont TV | '26-'27: Episode 2 | 9/11 | Shraddha & Sahana". Pull the clean display
// title (everything up to the date) and the hosts out of that, so a brand-new upload
// matches the curated episodes without waiting for a media.json entry. A title that
// doesn't follow the convention (a one-off event video) returns as-is with no hosts.
function parseEpisode(raw) {
  const parts = String(raw || '').split('|').map((s) => s.trim()).filter(Boolean)
  if (parts.length >= 2) {
    const di = parts.findIndex((p, i) => i >= 1 && isDateish(p))
    if (di >= 1) {
      return {
        title: parts.slice(0, di).join(' | '),
        hosts: di < parts.length - 1 ? parts.slice(di + 1).join(', ') : '',
      }
    }
  }
  return { title: parts.join(' | '), hosts: '' }
}

const MONTHS = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i
// A segment that reads as a date: "9/11", "October 17th", "17th", "Oct 3".
function isDateish(p) {
  return /^\d{1,2}\/\d{1,2}/.test(p) || /\b\d{1,2}(st|nd|rd|th)\b/i.test(p) || MONTHS.test(p)
}

/** Best-effort category when a video isn't in the media.json overlay. */
function guessKind(title) {
  const t = String(title).toLowerCase()
  if (t.includes('rally')) return 'Rally'
  if (t.includes('fremonttv') || t.includes('fremont tv') || t.includes('episode')) return 'FremontTV'
  return 'Event'
}
