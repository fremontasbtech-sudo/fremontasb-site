// Vercel serverless function: GET /api/announcements → { announcements: [{ date, text }] }
// Pulls + parses the ASB morning-announcements sheet (public, keyless). The client
// shows only past announcements (8:30 AM Wed/Fri cutoff) — see src/data/useAnnouncements.js.
import { fetchAnnouncements } from './_announcements.js'
import { announcementsSheet } from '../src/data/sources.js'

export default async function handler(req, res) {
  try {
    const announcements = await fetchAnnouncements(announcementsSheet)
    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=3600')
    res.status(200).json({ announcements, titleSource: announcements.titleSource || 'heuristic' })
  } catch (err) {
    res.status(200).json({ announcements: [], error: String(err && err.message || err) })
  }
}
