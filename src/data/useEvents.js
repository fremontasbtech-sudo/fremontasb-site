import { useCallback, useRef, useState } from 'react'
import { makeCache, fetchJsonRetry, useRevalidate } from './liveData'
import eventsSnapshot from './events.json'

/**
 * useEvents() - the curated items from the shared Firebird Hub Events sheet
 * (/api/events), the SAME sheet the app reads, so Latest News never drifts from it:
 *   • featured = YES events (Events tab)
 *   • push = y games (Sports tab)
 * The server returns every flagged row; here we window to what belongs on the home
 * page right now: featured events + pinned games in the NEXT 3 WEEKS, plus just-
 * finished flagged results (last 2 weeks). Re-evaluated against the CURRENT time on each
 * load and every minute while the page is open. For pinned games we show only the SOONEST
 * upcoming game per sport (one football, one volleyball…), so a flagged full season shows
 * one row at a time; when that game's day passes it drops out and that sport's next y-game
 * takes its place automatically. Senior nights always show, outside that rule.
 *
 * Instant load: the last response is cached in localStorage and rendered on the spot
 * (no spinner for repeat visitors), then revalidated in the background, and again while the
 * page stays open (useRevalidate in liveData.js).
 * Returns { upcoming: [items asc], recent: [items desc], events, finishedGames, loading }.
 */
const CACHE_KEY = 'fasb.events.v2'
const CACHE_TTL = 6 * 60 * 60 * 1000 // ignore a cache older than 6h so it can't flash stale data
const HORIZON_DAYS = 21   // upcoming window: the next 3 weeks only
const PAST_DAYS = 14      // how long a finished flagged game lingers

const _cache = makeCache(CACHE_KEY, CACHE_TTL)
function readCache() {
  const d = _cache.read()
  return d && Array.isArray(d.events) && Array.isArray(d.games) ? d : null
}
function writeCache(d) { _cache.write(d) }

function parseIso(iso) {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(iso || '').trim())
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null
}
const dashJoin = (parts) => parts.map((p) => String(p || '').trim()).filter(Boolean).join(' · ')
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }

// Meets (and games with no home/away yet, like league finals) name the event alone, the same
// rule the app uses: "Cross Country: SCVAL #3", "Football vs Los Altos", "Football at Homestead".
const isMeetSport = (sport) => /cross country|track|swim|dive|wrestl/i.test(String(sport || ''))
export function gameTitle(g) {
  const sport = String(g.sport || '').trim()
  const opp = String(g.opponent || '').trim().replace(/^(vs\.?|at)\s+/i, '')
  if (!opp) return sport
  if (isMeetSport(sport) || !String(g.homeAway || '').trim()) return `${sport}: ${opp}`
  return `${sport} ${/away/i.test(g.homeAway) ? 'at' : 'vs'} ${opp}`
}

// Score line for a finished game: the final when athletics has posted it, "Final score soon"
// for the first few days, then a plain note so an old game doesn't look like it's still going.
export function scoreNote(score, when, today = startOfToday()) {
  if (score && String(score).trim()) return `Final ${String(score).trim()}`
  const days = when ? Math.round((today - when) / 86400000) : 0
  return days >= 3 ? 'The final score has not been posted yet' : 'Final score soon'
}

