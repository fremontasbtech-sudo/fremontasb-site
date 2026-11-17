import { useCallback, useRef, useState } from 'react'
import { makeCache, fetchJsonRetry, useRevalidate } from './liveData'
import eventsSnapshot from './events.json'
import { NO_SCHOOL } from './noSchool'

// Does an Events-tab row name a no-school break itself? Words that only say "no school"
// (break, day, holiday, no classes...) are dropped from both names; what is left of the row's
// name must be empty or made only of the break's own words (plus a few common other names for
// it: Winter Break for Mid-Year Break, MLK for Martin Luther King Jr. Day). Whole words only,
// so "Breakfast", "Parking" or "Speaking" never match.
const BREAK_FILLER = new Set(['no', 'school', 'classes', 'class', 'break', 'day', 'days', 'week', 'holiday', 'holidays', 'recess', 'off', 'vacation', 'observed', 'jr', 'the', 'for', 'and', 'campus', 'closed', 'students'])
const BREAK_ALIASES = { 'thanksgiving break': ['fall', 'thanksgiving'], 'mid-year break': ['winter', 'midyear'], 'martin luther king jr. day': ['mlk'], "presidents' week": ['president', 'february'], 'teacher non-duty day': ['staff', 'development'], 'non-duty day': ['teacher', 'staff', 'development'] }
const breakWords = (s) => String(s || '').toLowerCase().replace(/[\u2018\u2019']/g, '').split(/[^a-z0-9]+/).filter(Boolean)
export function namesBreak(rowName, breakName) {
  const row = breakWords(rowName)
  if (!row.length) return false
  const own = new Set([...breakWords(breakName), ...(BREAK_ALIASES[String(breakName).toLowerCase()] || [])])
  const rest = row.filter((w) => !BREAK_FILLER.has(w))
  // Only filler words left ("No School", "Holiday", "Day Off"): it is the break when it says so.
  if (!rest.length) return /\b(no school|no classes|break|holiday|recess|day off|vacation|closed)\b/.test(row.join(' '))
  return rest.every((w) => own.has(w))
}

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
 * takes its place automatically. Senior nights show outside that rule, once they are within
 * 14 days.
 *
 * Instant load: the last response is cached in localStorage and rendered on the spot
 * (no spinner for repeat visitors), then revalidated in the background, and again while the
 * page stays open (useRevalidate in liveData.js).
 * Upcoming also lists the days with no school (noSchool.js). nextLater is the soonest known item
 * past the 30-day window, which Home shows when the window is empty.
 * Returns { upcoming: [items asc], recent: [items desc], events, finishedGames, nextLater, loading }.
 */
const CACHE_KEY = 'fasb.events.v2'
const CACHE_TTL = 14 * 24 * 60 * 60 * 1000 // a cache older than this deploy's snapshot is skipped too (makeCache)
const HORIZON_DAYS = 30   // upcoming window: the next 30 days (Home shows 5, the rest behind "Show more")
const PAST_DAYS = 14      // how long a finished flagged game lingers
const SENIOR_DAYS = 14    // senior nights join Upcoming once they are this close (Abir 2026-10-30)
const SENIOR_LINGER = 10  // a season's senior nights leave Latest News together, 10 days after its last one

// Sports season of a date: fall Aug-Nov, winter Dec-Feb, spring Mar-Jul.
export function seasonOf(d) {
  const m = d.getMonth() + 1, y = d.getFullYear()
  return m >= 8 && m <= 11 ? `F${y}` : m === 12 ? `W${y}` : m <= 2 ? `W${y - 1}` : `S${y}`
}

const _cache = makeCache(CACHE_KEY, CACHE_TTL, { yieldToBuild: true })
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
// The yearly Bell Game: Varsity Football against Homestead. SportsSync rewrites the Sports tab's
// titles ("Football Varsity Away vs Homestead"), so the game is found by its sport, level and
// opponent, and a title that says "Bell Game" still counts too. Flag Football and the JV and
// frosh games are not the Bell Game.
export function isBellGame(g) {
  if (!g) return false
  if (/bell\s*game/i.test(String(g.title || ''))) return true
  const sport = String(g.sport || '')
  const level = `${g.level || ''} ${g.title || ''}`
  return /\bfootball\b/i.test(sport) && !/\bflag\b/i.test(sport)
    && /homestead/i.test(String(g.opponent || ''))
    && !/\b(jv|junior\s*varsity|frosh|freshman|freshmen|f\/s|sophomore)\b/i.test(level)
    && (/\b(varsity|v)\b/i.test(level) || !String(g.level || '').trim())
}

export function gameTitle(g) {
  const sport = String(g.sport || '').trim()
  const opp = String(g.opponent || '').trim().replace(/^(vs\.?|at)\s+/i, '')
  if (!opp) return sport
  if (isMeetSport(sport) || !String(g.homeAway || '').trim()) return `${sport}: ${opp}`
  return `${sport} ${/away/i.test(g.homeAway) ? 'at' : 'vs'} ${opp}`
}

// "Bell Game: Football at Homestead" (away) or "Bell Game: Football vs Homestead" (home). A row
// with no home/away yet reads "vs" unless its location is Homestead's.
export function bellGameTitle(g) {
  if (!/homestead/i.test(String(g.opponent || ''))) return `Bell Game: ${gameTitle(g)}`
  const away = /away/i.test(String(g.homeAway || '')) || (!String(g.homeAway || '').trim() && /homestead/i.test(String(g.location || '')))
  const sport = /\bfootball\b/i.test(String(g.sport || '')) ? 'Football' : (String(g.sport || '').trim() || 'Football')
  return `Bell Game: ${sport} ${away ? 'at' : 'vs'} Homestead`
}

// Score line for a finished game: the final when athletics has posted it, "Final score soon"
// for the first few days, then a plain note so an old game doesn't look like it's still going.
export function scoreNote(score, when, today = startOfToday(), sport = '') {
  if (score && String(score).trim()) return `Final ${String(score).trim()}`
  if (isMeetSport(sport)) return 'Results are on the team page' // meets never get a single final score
  const days = when ? Math.round((today - when) / 86400000) : 0
  return days >= 3 ? 'The final score has not been posted yet' : 'Final score soon'
}

// Raw {events, games} → windowed, news-shaped { upcoming, recent }.
export function shape(data) {
  const start = startOfToday()
  const horizon = new Date(start); horizon.setDate(horizon.getDate() + HORIZON_DAYS)
  const floor = new Date(start); floor.setDate(floor.getDate() - PAST_DAYS)
  const seniorHorizon = new Date(start); seniorHorizon.setDate(seniorHorizon.getDate() + SENIOR_DAYS)
  const evItems = [], recent = []

  // The soonest thing on the calendar past the 30-day window, for Home's empty state.
  let nextLater = null
  const later = (title, when, type, extra = {}) => {
    if (when > horizon && (!nextLater || when < nextLater.when)) nextLater = { key: `next-${type}-${title}`, title, when, type, href: null, ...extra }
  }

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
    if (e.name) later(e.name, d, 'Event', { blurb: e.description || dashJoin([e.time, e.location]) })
  }

  // Days with no school (noSchool.js, the same table as the app's NO_CLASSES): one short item
  // each, upcoming or running, inside the same 30-day window. Skipped when the Events tab already
  // lists that break itself, so it never shows twice. A row counts as the break only when it is
  // dated inside it AND its name is just that break ("Thanksgiving Break", "No School",
  // "MLK Day", "Winter Break - No School"); an event that merely falls during the break
  // ("Holiday Toy Drive", "Breakfast with Felipe", "Parking lot cleanup") does not.
  const sheetBreak = (from, to, breakName) => (data.events || []).some((e) => {
    const d = parseIso(e.date)
    return d && d >= from && d <= to && namesBreak(e.name, breakName)
  })
  for (const [fromIso, toIso, name] of NO_SCHOOL) {
    const from = parseIso(fromIso), to = parseIso(toIso)
    if (!from || !to || sheetBreak(from, to, name)) continue
    if (to >= start && from <= horizon) {
      evItems.push({ key: `ns-${fromIso}`, type: 'No school', title: name, href: null, when: from, noSchool: { from: fromIso, to: toIso }, blurb: '' })
    }
    later(name, from, 'No school', { noSchool: { from: fromIso, to: toIso } })
  }

  // Games (pinned push=y OR senior nights). Upcoming: every senior night in the next 14 days
  // shows (Abir 2026-10-30); for the other games keep only the SOONEST per
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
    // The Bell Game (Varsity Football vs Homestead) gets its own badge and look on the site and
    // the app (isBellGame above).
    const isBell = isBellGame(g)
    const title = isBell ? bellGameTitle(g) : gameTitle(g)
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
        finishedBy.set(fk, { prio: prioOf(g), game: { title, sport: g.sport, date: g.date, when: d, score: hasScore ? g.score : '', level: g.level || '', seniorNight: isSenior, bellGame: isBell } })
      }
      if (d >= floor && d <= start) { // within the last PAST_DAYS, through today
        const k = `${g.sport}|${g.date}`
        const prev = recentBy.get(k)
        if (!prev || prioOf(g) > prev.prio) {
          const scoreBit = scoreNote(hasScore ? g.score : '', d, start, g.sport)
          recentBy.set(k, { prio: prioOf(g), item: { key: `gm-${g.date}-${g.sport}`, type: 'Sports', title, sport: g.sport, date: g.date, href: null, when: d, seniorNight: isSenior, bellGame: isBell, blurb: dashJoin([isSenior ? 'Senior Night' : '', scoreBit, g.level]) } })
        }
      }
      continue
    }
    // Senior nights show in Upcoming once they are within 14 days; everything else stays
    // inside the 30-day window.
    if (!isSenior) later(title, d, 'Sports', { bellGame: isBell, blurb: dashJoin([g.level, g.time, g.location]) })
    if (d > (isSenior ? seniorHorizon : horizon)) continue
    const item = { key: `gm-${g.date}-${g.sport}`, type: 'Sports', title, href: null, when: d, seniorNight: isSenior, bellGame: isBell, blurb: dashJoin([isSenior ? 'Senior Night' : '', g.level, g.time, g.location]), meta: dashJoin([isSenior ? 'Senior Night' : '', g.level, g.time, g.location]) }
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

  // Latest News lists every senior night of one season. That season is the one with the most
  // recent finished senior night; all of its cards stay until 10 days after the season's LAST
  // senior night, then leave together (Abir 2026-10-30).
  let seniorSeason = null
  const seniorDates = (data.games || []).filter(isSeniorGame).map((g) => parseIso(g.date)).filter(Boolean)
  const lastDone = seniorDates.filter((d) => d < start || (d.getTime() === start.getTime())).sort((a, b) => b - a)[0]
  if (lastDone) {
    const key = seasonOf(lastDone)
    const last = seniorDates.filter((d) => seasonOf(d) === key).sort((a, b) => b - a)[0]
    const until = new Date(last); until.setDate(until.getDate() + SENIOR_LINGER)
    if (start <= until) seniorSeason = key
  }

  const upcoming = [...evItems, ...[...seniorBy.values(), ...nextBySport.values()].map((v) => v.item)].sort((a, b) => a.when - b.when) // soonest first
  recent.sort((a, b) => b.when - a.when)                                                                        // most recent first
  const events = (data.events || []).map((e) => ({ name: e.name, date: e.date })).filter((e) => e.name && e.date)
  const finishedGames = [...finishedBy.values()].map((v) => v.game)
  return { upcoming, recent, events, finishedGames, seniorSeason, nextLater }
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
    : { upcoming: [], recent: [], events: [], finishedGames: [], nextLater: null, loading: true }))

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
