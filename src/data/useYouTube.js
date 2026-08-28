import { useEffect, useState } from 'react'

/**
 * useYouTube(config, overlayRows)
 *
 * OPT-IN auto-pull of the channel's latest uploads for the Media page.
 *
 *  - If config.apiKey is null (default): returns overlayRows unchanged — the
 *    hand-maintained src/data/media.json. Nothing fetches; behavior is identical
 *    to the old static page.
 *  - If config.apiKey + a channelId (or uploadsPlaylistId) are set: fetches the
 *    newest uploads from the YouTube Data API v3. Since the API can't provide the
 *    site's custom "hosts" / "kind" fields, overlayRows (media.json) is used as an
 *    OVERLAY keyed by youtubeId: any listed video supplies hosts + kind (and can
 *    override the title/date). Videos not listed still show — kind is guessed from
 *    the title, hosts left blank.
 *  - On any fetch/parse error it falls back to overlayRows so the page never empties.
 *
 * Returns { rows, loading, error, source }  (source: 'youtube' | 'local').
 */
export function useYouTube(config = {}, overlayRows = []) {
  const enabled = Boolean(config.apiKey && (config.channelId || config.uploadsPlaylistId))
  const [state, setState] = useState({
    rows: overlayRows,
    loading: enabled,
    error: null,
    source: 'local',
  })

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    const key = config.apiKey
    const max = config.maxResults || 50

    async function run() {
      try {
        let uploads = config.uploadsPlaylistId
        if (!uploads) {
          const chUrl =
            `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${config.channelId}&key=${key}`
          const chRes = await fetch(chUrl)
          if (!chRes.ok) throw new Error(`channels ${chRes.status}`)
          const chJson = await chRes.json()
          uploads = chJson.items?.[0]?.contentDetails?.relatedPlaylists?.uploads
          if (!uploads) throw new Error('no uploads playlist for channel')
        }

        const plUrl =
          `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=${max}&playlistId=${uploads}&key=${key}`
        const plRes = await fetch(plUrl)
        if (!plRes.ok) throw new Error(`playlistItems ${plRes.status}`)
        const plJson = await plRes.json()

        const overlayById = Object.fromEntries(overlayRows.map((r) => [r.youtubeId, r]))
        const rows = (plJson.items || [])
          .map((it) => {
            const s = it.snippet || {}
            const id = s.resourceId?.videoId
            if (!id) return null
            const o = overlayById[id] || {}
            const title = o.title || s.title || 'Untitled'
            return {
              youtubeId: id,
              title,
              date: o.date || (s.publishedAt ? s.publishedAt.slice(0, 10) : ''),
              hosts: o.hosts ?? '',
              kind: o.kind || guessKind(title),
            }
          })
          .filter(Boolean)
          // Private/deleted uploads come back with title "Private video" — drop them.
          .filter((v) => v.title !== 'Private video' && v.title !== 'Deleted video')

        if (!cancelled) setState({ rows, loading: false, error: null, source: 'youtube' })
      } catch (err) {
        if (!cancelled) setState({ rows: overlayRows, loading: false, error: err.message, source: 'local' })
      }
    }
    run()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, config.apiKey, config.channelId, config.uploadsPlaylistId])

  return state
}

/** Best-effort category when a video isn't in the media.json overlay. */
function guessKind(title) {
  const t = String(title).toLowerCase()
  if (t.includes('rally')) return 'Rally'
  if (t.includes('fremonttv') || t.includes('fremont tv') || t.includes('episode')) return 'FremontTV'
  return 'Event'
}
