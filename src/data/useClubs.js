import { useEffect, useState } from 'react'

/**
 * useClubs(fallbackRows)
 *
 * Fetches /api/clubs — the server-side feed that reads the Official Clubs List
 * sheet and uses the LLM to condense each club's "Meeting Location & Times" into a
 * short, tidy line. Rows come back already normalized (same shape as the page's
 * normalizeClub). If the API is unreachable or empty, falls back to the local sample
 * file so the page never renders empty. Returns { rows, loading, error, source } —
 * the same shape the Clubs page already consumes.
 */
export function useClubs(fallbackRows = []) {
  const [state, setState] = useState({ rows: [], loading: true, error: null, source: 'sheet' })

  useEffect(() => {
    let cancelled = false
    fetch('/api/clubs')
      .then((r) => { if (!r.ok) throw new Error(`api ${r.status}`); return r.json() })
      .then((data) => {
        if (cancelled) return
        const rows = Array.isArray(data.clubs) ? data.clubs : []
        if (!rows.length) throw new Error(data.error || 'no clubs returned')
        setState({ rows, loading: false, error: null, source: 'sheet' })
      })
      .catch((err) => {
        if (cancelled) return
        setState({ rows: fallbackRows, loading: false, error: err.message, source: 'local' })
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return state
}
