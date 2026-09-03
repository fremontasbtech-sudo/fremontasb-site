import { useEffect, useState } from 'react'

/**
 * useAnnouncements() — morning announcements pulled from /api/announcements
 * (a server-parsed view of the ASB sheet; the sheet itself is never linked/embedded).
 *
 * The sheet holds the whole year up front, so the site reveals each announcement only
 * once its morning has arrived: we keep entries whose date is in the PAST, using an
 * 8:30 AM local cutoff (when announcements are read Wed/Fri). No cron — the date does it.
 *
 * Instant load: the last server response is cached in localStorage and rendered on the
 * spot (no "Loading…" flash for repeat visitors), then revalidated in the background so
 * new announcements still appear. The past-only/8:30 filter re-runs against the CURRENT
 * time every render, so a cached list still reveals rows exactly on their morning.
 */
const CACHE_KEY = 'fasb.announcements.v1'

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const all = JSON.parse(raw)
    return Array.isArray(all) ? all : null
  } catch { return null }
}
function writeCache(all) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(all)) } catch { /* private mode / full: ignore */ }
}

// Reveal only past mornings (8:30 AM cutoff), newest-first, capped. Pure fn of the raw list + now.
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
    .slice(0, 12)
    .map((a, i) => ({ ...a, key: `${a.date}-${i}` }))
}

export function useAnnouncements() {
  // Seed synchronously from cache so the first paint already has content (no spinner).
  const [state, setState] = useState(() => {
    const cached = readCache()
    return cached ? { items: visible(cached), loading: false } : { items: [], loading: true }
  })

  useEffect(() => {
    let cancelled = false
    fetch('/api/announcements')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`http ${r.status}`))))
      .then((data) => {
        if (cancelled) return
        const all = Array.isArray(data && data.announcements) ? data.announcements : []
        writeCache(all)
        setState({ items: visible(all), loading: false })
      })
      .catch(() => { if (!cancelled) setState((s) => ({ items: s.items, loading: false })) })
    return () => { cancelled = true }
  }, [])

  return state
}

function parseLocal(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '').trim())
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null
}
