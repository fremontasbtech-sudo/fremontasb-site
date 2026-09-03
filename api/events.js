// Vercel serverless function: GET /api/events → { events: [...], games: [...] }
// The curated items from the shared Firebird Hub Events sheet (featured=YES events,
// push=y games). Keyless. CDN-cached so it isn't recomputed per user; the client
// windows it to the upcoming range — see src/data/useEvents.js.
import { fetchEvents } from './_events.js'
import { eventsSheet } from '../src/data/sources.js'

export default async function handler(req, res) {
  try {
    const { events, games } = await fetchEvents(eventsSheet)
    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=3600')
    res.status(200).json({ events, games })
  } catch (err) {
    res.status(200).json({ events: [], games: [], error: String(err && err.message || err) })
  }
}
