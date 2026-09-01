import { useEffect, useState } from 'react'

/**
 * useAnnouncements() — morning announcements pulled from /api/announcements
 * (a server-parsed view of the ASB sheet; the sheet itself is never linked/embedded).
 *
 * The sheet holds the whole year up front, so the site reveals each announcement only
 * once its morning has arrived: we keep entries whose date is in the PAST, using an
 * 8:30 AM local cutoff (when announcements are read Wed/Fri). No cron — the date does it.
 * Returns { items: [{ date, title, text }] } newest-first (capped), and { loading }.
 */
export function useAnnouncements() {
  const [state, setState] = useState({ items: [], loading: true })

  useEffect(() => {
    let cancelled = false
    fetch('/api/announcements')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`http ${r.status}`))))
      .then((data) => {
        if (cancelled) return
        const all = Array.isArray(data && data.announcements) ? data.announcements : []
        const now = new Date()
        const past = all.filter((a) => {
          const d = parseLocal(a.date)
          if (!d) return false
          d.setHours(8, 30, 0, 0) // read over the PA at ~8:30 AM
          return d <= now
        })
        const items = past
          .sort((x, y) => (x.date < y.date ? 1 : x.date > y.date ? -1 : 0))
          .slice(0, 12)
          .map((a, i) => ({ ...a, key: `${a.date}-${i}` }))
        setState({ items, loading: false })
      })
      .catch(() => { if (!cancelled) setState({ items: [], loading: false }) })
    return () => { cancelled = true }
  }, [])

  return state
}

function parseLocal(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '').trim())
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null
}
