// Vercel serverless function: GET /api/clubs → { clubs: [...] }
// The Official Clubs List, normalized + with LLM-condensed "Meeting Location & Times".
// Keyless sheet read; the LLM key (GEMINI_API_KEY etc.) is optional — see api/_clubs.js.
import { fetchClubs } from './_clubs.js'
import { sheets } from '../src/data/sources.js'

export default async function handler(req, res) {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*')  // let the Firebird Hub app read this feed
    const clubs = await fetchClubs(sheets.clubs)
    if (clubs && clubs.length) {
      // Serve a good result from the edge for 10 min, and keep serving it (stale) for up to a
      // week while revalidating in the BACKGROUND — so the slow LLM recompute never blocks a
      // visitor; at worst one background request pays for it. Sheet edits still land in ~10 min.
      res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=604800')
    } else {
      res.setHeader('Cache-Control', 'no-store') // don't cache an empty clubs pull
    }
    res.status(200).json({ clubs, meetingSource: clubs.meetingSource || 'heuristic', meetingError: clubs.meetingError || '' })
  } catch (err) {
    res.status(200).json({ clubs: [], error: String(err && err.message || err) })
  }
}
