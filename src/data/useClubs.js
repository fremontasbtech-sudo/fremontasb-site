import { useEffect, useState } from 'react'
import { makeCache, fetchJsonRetry } from './liveData'

/**
 * useClubs(fallbackRows) — /api/clubs (LLM-cleaned + categorized club rows).
 * Robust like the other live-data hooks: a TTL'd cache seeds the first paint so repeat
 * visits show the list instantly (no "Loading…" flash), a flaky API is retried, and a good
 * render is never downgraded to the bundled sample. Returns { rows, loading, error, source }.
 */
const CACHE_KEY = 'fasb.clubs.v1'
const CACHE_TTL = 6 * 60 * 60 * 1000
const cache = makeCache(CACHE_KEY, CACHE_TTL)

export function useClubs(fallbackRows = []) {
  const [state, setState] = useState(() => {
    const cached = cache.read()
    return Array.isArray(cached) && cached.length
      ? { rows: cached, loading: false, error: null, source: 'sheet' }
      : { rows: [], loading: true, error: null, source: 'sheet' }
  })

  useEffect(() => {
    let cancelled = false
    fetchJsonRetry('/api/clubs', { isEmpty: (d) => !(Array.isArray(d && d.clubs) && d.clubs.length) })
      .then((data) => {
        if (cancelled) return
        const rows = data.clubs
        cache.write(rows)
        setState({ rows, loading: false, error: null, source: 'sheet' })
      })
      .catch((err) => {
        if (cancelled) return
        setState((s) => (s.rows.length
          ? { ...s, loading: false }
          : { rows: fallbackRows, loading: false, error: String((err && err.message) || err), source: 'local' }))
      })
    return () => { cancelled = true }
  }, [])

  return state
}
