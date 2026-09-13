import { useEffect, useState } from 'react'
import { makeCache, fetchJsonRetry } from './liveData'

/**
 * useAnnouncements() — morning announcements from /api/announcements. The server returns the
 * WHOLE year's parsed items; the client reveals each only once its morning has arrived (8:30 AM
 * Wed/Fri cutoff), re-evaluated against the current time every render. Robust like the other
 * live-data hooks: a TTL'd cache seeds the first paint, a flaky sheet pull is retried, and a good
 * render is never downgraded to empty. No item cap — the calendar marks EVERY past day, all the
 * way back to the first week of the year (that cap is what hid August).
 */
const CACHE_KEY = 'fasb.announcements.v2'
const CACHE_TTL = 6 * 60 * 60 * 1000
const cache = makeCache(CACHE_KEY, CACHE_TTL)

function parseLocal(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '').trim())
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null
}

// Reveal every past morning (8:30 AM cutoff), newest-first. Pure fn of the raw list + now.
function visible(all) {
  const now = new Date()
  return all
    .filter((a) => {
      const d = parseLocal(a.date)
      if (!d) return false
      d.setHours(8, 30, 0, 0) // read over the PA at ~8:30 AM
      return d <= now
    })
    .sort((x, y) => (x.date < y.date ? 1 : x.date > y.date ? -1 : 0))
    .map((a, i) => ({ ...a, key: `${a.date}-${i}` }))
}

export function useAnnouncements() {
  const [state, setState] = useState(() => {
    const cached = cache.read()
    return Array.isArray(cached) && cached.length ? { items: visible(cached), loading: false } : { items: [], loading: true }
  })

  useEffect(() => {
    let cancelled = false
    fetchJsonRetry('/api/announcements', { isEmpty: (d) => !(Array.isArray(d && d.announcements) && d.announcements.length) })
      .then((data) => {
        if (cancelled) return
        const all = data.announcements
        cache.write(all)
        setState({ items: visible(all), loading: false })
      })
      .catch(() => { if (!cancelled) setState((s) => ({ items: s.items, loading: false })) })
    return () => { cancelled = true }
  }, [])

  return state
}
