// Vercel serverless function: GET /api/events → { events: [...], games: [...] }
// The curated items from the shared Firebird Hub Events sheet (featured=YES events,
// push=y games). Keyless. CDN-cached so it isn't recomputed per user; the client
// windows it to the upcoming range — see src/data/useEvents.js.
import { fetchEvents } from './_events.js'
import { eventsSheet } from '../src/data/sources.js'

export default async function handler(req, res) {
  try {
    const { events, games } = await fetchEvents(eventsSheet)
    // Short CDN cache so sheet edits (adding/removing a featured=YES or push=y flag)
    // show up within ~a minute instead of up to 15. Keyless + tiny payload, so re-running
    // the function this often is cheap; stale-while-revalidate keeps it instant meanwhile.
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300')
    res.status(200).json({ events, games })
  } catch (err) {
    res.status(200).json({ events: [], games: [], error: String(err && err.message || err) })
  }
}
