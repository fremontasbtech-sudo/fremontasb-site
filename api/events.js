// Vercel serverless function: GET /api/events → { events: [...], games: [...] }
// The curated items from the shared Firebird Hub Events sheet (featured=YES events,
// push=y games). Keyless. CDN-cached so it isn't recomputed per user; the client
// windows it to the upcoming range — see src/data/useEvents.js.
import { fetchEvents } from './_events.js'
import { eventsSheet } from '../src/data/sources.js'

export default async function handler(req, res) {
  // Allow the Firebird Hub app (different origin) to read this feed.
  res.setHeader('Access-Control-Allow-Origin', '*')
  try {
    const { events, games } = await fetchEvents(eventsSheet)
    if ((events && events.length) || (games && games.length)) {
      // Serve a good result fresh for 2 min, then keep serving it (stale) for up to a day while
      // revalidating in the BACKGROUND, so the slow scores-feed recompute never blocks a visitor.
      res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=86400')
    } else {
      // Never cache an empty result — a transient sheet hiccup must not pin viewers to nothing.
      res.setHeader('Cache-Control', 'no-store')
    }
    res.status(200).json({ events, games })
  } catch (err) {
    res.status(200).json({ events: [], games: [], error: String(err && err.message || err) })
  }
}
