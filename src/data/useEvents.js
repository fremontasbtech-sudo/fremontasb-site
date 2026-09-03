import { useEffect, useState } from 'react'

/**
 * useEvents() — the curated items from the shared Firebird Hub Events sheet
 * (/api/events), the SAME sheet the app reads, so Latest News never drifts from it:
 *   • featured = YES events (Events tab)
 *   • push = y games (Sports tab)
 * The server returns every flagged row; here we window to what belongs in "Latest
 * News" right now — upcoming events/games (next ~6 weeks) and just-finished flagged
 * results (last 2 weeks) — re-evaluated against the CURRENT time each load.
 *
 * Instant load: the last response is cached in localStorage and rendered on the spot
 * (no spinner for repeat visitors), then revalidated in the background.
 * Returns { upcoming: [items asc], recent: [items desc], loading }.
 */
const CACHE_KEY = 'fasb.events.v1'
const HORIZON_DAYS = 56   // upcoming window (~8 weeks) for Latest News
const PAST_DAYS = 14      // how long a finished flagged game lingers

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const d = JSON.parse(raw)
    return d && Array.isArray(d.events) && Array.isArray(d.games) ? d : null
  } catch { return null }
}
function writeCache(d) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(d)) } catch { /* ignore */ }
}

function parseIso(iso) {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(iso || '').trim())
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null
}
const dashJoin = (parts) => parts.map((p) => String(p || '').trim()).filter(Boolean).join(' · ')

// Raw {events, games} → windowed, news-shaped { upcoming, recent }.
function shape(data) {
  const start = new Date(); start.setHours(0, 0, 0, 0)
  const horizon = new Date(start); horizon.setDate(horizon.getDate() + HORIZON_DAYS)
  const floor = new Date(start); floor.setDate(floor.getDate() - PAST_DAYS)
  const upcoming = [], recent = []

  for (const e of data.events || []) {
    const d = parseIso(e.date); if (!d) continue
    const end = parseIso(e.endDate) || d
    // upcoming or currently running, within the horizon
    if (end >= start && d <= horizon) {
      upcoming.push({
        key: `ev-${e.date}-${e.name}`, type: 'Event', title: e.name, href: null, when: d,
        blurb: e.description || dashJoin([e.time, e.location]),
      })
    }
  }

  for (const g of data.games || []) {
    const d = parseIso(g.date); if (!d) continue
    const matchup = `${g.sport}${g.opponent ? ` vs ${g.opponent}` : ''}`.trim()
    const title = g.seniorNight ? `Senior Night — ${matchup}` : matchup
    if (g.section === 'result' && g.score) {
      if (d >= floor && d < start) {
        recent.push({ key: `gm-${g.date}-${g.sport}`, type: 'Sports', title, href: null, when: d, blurb: dashJoin([`Final ${g.score}`, g.level]) })
      }
    } else if (d >= start && d <= horizon) {
      upcoming.push({ key: `gm-${g.date}-${g.sport}`, type: 'Sports', title, href: null, when: d, blurb: dashJoin([g.level, g.time, g.location]) })
    }
  }

  upcoming.sort((a, b) => a.when - b.when)             // soonest first
  recent.sort((a, b) => b.when - a.when)               // most recent first
  return { upcoming, recent }
}

export function useEvents() {
  const [state, setState] = useState(() => {
    const cached = readCache()
    return cached ? { ...shape(cached), loading: false } : { upcoming: [], recent: [], loading: true }
  })

  useEffect(() => {
    let cancelled = false
    fetch('/api/events')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`http ${r.status}`))))
      .then((data) => {
        if (cancelled) return
        const clean = { events: Array.isArray(data.events) ? data.events : [], games: Array.isArray(data.games) ? data.games : [] }
        writeCache(clean)
        setState({ ...shape(clean), loading: false })
      })
      .catch(() => { if (!cancelled) setState((s) => ({ upcoming: s.upcoming, recent: s.recent, loading: false })) })
    return () => { cancelled = true }
  }, [])

  return state
}