// Raw {events, games} → windowed, news-shaped { upcoming, recent }.
export function shape(data) {
  const start = startOfToday()
  const horizon = new Date(start); horizon.setDate(horizon.getDate() + HORIZON_DAYS)
  const floor = new Date(start); floor.setDate(floor.getDate() - PAST_DAYS)
  const evItems = [], recent = []

  for (const e of data.events || []) {
    const d = parseIso(e.date); if (!d) continue
    let end = parseIso(e.endDate) || d
    if (end < d) end = d // an end date typed before the start is a typo: still show it on its day
    // upcoming or currently running, within the horizon
    if (end >= start && d <= horizon) {
      evItems.push({
        key: `ev-${e.date}-${e.name}`, type: 'Event', title: e.name, href: null, when: d,
        blurb: e.description || dashJoin([e.time, e.location]),
        meta: dashJoin([e.time, e.location]),
      })
    }
  }

  // Games (pinned push=y OR senior nights). Upcoming: every senior night in the window shows
  // (never capped or hidden, Abir 2026-10-10); for the other games keep only the SOONEST per
  // sport (one football, one volleyball…), preferring the pinned / Varsity row on a tie; it
  // rotates on its own as each game's day passes. A pinned game on a senior night's day is
  // left out, since the senior night card covers that day. Finished games (a score is in)
  // move to Latest News with the score, the moment the sheet fills the score, including same day.
  const prioOf = (g) => (g.push ? 2 : 0) + (/varsity/i.test(g.level || '') ? 1 : 0)
  const isSeniorGame = (g) => !!g.seniorNight || /senior\s*night/i.test(g.title || '')
  const seniorDays = new Set((data.games || []).filter(isSeniorGame).map((g) => `${g.sport}|${g.date}`))
  const nextBySport = new Map()
  const seniorBy = new Map()
  const recentBy = new Map()
  const finishedBy = new Map()
  for (const g of data.games || []) {
    const d = parseIso(g.date); if (!d) continue
    const isSenior = isSeniorGame(g)
    const title = gameTitle(g)
    // A game is finished once athletics marks it a result, a score is in, OR its day has
    // passed. Finished games move to Latest News (with the score if we have it yet, else a
    // "score soon" note so it never just vanishes) and out of Upcoming.
    const hasScore = !!(g.score && String(g.score).trim())
    const finished = g.section === 'result' || hasScore || d < start
    if (finished) {
      // Every finished game, regardless of age, so Latest News can turn a matching photo
      // album into a score card even for games older than PAST_DAYS (a photo album can land
      // weeks after the game). One row per sport+date, preferring the pinned/Varsity row.
      const fk = `${g.sport}|${g.date}`
      const fprev = finishedBy.get(fk)
      if (!fprev || prioOf(g) > fprev.prio) {
        finishedBy.set(fk, { prio: prioOf(g), game: { title, sport: g.sport, date: g.date, when: d, score: hasScore ? g.score : '', level: g.level || '', seniorNight: isSenior } })
      }
      if (d >= floor && d <= start) { // within the last PAST_DAYS, through today
        const k = `${g.sport}|${g.date}`
        const prev = recentBy.get(k)
        if (!prev || prioOf(g) > prev.prio) {
          const scoreBit = scoreNote(hasScore ? g.score : '', d, start)
          recentBy.set(k, { prio: prioOf(g), item: { key: `gm-${g.date}-${g.sport}`, type: 'Sports', title, sport: g.sport, date: g.date, href: null, when: d, seniorNight: isSenior, blurb: dashJoin([isSenior ? 'Senior Night' : '', scoreBit, g.level]) } })
        }
      }
      continue
    }
    if (d > horizon) continue
    const item = { key: `gm-${g.date}-${g.sport}`, type: 'Sports', title, href: null, when: d, seniorNight: isSenior, blurb: dashJoin([isSenior ? 'Senior Night' : '', g.level, g.time, g.location]), meta: dashJoin([isSenior ? 'Senior Night' : '', g.level, g.time, g.location]) }
    if (isSenior) {
      // Straight in: a pinned game earlier in the window can never hide a senior night. One card
      // per sport and day, preferring the pinned / Varsity row if a day has two senior rows.
      const sk = `${g.sport}|${g.date}`
      const sprev = seniorBy.get(sk)
      if (!sprev || prioOf(g) > sprev.prio) seniorBy.set(sk, { prio: prioOf(g), item })
      continue
    }
    if (seniorDays.has(`${g.sport}|${g.date}`)) continue
    const prev = nextBySport.get(g.sport)
    if (!prev || d < prev.when || (d.getTime() === prev.when.getTime() && prioOf(g) > prev.prio)) {
      nextBySport.set(g.sport, { when: d, prio: prioOf(g), item })
    }
  }
  for (const v of recentBy.values()) recent.push(v.item)

  const upcoming = [...evItems, ...[...seniorBy.values(), ...nextBySport.values()].map((v) => v.item)].sort((a, b) => a.when - b.when) // soonest first
  recent.sort((a, b) => b.when - a.when)                                                                        // most recent first
  const events = (data.events || []).map((e) => ({ name: e.name, date: e.date })).filter((e) => e.name && e.date)
  const finishedGames = [...finishedBy.values()].map((v) => v.game)
  return { upcoming, recent, events, finishedGames }
}

// Keep the current state object when a re-shape changed nothing, so an open page doesn't
// re-render every minute.
const sameAs = (s, next) => (JSON.stringify(s) === JSON.stringify(next) ? s : next)

export function useEvents() {
  // The raw {events, games} we last rendered from: this browser's cache, else (first-ever visit)
  // the bundled snapshot. shape() re-windows it to the current date, then the live API refreshes
  // it in the background, so Upcoming Events never waits on the slow athletics scores feed.
  const [initial] = useState(() => readCache() ||
    (eventsSnapshot && (Array.isArray(eventsSnapshot.events) || Array.isArray(eventsSnapshot.games)) ? eventsSnapshot : null))
  const raw = useRef(initial)
  const [state, setState] = useState(() => (initial
    ? { ...shape(initial), loading: false }
    : { upcoming: [], recent: [], events: [], finishedGames: [], loading: true }))

  const refresh = useCallback(({ onStale, alive }) =>
    fetchJsonRetry('/api/events', { onStale, isEmpty: (d) => !((d.events && d.events.length) || (d.games && d.games.length)) })
      .then((data) => {
        if (!alive()) return
        const clean = { events: Array.isArray(data.events) ? data.events : [], games: Array.isArray(data.games) ? data.games : [] }
        writeCache(clean)
        raw.current = clean
        setState((s) => sameAs(s, { ...shape(clean), loading: false }))
      })
      // Failed every attempt: keep everything we have (events and finishedGames too, which
      // Latest News uses to fold photo albums into score cards); just stop the loading state.
      .catch(() => { if (alive()) setState((s) => (s.loading ? { ...s, loading: false } : s)) }), [])

  // Re-window the last data every minute (no network): the window and finished games roll over.
  const reshape = useCallback(() => {
    if (raw.current) setState((s) => sameAs(s, { ...shape(raw.current), loading: s.loading }))
  }, [])

  useRevalidate(refresh, { onTick: reshape })
  return state
}
