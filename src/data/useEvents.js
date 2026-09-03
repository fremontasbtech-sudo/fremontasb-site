import { useEffect, useState } from 'react'

/**
 * useEvents() — the curated items from the shared Firebird Hub Events sheet
 * (/api/events), the SAME sheet the app reads, so Latest News never drifts from it:
 *   • featured = YES events (Events tab)
 *   • push = y games (Sports tab)
 * The server returns every flagged row; here we window to what belongs on the home
 * page right now: featured events + pinned games in the NEXT 3 WEEKS, plus just-
 * finished flagged results (last 2 weeks). Re-evaluated against the CURRENT time each
 * load. For games we show only the SOONEST upcoming game per sport (one football, one
 * volleyball…), so a flagged full season shows one row at a time; when that game's day
 * passes it drops out and that sport's next y-game takes its place automatically.
 *
 * Instant load: the last response is cached in localStorage and rendered on the spot
 * (no spinner for repeat visitors), then revalidated in the background.
 * Returns { upcoming: [items asc], recent: [items desc], loading }.
 */
const CACHE_KEY = 'fasb.events.v1'
const HORIZON_DAYS = 21   // upcoming window: the next 3 weeks only
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
  const evItems = [], recent = []

  for (const e of data.events || []) {
    const d = parseIso(e.date); if (!d) continue
    const end = parseIso(e.endDate) || d
    // upcoming or currently running, within the horizon
    if (end >= start && d <= horizon) {
      evItems.push({
        key: `ev-${e.date}-${e.name}`, type: 'Event', title: e.name, href: null, when: d,
        blurb: e.description || dashJoin([e.time, e.location]),
        meta: dashJoin([e.time, e.location]),
      })
    }
  }

  // Games (pinned push=y OR senior nights). Upcoming: keep only the SOONEST game per
  // sport within the window (one football, one volleyball…), preferring the pinned /
  // Varsity row on a tie; it rotates on its own as each game's day passes. Senior nights
  // are flagged so the UI can badge them. Finished games (a score is in) move to Latest
  // News with the score — the moment the sheet fills the score, including same day.
  const prioOf = (g) => (g.push ? 2 : 0) + (/varsity/i.test(g.level || '') ? 1 : 0)
  const nextBySport = new Map()
  const recentBy = new Map()
  for (const g of data.games || []) {
    const d = parseIso(g.date); if (!d) continue
    const isSenior = !!g.seniorNight || /senior\s*night/i.test(g.title || '')
    const title = `${g.sport}${g.opponent ? ` vs ${g.opponent}` : ''}`.trim()
    if (g.section === 'result' && g.score) {
      if (d >= floor && d <= start) { // include TODAY so a score shows as soon as it's entered
        const k = `${g.sport}|${g.date}`
        const prev = recentBy.get(k)
        if (!prev || prioOf(g) > prev.prio) {
          recentBy.set(k, { prio: prioOf(g), item: { key: `gm-${g.date}-${g.sport}`, type: 'Sports', title, href: null, when: d, seniorNight: isSenior, blurb: dashJoin([isSenior ? 'Senior Night' : '', `Final ${g.score}`, g.level]) } })
        }
      }
      continue
    }
    if (d < start || d > horizon) continue
    const prev = nextBySport.get(g.sport)
    if (!prev || d < prev.when || (d.getTime() === prev.when.getTime() && prioOf(g) > prev.prio)) {
      nextBySport.set(g.sport, { when: d, prio: prioOf(g), item: { key: `gm-${g.date}-${g.sport}`, type: 'Sports', title, href: null, when: d, seniorNight: isSenior, blurb: dashJoin([isSenior ? 'Senior Night' : '', g.level, g.time, g.location]), meta: dashJoin([isSenior ? 'Senior Night' : '', g.level, g.time, g.location]) } })
    }
  }
  for (const v of recentBy.values()) recent.push(v.item)

  const upcoming = [...evItems, ...[...nextBySport.values()].map((v) => v.item)].sort((a, b) => a.when - b.when) // soonest first
  recent.sort((a, b) => b.when - a.when)                                                                        // most recent first
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
