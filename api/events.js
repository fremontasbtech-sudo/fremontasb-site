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
      // Short CDN cache so sheet edits show up within ~a minute; SWR keeps it instant meanwhile.
      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300')
    } else {
      // Never cache an empty result — a transient sheet hiccup must not pin viewers to nothing.
      res.setHeader('Cache-Control', 'no-store')
    }
    res.status(200).json({ events, games })
  } catch (err) {
    res.status(200).json({ events: [], games: [], error: String(err && err.message || err) })
  }
}
