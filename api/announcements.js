// Vercel serverless function: GET /api/announcements → { announcements: [{ date, text }] }
// Pulls + parses the ASB morning-announcements sheet (public, keyless). The client
// shows only past announcements (8:30 AM Wed/Fri cutoff) — see src/data/useAnnouncements.js.
import { fetchAnnouncements } from './_announcements.js'
import { announcementsSheet } from '../src/data/sources.js'

export default async function handler(req, res) {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*')  // let the Firebird Hub app read this feed
    const announcements = await fetchAnnouncements(announcementsSheet)
    if (announcements && announcements.length && announcements.titleFallbacks) {
      // Some recent titles are heuristic stand-ins because the LLM hiccuped: keep this copy for
      // only 2 min so a later request tries the LLM again, instead of pinning them for 30 min.
      res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=120')
    } else if (announcements && announcements.length) {
      // Short CDN cache so sheet edits show within a few minutes; SWR keeps it instant.
      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=1800')
    } else {
      res.setHeader('Cache-Control', 'no-store') // don't cache an empty parse
    }
    res.status(200).json({ announcements, titleSource: announcements.titleSource || 'heuristic', titleFallbacks: announcements.titleFallbacks || 0, titleError: announcements.titleError || '' })
  } catch (err) {
    res.status(200).json({ announcements: [], error: String(err && err.message || err) })
  }
}
