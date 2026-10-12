// Vercel serverless function: GET /api/events → { events: [...], games: [...], health }
// The curated items from the shared Firebird Hub Events sheet (featured=YES events,
// push=y games). Keyless. CDN-cached so it isn't recomputed per user; the client
// windows it to the upcoming range — see src/data/useEvents.js.
import { fetchEvents } from './_events.js'
import { eventsSheet } from '../src/data/sources.js'

// A good result is fresh for 2 min and served stale for up to an hour more while one background
// request refreshes it, so the first visitor after a quiet spell never waits on the slow rebuild
// (the site refetches a stale copy a few seconds later). stale-if-error keeps the last good copy
// at the edge for a day whenever a refresh fails (503 below), so visitors never get a broken or
// half-empty list.
const GOOD = 's-maxage=120, stale-while-revalidate=3600, stale-if-error=86400'
// Built from a remembered tab or without the athletics scores: cache it only briefly, so the
// complete copy replaces it soon.
const DEGRADED = 's-maxage=30, stale-while-revalidate=60, stale-if-error=86400'

export default async function handler(req, res) {
  // Allow the Firebird Hub app (different origin) to read this feed, and to see how old its copy is.
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Expose-Headers', 'Age, X-Vercel-Cache')
  try {
    const { events, games, health } = await fetchEvents(eventsSheet)
    if (health.failed.length) {
      // A tab couldn't be read and this instance has no earlier copy of it. Answering with the
      // other tab alone would cache (and store in browsers) a list with no events or no games.
      res.setHeader('Cache-Control', 'no-store')
      return res.status(503).json({ events: [], games: [], health })
    }
    if ((events && events.length) || (games && games.length)) {
      res.setHeader('Cache-Control', health.stale.length || health.scores === 'none' ? DEGRADED : GOOD)
    } else {
      // Never cache an empty result — a transient sheet hiccup must not pin viewers to nothing.
      res.setHeader('Cache-Control', 'no-store')
    }
    res.status(200).json({ events, games, health })
  } catch (err) {
    res.setHeader('Cache-Control', 'no-store')
    res.status(503).json({ events: [], games: [], error: String(err && err.message || err) })
  }
}
